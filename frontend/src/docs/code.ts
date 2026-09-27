/**
 * Code blocks in the page: page text coloured in place by the canvas code
 * blocks' own parsers and colours (`canvas/code/`), with a bar for the
 * language, wrapping and copying, and a caption under the block. The code is
 * ordinary editor text, so undo is one history and focus never has to be
 * handed to an editor inside the page.
 */
import type { Parser } from '@lezer/common';
import type { Node } from 'prosemirror-model';
import { exitCode, newlineInCode, setBlockType } from 'prosemirror-commands';
import { Plugin, PluginKey, type Command, type EditorState } from 'prosemirror-state';
import { Decoration, DecorationSet, type EditorView, type NodeView } from 'prosemirror-view';
import { toRanges } from '../canvas/code/highlight';
import { LANGUAGES, loadParser, type LanguageEntry } from '../canvas/code/languages';
import { t } from '../i18n/t';
import { schema } from './schema';

/** Short names files use for the bundled languages. */
const ALIASES: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  golang: 'go',
  rs: 'rust',
  yml: 'yaml',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  md: 'markdown',
  htm: 'html',
};

/** The bundled language a block's language names, by its name or a short one. */
export function languageEntry(name: string): LanguageEntry | null {
  const key = name.toLowerCase();
  const canonical = ALIASES[key] ?? key;
  return LANGUAGES.find((language) => language.name === canonical) ?? null;
}

/** What the language button shows: the language's name, as written when Bava has no colouring for it. */
export function languageLabel(name: string): string {
  if (!name) return t('code.plain');
  return languageEntry(name)?.label ?? name;
}

// ---- colouring ---------------------------------------------------------------

/** Loaded parsers by language; a language still loading is absent. */
const parsers = new Map<string, Parser | null>();
const loading = new Set<string>();
const highlightKey = new PluginKey<DecorationSet>('code-highlight');

function decorate(doc: Node): DecorationSet {
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (node.type !== schema.nodes.code_block) return true;
    const entry = languageEntry(node.attrs.language);
    const parser = entry ? parsers.get(entry.name) : null;
    if (parser) {
      for (const range of toRanges(node.textContent, parser)) {
        decorations.push(Decoration.inline(pos + 1 + range.from, pos + 1 + range.to, { class: `syntax-${range.kind}` }));
      }
    }
    return false;
  });
  return DecorationSet.create(doc, decorations);
}

/** Colours every code block; a language is loaded the first time a block uses it. */
export function codeHighlight(): Plugin {
  return new Plugin({
    key: highlightKey,
    state: {
      init: (_config, state) => decorate(state.doc),
      apply: (tr, old) => (tr.docChanged || tr.getMeta(highlightKey) ? decorate(tr.doc) : old),
    },
    props: { decorations: (state) => highlightKey.getState(state) },
    view: (view) => {
      const load = () => {
        view.state.doc.descendants((node) => {
          if (node.type !== schema.nodes.code_block) return true;
          const entry = languageEntry(node.attrs.language);
          if (entry && !parsers.has(entry.name) && !loading.has(entry.name)) {
            loading.add(entry.name);
            void loadParser(entry.name).then((parser) => {
              loading.delete(entry.name);
              // A language that would not load is tried again the next time.
              if (parser) parsers.set(entry.name, parser);
              if (parser && !view.isDestroyed) view.dispatch(view.state.tr.setMeta(highlightKey, true));
            });
          }
          return false;
        });
      };
      load();
      return { update: load };
    },
  });
}

// ---- keys --------------------------------------------------------------------

const inCode = (state: EditorState) => state.selection.$from.parent.type === schema.nodes.code_block;

const INDENT = '  ';

/** Where each line the selection touches starts, as offsets into the block's text. */
function touchedLines(state: EditorState): { start: number; text: string; lines: number[] } {
  const { $from, $to } = state.selection;
  const text = $from.parent.textContent;
  const from = $from.parentOffset;
  const to = $to.sameParent($from) ? $to.parentOffset : text.length;
  const lines = [text.lastIndexOf('\n', from - 1) + 1];
  for (let at = text.indexOf('\n', from); at >= 0 && at < to; at = text.indexOf('\n', at + 1)) lines.push(at + 1);
  return { start: $from.start(), text, lines };
}

/** Tab: two spaces at the caret, or at the start of every line a selection touches. */
const indent: Command = (state, dispatch) => {
  if (!inCode(state)) return false;
  if (!dispatch) return true;
  if (state.selection.empty) {
    dispatch(state.tr.insertText(INDENT));
    return true;
  }
  const { start, lines } = touchedLines(state);
  const tr = state.tr;
  for (const line of [...lines].reverse()) tr.insertText(INDENT, start + line);
  dispatch(tr);
  return true;
};

/** Shift-Tab takes up to one indent off the start of every line the caret or selection touches. */
const outdent: Command = (state, dispatch) => {
  if (!inCode(state)) return false;
  if (!dispatch) return true;
  const { start, text, lines } = touchedLines(state);
  const tr = state.tr;
  for (const line of [...lines].reverse()) {
    const remove = Math.min(/^ */.exec(text.slice(line))![0].length, INDENT.length);
    if (remove > 0) tr.delete(start + line, start + line + remove);
  }
  if (tr.docChanged) dispatch(tr);
  return true;
};

/** ↓ on a code block's last line, with nothing after it, leaves it. */
const downOut: Command = (state, dispatch, view) => {
  if (!inCode(state) || !state.selection.empty) return false;
  const { $from } = state.selection;
  const afterCaret = $from.parent.textContent.slice($from.parentOffset);
  if (afterCaret.includes('\n')) return false;
  if (view && !view.endOfTextblock('down')) return false;
  if ($from.indexAfter(-1) < $from.node(-1).childCount) return false;
  return exitCode(state, dispatch);
};

/** Backspace at the start of an empty code block turns it back into text. */
const emptyToText: Command = (state, dispatch) => {
  const { $from, empty } = state.selection;
  if (!empty || !inCode(state) || $from.parent.content.size > 0) return false;
  return setBlockType(schema.nodes.paragraph)(state, dispatch);
};

/** Enter after ``` and a language, alone on a line, makes a code block. */
const fenceToCode: Command = (state, dispatch) => {
  const { $from, empty } = state.selection;
  if (!empty || $from.parent.type !== schema.nodes.paragraph || $from.parentOffset !== $from.parent.content.size) return false;
  const match = /^```([\w+#.-]*)$/.exec($from.parent.textContent);
  if (!match) return false;
  if (dispatch) {
    const tr = state.tr.delete($from.start(), $from.end());
    dispatch(tr.setBlockType($from.start(), $from.start(), schema.nodes.code_block, { language: match[1] }));
  }
  return true;
};

/** Keys inside code blocks, and Enter making one; before every other keymap. */
export const codeKeys: Record<string, Command> = {
  Enter: (state, dispatch) => fenceToCode(state, dispatch) || newlineInCode(state, dispatch),
  Tab: indent,
  'Shift-Tab': outdent,
  'Mod-Enter': (state, dispatch) => inCode(state) && exitCode(state, dispatch),
  ArrowDown: downOut,
  Backspace: emptyToText,
};

/** Sets the language of the code block at `pos`. */
export function setLanguage(pos: number, language: string): Command {
  return (state, dispatch) => {
    const node = state.doc.nodeAt(pos);
    if (node?.type !== schema.nodes.code_block) return false;
    dispatch?.(state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, language }));
    return true;
  };
}

// ---- the block's own controls --------------------------------------------------

export type CodeCallbacks = {
  onCopy?: (text: string) => void;
  onCodeLanguage?: (pos: number, at: { x: number; y: number }) => void;
};

function control(className: string, label: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `code-control ${className}`;
  button.textContent = label;
  return button;
}

/** The block: a bar (language, Wrap, Copy), the code itself, and its caption. */
export function codeBlockView(node: Node, view: EditorView, getPos: () => number | undefined, callbacks: CodeCallbacks): NodeView {
  let current = node;
  const dom = document.createElement('div');
  dom.className = 'code-block';

  const bar = document.createElement('div');
  bar.className = 'code-bar';
  bar.contentEditable = 'false';
  const language = control('code-language', '');
  const wrap = control('code-wrap', t('code.wrap'));
  const copy = control('code-copy', t('code.copy'));
  const spacer = document.createElement('span');
  spacer.className = 'code-spacer';
  bar.append(language, spacer, wrap, copy);

  const pre = document.createElement('pre');
  const code = document.createElement('code');
  pre.append(code);

  const below = document.createElement('div');
  below.className = 'code-below';
  below.contentEditable = 'false';
  const caption = document.createElement('input');
  caption.className = 'code-caption';
  caption.placeholder = t('code.captionPlaceholder');
  caption.setAttribute('aria-label', t('code.caption'));
  below.append(caption);

  dom.append(bar, pre, below);

  const setAttrs = (attrs: Record<string, unknown>) => {
    const pos = getPos();
    if (pos === undefined || !view.editable) return;
    view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { ...current.attrs, ...attrs }));
  };

  // The page keeps focus and its selection: a press, not a click, acts.
  const press = (button: HTMLButtonElement, act: () => void) =>
    button.addEventListener('mousedown', (event) => {
      event.preventDefault();
      act();
    });
  press(language, () => {
    const pos = getPos();
    const box = language.getBoundingClientRect();
    if (pos !== undefined && view.editable) callbacks.onCodeLanguage?.(pos, { x: box.left, y: box.bottom });
  });
  press(wrap, () => setAttrs({ wrap: !current.attrs.wrap }));
  press(copy, () => callbacks.onCopy?.(current.textContent));

  caption.addEventListener('change', () => setAttrs({ caption: caption.value.trim() || null }));
  caption.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      caption.blur();
      view.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      caption.value = current.attrs.caption ?? '';
      view.focus();
    }
  });

  const render = (next: Node) => {
    language.textContent = languageLabel(next.attrs.language);
    dom.toggleAttribute('data-wrap', next.attrs.wrap === true);
    wrap.setAttribute('aria-pressed', String(next.attrs.wrap === true));
    dom.toggleAttribute('data-captioned', Boolean(next.attrs.caption));
    if (document.activeElement !== caption) caption.value = next.attrs.caption ?? '';
    caption.disabled = !view.editable;
  };
  render(node);

  return {
    dom,
    contentDOM: code,
    update(next) {
      if (next.type !== current.type) return false;
      current = next;
      render(next);
      return true;
    },
    stopEvent: (event) => bar.contains(event.target as HTMLElement) || below.contains(event.target as HTMLElement),
    ignoreMutation: (mutation) => !code.contains(mutation.target),
  };
}
