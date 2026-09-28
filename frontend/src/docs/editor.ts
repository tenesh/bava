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
import { commands, currentKind, topBlock } from './commands';
import { findNext, findPrev, getSearchState, replaceAll, replaceNext, search, SearchQuery, setSearchState } from 'prosemirror-search';
import { filterItems, runItem, slashKey, slashPlugin, type SlashInfo } from './slash';
import { schema } from './schema';
import { codeBlockView, codeHighlight, codeKeys, setLanguage } from './code';
import { foldKeys, foldPlugin, toggleView } from './fold';
import { pasteCells, readCells, tableKeys, tablePlugins, tableState } from './table';
import { mathKeys, mathPlugin, mathView, type EquationAt } from './math';
import { footnotesPlugin, withoutDroppedNotes } from './footnotes';
import { contentsPlugin, contentsView } from './contents';
import { chooseEmoji, emojiPlugin, PICKER, type EmojiInfo } from './emoji';
import { keymap } from 'prosemirror-keymap';

export type DocEditorOptions = {
  /** Called after every change the user makes; never for loading a page. */
  onChange: () => void;
  /** ⌘K: the app asks for a link. */
  onLink?: () => void;
  /** ⌘/: the block menu for the block the caret is in. */
  onBlockMenu?: () => void;
  /** Alt+F10: focus into the formatting bubble. */
  onBubble?: () => void;
  /** A code block's Copy: its code, for the clipboard. */
  onCopy?: (text: string) => void;
  /** The `:` emoji suggestions to show, or null when they close. */
  onEmoji?: (info: EmojiInfo | null) => void;
  /** The `/` menu's Emoji: the app opens the picker at the caret. */
  onEmojiPicker?: (at: { left: number; top: number; bottom: number }) => void;
  /** A right-click in a table: the app opens the table menu there. */
  onTableMenu?: (at: { x: number; y: number }) => void;
  /** An equation at `pos` to edit: the app opens its field there. */
  onEquation?: (pos: number, at: EquationAt) => void;
  /** A code block's language button, at `pos`: the app offers the languages there. */
  onCodeLanguage?: (pos: number, at: { x: number; y: number }) => void;
  /** The selection changed, so a bubble or count can follow it. */
  onSelection?: () => void;
  /** The `/` menu opened, changed or closed (null). */
  onSlash?: (info: SlashInfo | null) => void;
};

/** Whether the caret is in code, where pasted tabs are code and never table cells. */
function inCodeAt(state: EditorState): boolean {
  const { $from } = state.selection;
  return $from.parent.type.spec.code === true || schema.marks.code.isInSet(state.storedMarks ?? $from.marks()) !== undefined;
}

/** An empty page still has a line to type on; it is written back as nothing. */
function withALine(doc: Node): Node {
  if (doc.childCount > 0 && doc.firstChild!.type !== schema.nodes.footnotes) return doc;
  return doc.copy(doc.content.addToStart(schema.nodes.paragraph.create()));
}

const emptyFront: FrontMatter = { lines: null, bavaAt: null, bavaLines: [], settings: {} };

/** "Type / for commands" on the empty line the caret is in. */
function placeholder(): Plugin {
  return new Plugin({
    props: {
      decorations(state) {
        const { $from, empty } = state.selection;
        const node = $from.parent;
        // Code is not where blocks are typed: no hint over its language.
        if (!empty || !node.isTextblock || node.type.spec.code || node.content.size > 0) return null;
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
  #foldMemory: string | null = null;
  #options: DocEditorOptions | null = null;

  mount(host: HTMLElement, options: DocEditorOptions): void {
    this.#options = options;
    this.view = new EditorView(host, {
      state: this.#state(withALine(schema.topNodeType.create())),
      editable: () => !this.locked,
      nodeViews: {
        kept: (node) => keptView(node),
        list_item: (node, view, getPos) => listItemView(node, view, getPos),
        toggle: (node, view, getPos, decorations) => toggleView(node, view, getPos, decorations),
        contents: (node, view) => contentsView(node, view),
        math_block: (node, view, getPos) => mathView(node, view, getPos, (pos, at) => this.#options?.onEquation?.(pos, at)),
        math_inline: (node, view, getPos) => mathView(node, view, getPos, (pos, at) => this.#options?.onEquation?.(pos, at)),
        code_block: (node, view, getPos) =>
          codeBlockView(node, view, getPos, {
            onCopy: (text) => this.#options?.onCopy?.(text),
            onCodeLanguage: (pos, at) => this.#options?.onCodeLanguage?.(pos, at),
          }),
      },
      attributes: { class: 'bava-doc', spellcheck: 'true' },
      // Spreadsheet cells pasted by the webview itself, as from a right-click Paste.
      handlePaste: (view, event) => {
        const cells = inCodeAt(view.state) ? null : readCells(event.clipboardData?.getData('text/plain') ?? '');
        if (!cells || this.locked) return false;
        pasteCells(cells)(view.state, view.dispatch);
        return true;
      },
      // The bubble follows focus: a selection left behind by find is not one to format.
      handleDOMEvents: {
        focus: () => void this.#options?.onSelection?.(),
        blur: () => void this.#options?.onSelection?.(),
        contextmenu: (view, event) => {
          const hit = view.posAtCoords({ left: event.clientX, top: event.clientY });
          if (!hit || !this.#options?.onTableMenu) return false;
          const $hit = view.state.doc.resolve(hit.pos);
          let inCell = false;
          for (let d = $hit.depth; d > 0; d -= 1) {
            const type = $hit.node(d).type;
            if (type === schema.nodes.table_cell || type === schema.nodes.table_header) inCell = true;
          }
          if (!inCell) return false;
          // A selection of cells stays for the menu to act on; otherwise the caret goes where the click was.
          const { from, to } = view.state.selection;
          if (view.state.selection.empty || hit.pos < from || hit.pos > to) {
            view.dispatch(view.state.tr.setSelection(TextSelection.near($hit)));
          }
          event.preventDefault();
          this.#options.onTableMenu({ x: event.clientX, y: event.clientY });
          return true;
        },
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
        emojiPlugin((info) => this.#options?.onEmoji?.(info)),
        keymap(codeKeys),
        keymap(tableKeys),
        keymap(foldKeys),
        keymap(mathKeys),
        mathPlugin((pos, at) => this.#options?.onEquation?.(pos, at)),
        shortcuts(),
        ...keys({
          onLink: () => this.#options?.onLink?.(),
          onBlockMenu: () => this.#options?.onBlockMenu?.(),
          onBubble: () => this.#options?.onBubble?.(),
        }),
        history(),
        dropCursor({ color: false, class: 'bava-drop-cursor' }),
        search(),
        codeHighlight(),
        ...tablePlugins(),
        footnotesPlugin(),
        contentsPlugin(),
        foldPlugin(() => this.#foldMemory),
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
    if (tr.getMeta(PICKER)) this.#options?.onEmojiPicker?.(this.#caretAt());
    if (tr.selectionSet || tr.docChanged) this.#options?.onSelection?.();
  }

  /**
   * Shows a page, with a fresh undo history of its own. `foldMemory` names
   * the page for remembering its folds on this computer; null remembers none.
   */
  setPage(markdown: string, foldMemory: string | null = null): void {
    this.#foldMemory = foldMemory;
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
    return writePage(withoutDroppedNotes(doc, loaded.doc), this.#front);
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
    // The notes follow their references: they are not moved or added to by hand.
    if (view.state.doc.nodeAt(pos)?.type === schema.nodes.footnotes) return null;
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
    // An empty line takes the `/` itself; any other block gets a new line
    // after it. The notes stay last, so a line for them goes before them.
    const empty = node.type === schema.nodes.paragraph && node.content.size === 0;
    const at = empty || node.type === schema.nodes.footnotes ? pos : pos + node.nodeSize;
    const tr = empty ? view.state.tr : view.state.tr.insert(at, schema.nodes.paragraph.create());
    tr.insertText('/', at + 1);
    view.dispatch(tr.setSelection(TextSelection.create(tr.doc, at + 2)).scrollIntoView());
    view.focus();
  }

  /** Where the selection is in a table, for what the table menu offers. */
  tableState(): { inTable: boolean; canMerge: boolean; canSplit: boolean } {
    return this.view ? tableState(this.view.state) : { inTable: false, canMerge: false, canSplit: false };
  }

  /** The kind of block the caret is in, as Turn into names it; null for one it does not offer. */
  currentKind(): string | null {
    return this.view ? currentKind(this.view.state) : null;
  }

  /** The block at `pos`: its type and attributes, for the menus that act on it. */
  blockInfo(pos: number): { type: string; attrs: Record<string, unknown> } | null {
    const node = this.view?.state.doc.nodeAt(pos);
    return node ? { type: node.type.name, attrs: node.attrs } : null;
  }

  /** Types `text` at the caret, as the emoji picker does. */
  insertText(text: string): void {
    const view = this.view;
    if (!view || this.locked) return;
    view.dispatch(view.state.tr.insertText(text).scrollIntoView());
    view.focus();
  }

  /** Chooses the `:` suggestion at `index`, picked with the pointer. */
  chooseEmoji(index: number): void {
    if (this.view) chooseEmoji(this.view, index);
  }

  /** Where the caret is on screen. */
  #caretAt(): { left: number; top: number; bottom: number } {
    const view = this.view;
    try {
      const coords = view!.coordsAtPos(view!.state.selection.from);
      return { left: coords.left, top: coords.top, bottom: coords.bottom };
    } catch {
      return { left: 0, top: 0, bottom: 0 };
    }
  }

  /** Sets the language of the code block at `pos`. */
  setCodeLanguage(pos: number, language: string): void {
    this.run(setLanguage(pos, language));
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
   * Pastes text: tab-separated rows (spreadsheet cells) as table cells, a
   * single line as it is, anything longer read as Markdown, so pasted
   * Markdown arrives formatted and never as the marks themselves.
   */
  paste(text: string): void {
    const view = this.view;
    if (!view || this.locked) return;
    // Cells copied from a spreadsheet arrive as tab-separated rows; in code, a tab is code.
    const cells = inCodeAt(view.state) ? null : readCells(text);
    if (cells) {
      pasteCells(cells)(view.state, view.dispatch);
      return;
    }
    // Into code, text goes in exactly as it is.
    if (inCodeAt(view.state)) {
      view.dispatch(view.state.tr.insertText(text).scrollIntoView());
      return;
    }
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
