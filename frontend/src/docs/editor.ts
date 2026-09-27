/**
 * The Document editor: a page's prose as formatted text (ProseMirror), read
 * from and written back to Markdown. A plain class that owns its DOM,
 * mounted once and destroyed in the cleanup, as .ai/rules/editors.md asks;
 * nothing reactive flows in. The app hands it a page and asks for the
 * Markdown back; it says when the user changed something.
 */
import { dropCursor } from 'prosemirror-dropcursor';
import { gapCursor } from 'prosemirror-gapcursor';
import { history, redo, undo } from 'prosemirror-history';
import { selectAll, deleteSelection } from 'prosemirror-commands';
import { Slice } from 'prosemirror-model';
import type { Node } from 'prosemirror-model';
import { EditorState, Plugin, TextSelection, type Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view';
import { t } from '../i18n/t';
import { countText } from '../shell/status-context';
import { keys } from './keymap';
import { parseBody, parsePage, writePage, type FrontMatter, type PageSettings } from './markdown';
import { shortcuts } from './rules';
import { dropPosition } from './handle';
import { commands, topBlock } from './commands';
import { findNext, findPrev, getSearchState, replaceAll, replaceNext, search, SearchQuery, setSearchState } from 'prosemirror-search';
import { filterItems, runItem, slashKey, slashPlugin, type SlashInfo } from './slash';
import { schema } from './schema';

export type DocEditorOptions = {
  /** Called after every change the user makes; never for loading a page. */
  onChange: () => void;
  /** ⌘K: the app asks for a link. */
  onLink?: () => void;
  /** ⌘/: the block menu for the block the caret is in. */
  onBlockMenu?: () => void;
  /** Alt+F10: focus into the formatting bubble. */
  onBubble?: () => void;
  /** The selection changed, so a bubble or count can follow it. */
  onSelection?: () => void;
  /** The `/` menu opened, changed or closed (null). */
  onSlash?: (info: SlashInfo | null) => void;
};

/** An empty page still has a line to type on; it is written back as nothing. */
function withALine(doc: Node): Node {
  return doc.childCount > 0 ? doc : schema.topNodeType.create(null, schema.nodes.paragraph.create());
}

const emptyFront: FrontMatter = { lines: null, bavaAt: null, bavaLines: [], settings: {} };

/** "Type / for commands" on the empty line the caret is in. */
function placeholder(): Plugin {
  return new Plugin({
    props: {
      decorations(state) {
        const { $from, empty } = state.selection;
        const node = $from.parent;
        if (!empty || !node.isTextblock || node.content.size > 0) return null;
        return DecorationSet.create(state.doc, [
          Decoration.node($from.before(), $from.after(), { class: 'is-empty', 'data-placeholder': t('doc.placeholder') }),
        ]);
      },
    },
  });
}

/** A kept block, shown as it is written, with a word on why it cannot be edited. */
function keptView(node: Node) {
  const dom = document.createElement('div');
  dom.className = 'kept-block';
  dom.dataset.label = t('doc.kept');
  dom.contentEditable = 'false';
  const pre = document.createElement('pre');
  pre.textContent = node.attrs.text;
  dom.append(pre);
  return { dom };
}

/** A list item; a to-do gets its box, which ticks on a press. */
function listItemView(node: Node, view: EditorView, getPos: () => number | undefined) {
  const li = document.createElement('li');
  if (node.attrs.checked === null) return { dom: li, contentDOM: li };
  const box = document.createElement('span');
  box.className = 'todo-box';
  box.contentEditable = 'false';
  box.setAttribute('role', 'checkbox');
  const text = document.createElement('div');
  text.className = 'todo-text';
  li.append(box, text);
  const show = (checked: boolean) => {
    li.dataset.checked = String(checked);
    box.setAttribute('aria-checked', String(checked));
  };
  show(node.attrs.checked);
  box.addEventListener('mousedown', (event) => {
    event.preventDefault();
    const pos = getPos();
    if (pos === undefined || !view.editable) return;
    const current = view.state.doc.nodeAt(pos);
    if (current) view.dispatch(view.state.tr.setNodeMarkup(pos, undefined, { ...current.attrs, checked: !current.attrs.checked }));
  });
  return {
    dom: li,
    contentDOM: text,
    update(next: Node) {
      if (next.type !== node.type || next.attrs.checked === null) return false;
      show(next.attrs.checked);
      return true;
    },
  };
}

export class DocEditor {
  view: EditorView | null = null;
  #front: FrontMatter = emptyFront;
  /** The page as it was read, to give back unchanged while nothing in it changes. */
  #loaded: { source: string; doc: Node; front: FrontMatter } | null = null;
  #options: DocEditorOptions | null = null;

  mount(host: HTMLElement, options: DocEditorOptions): void {
    this.#options = options;
    this.view = new EditorView(host, {
      state: this.#state(withALine(schema.topNodeType.create())),
      editable: () => !this.locked,
      nodeViews: {
        kept: (node) => keptView(node),
        list_item: (node, view, getPos) => listItemView(node, view, getPos),
      },
      attributes: { class: 'bava-doc', spellcheck: 'true' },
      // The bubble follows focus: a selection left behind by find is not one to format.
      handleDOMEvents: {
        focus: () => void this.#options?.onSelection?.(),
        blur: () => void this.#options?.onSelection?.(),
      },
      dispatchTransaction: (tr) => this.#dispatch(tr),
    });
  }

  #state(doc: Node): EditorState {
    return EditorState.create({
      doc,
      plugins: [
        // Before the keymap, so its keys win while it is open.
        slashPlugin((info) => this.#options?.onSlash?.(info)),
        shortcuts(),
        ...keys({
          onLink: () => this.#options?.onLink?.(),
          onBlockMenu: () => this.#options?.onBlockMenu?.(),
          onBubble: () => this.#options?.onBubble?.(),
        }),
        history(),
        dropCursor({ color: false, class: 'bava-drop-cursor' }),
        search(),
        gapCursor(),
        placeholder(),
        // A locked page takes no edits, however they arrive.
        new Plugin({ filterTransaction: (tr) => !tr.docChanged || !this.locked }),
      ],
    });
  }

  #dispatch(tr: Transaction): void {
    const view = this.view;
    if (!view) return;
    view.updateState(view.state.apply(tr));
    if (tr.docChanged) this.#options?.onChange();
    if (tr.selectionSet || tr.docChanged) this.#options?.onSelection?.();
  }

  /** Shows a page, with a fresh undo history of its own. */
  setPage(markdown: string): void {
    const page = parsePage(markdown);
    const doc = withALine(page.doc);
    this.#front = page.front;
    this.#loaded = { source: markdown, doc, front: page.front };
    this.view?.updateState(this.#state(doc));
    this.view?.setProps({ editable: () => !this.locked });
  }

  /**
   * The page as it now is: exactly as it was read while nothing in it has
   * changed, else in Bava's Markdown style. Null before a page is shown.
   */
  markdown(): string | null {
    const loaded = this.#loaded;
    if (!this.view || !loaded) return null;
    const doc = this.view.state.doc;
    if (this.#front === loaded.front && doc.eq(loaded.doc)) return loaded.source;
    return writePage(doc, this.#front);
  }

  get settings(): PageSettings {
    return { ...this.#front.settings };
  }

  get locked(): boolean {
    return this.#front.settings.locked === true;
  }

  /** Changes the page's own settings (lock, width): an edit to the page. */
  setSettings(next: PageSettings): void {
    const settings = { ...this.#front.settings, ...next };
    for (const key of Object.keys(settings) as (keyof PageSettings)[]) {
      if (settings[key] === undefined || settings[key] === false || settings[key] === '') delete settings[key];
    }
    this.#front = { ...this.#front, settings };
    this.view?.setProps({ editable: () => !this.locked });
    this.#options?.onChange();
  }

  /** Words and characters of the page, or of the selection when there is one. */
  counts(): { words: number; characters: number } {
    const state = this.view?.state;
    if (!state) return { words: 0, characters: 0 };
    const { from, to, empty } = state.selection;
    const text = empty ? state.doc.textBetween(0, state.doc.content.size, '\n', ' ') : state.doc.textBetween(from, to, '\n', ' ');
    return countText(text);
  }

  /** Where find stands: how many matches, and which one is selected (-1 for none). */
  #findState(): { count: number; index: number } {
    const state = this.view?.state;
    const query = state ? getSearchState(state)?.query : null;
    if (!state || !query || !query.valid) return { count: 0, index: -1 };
    let count = 0;
    let index = -1;
    const { from, to } = state.selection;
    for (let at = 0; ; ) {
      const match = query.findNext(state, at);
      if (!match) break;
      if (match.from === from && match.to === to) index = count;
      count += 1;
      at = match.to > at ? match.to : at + 1;
    }
    return { count, index };
  }

  #setQuery(text: string, replace = '') {
    const view = this.view;
    if (!view) return;
    view.dispatch(setSearchState(view.state.tr, new SearchQuery({ search: text, replace, caseSensitive: false })));
  }

  /** Looks for text in the page, selecting the first match. */
  find(text: string): { count: number; index: number } {
    const view = this.view;
    if (!view) return { count: 0, index: -1 };
    this.#setQuery(text);
    if (text) {
      const match = getSearchState(view.state)?.query.findNext(view.state, 0);
      if (match) view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, match.from, match.to)).scrollIntoView());
    }
    return this.#findState();
  }

  findNext(): { count: number; index: number } {
    if (this.view) findNext(this.view.state, this.view.dispatch);
    return this.#findState();
  }

  findPrevious(): { count: number; index: number } {
    if (this.view) findPrev(this.view.state, this.view.dispatch);
    return this.#findState();
  }

  /** Replaces the selected match, then moves to the next. */
  replace(text: string): { count: number; index: number } {
    const view = this.view;
    const query = view ? getSearchState(view.state)?.query : null;
    if (!view || !query || this.locked) return this.#findState();
    this.#setQuery(query.search, text);
    replaceNext(view.state, view.dispatch);
    return this.#findState();
  }

  /** Replaces every match, as one step to undo. */
  replaceAll(text: string): { count: number; index: number } {
    const view = this.view;
    const query = view ? getSearchState(view.state)?.query : null;
    if (!view || !query || this.locked) return this.#findState();
    this.#setQuery(query.search, text);
    replaceAll(view.state, view.dispatch);
    return this.#findState();
  }

  /** Which marks the selection carries, for the formatting bubble. */
  activeMarks(): Record<'bold' | 'italic' | 'underline' | 'strike' | 'code' | 'link', boolean> {
    const state = this.view?.state;
    const has = (type: import('prosemirror-model').MarkType) => {
      if (!state) return false;
      const { from, to, empty, $from } = state.selection;
      return empty ? type.isInSet(state.storedMarks ?? $from.marks()) !== undefined : state.doc.rangeHasMark(from, to, type);
    };
    const m = schema.marks;
    return { bold: has(m.strong), italic: has(m.em), underline: has(m.underline), strike: has(m.strike), code: has(m.code), link: has(m.link) };
  }

  /** The top-level block beside a point on screen, and where it sits. */
  blockAt(x: number, y: number): { pos: number; rect: DOMRect } | null {
    const view = this.view;
    if (!view) return null;
    const hit = view.posAtCoords({ left: x, top: y });
    if (!hit) return null;
    const $pos = view.state.doc.resolve(hit.inside >= 0 ? hit.inside : hit.pos);
    const pos = $pos.depth === 0 ? hit.inside : $pos.before(1);
    if (pos < 0) return null;
    const dom = view.nodeDOM(pos);
    return dom instanceof HTMLElement ? { pos, rect: dom.getBoundingClientRect() } : null;
  }

  /** Moves the top-level block at `from` to where the pointer is. */
  dropBlock(from: number, x: number, y: number): void {
    const view = this.view;
    const target = this.blockAt(x, y);
    if (!view || !target || this.locked) return;
    const half = y < target.rect.top + target.rect.height / 2 ? 'top' : 'bottom';
    commands.moveBlock(from, dropPosition(view.state.doc, target.pos, half))(view.state, view.dispatch);
  }

  /** The handle's +: a new line after the block at `pos`, with the `/` menu open on it. */
  addBlockAfter(pos: number): void {
    const view = this.view;
    const node = view?.state.doc.nodeAt(pos);
    if (!view || !node || this.locked) return;
    // An empty line takes the `/` itself; any other block gets a new line after it.
    const empty = node.type === schema.nodes.paragraph && node.content.size === 0;
    const at = empty ? pos : pos + node.nodeSize;
    const tr = empty ? view.state.tr : view.state.tr.insert(at, schema.nodes.paragraph.create());
    tr.insertText('/', at + 1);
    view.dispatch(tr.setSelection(TextSelection.create(tr.doc, at + 2)).scrollIntoView());
    view.focus();
  }

  /** The page-level block the caret is in, and where it sits on screen. */
  caretBlock(): { pos: number; left: number; top: number; bottom: number } | null {
    const view = this.view;
    const block = view ? topBlock(view.state) : null;
    if (!view || !block) return null;
    const dom = view.nodeDOM(block.pos);
    const rect = dom instanceof HTMLElement ? dom.getBoundingClientRect() : null;
    return { pos: block.pos, left: rect?.left ?? 0, top: rect?.top ?? 0, bottom: rect?.bottom ?? 0 };
  }

  /** Selects the block at `pos`, so its menu acts on it. */
  selectBlock(pos: number): void {
    const view = this.view;
    const node = view?.state.doc.nodeAt(pos);
    if (!view || !node) return;
    const inside = node.isTextblock ? pos + 1 : pos + 2;
    view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(Math.min(inside, view.state.doc.content.size)))));
  }

  /** Where selected text sits on screen, for the formatting bubble; null when nothing is selected or the page lacks focus. */
  selectionRect(): { left: number; top: number } | null {
    const view = this.view;
    if (!view || !view.hasFocus() || view.state.selection.empty || !(view.state.selection instanceof TextSelection)) return null;
    try {
      const start = view.coordsAtPos(view.state.selection.from);
      return { left: start.left, top: start.top };
    } catch {
      return null;
    }
  }

  /** Runs a command on the page, as the menus and the bubble do. */
  run(command: import('prosemirror-state').Command): void {
    const view = this.view;
    if (view && !this.locked) {
      command(view.state, view.dispatch, view);
      view.focus();
    }
  }

  /** Runs a `/` menu item picked with the pointer. */
  chooseSlash(id: string): void {
    const view = this.view;
    const open = view ? slashKey.getState(view.state)?.open : null;
    const item = open ? filterItems(open.query).find((i) => i.id === id) : undefined;
    if (view && item) {
      runItem(view, item);
      view.focus();
    }
  }

  undo(): void {
    if (this.view) undo(this.view.state, this.view.dispatch);
  }

  redo(): void {
    if (this.view) redo(this.view.state, this.view.dispatch);
  }

  selectAll(): void {
    if (this.view) selectAll(this.view.state, this.view.dispatch);
  }

  deleteSelection(): void {
    if (this.view) deleteSelection(this.view.state, this.view.dispatch);
  }

  /** The selected text, blocks on their own lines, for the clipboard. */
  selectedText(): string {
    const state = this.view?.state;
    if (!state) return '';
    const { from, to } = state.selection;
    // A kept block or run as written; a line break as a space.
    return state.doc.textBetween(from, to, '\n', (leaf) => leaf.type.spec.leafText?.(leaf) ?? ' ');
  }

  /**
   * Pastes text: a single line as it is, anything longer read as Markdown,
   * so pasted Markdown arrives formatted and never as the marks themselves.
   */
  paste(text: string): void {
    const view = this.view;
    if (!view || this.locked) return;
    if (!text.includes('\n')) {
      view.dispatch(view.state.tr.insertText(text));
      return;
    }
    const pasted = parseBody(text);
    const inline = pasted.childCount === 1 && pasted.firstChild!.type === schema.nodes.paragraph;
    const slice = inline ? new Slice(pasted.content, 1, 1) : new Slice(pasted.content, 0, 0);
    view.dispatch(view.state.tr.replaceSelection(slice).scrollIntoView());
  }

  focus(): void {
    this.view?.focus();
  }

  destroy(): void {
    this.view?.destroy();
    this.view = null;
  }
}
