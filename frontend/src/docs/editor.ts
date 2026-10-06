/**
 * The Document editor: a page's prose as formatted text (ProseMirror), read
 * from and written back to Markdown. A plain class that owns its DOM,
 * mounted once and destroyed in the cleanup, as .ai/rules/editors.md asks;
 * nothing reactive flows in. The app hands it a page and asks for the
 * Markdown back; it says when the user changed something.
 */
// ProseMirror's own rules the editor relies on: how spaces wrap, no
// ligatures under the caret, and the browser's highlight hidden while cells
// or a node are selected; and the gap cursor's line.
import 'prosemirror-view/style/prosemirror.css';
import 'prosemirror-gapcursor/style/gapcursor.css';
import { dropCursor } from 'prosemirror-dropcursor';
import { gapCursor } from 'prosemirror-gapcursor';
import { closeHistory, history, redo, undo } from 'prosemirror-history';
import { selectAll, deleteSelection } from 'prosemirror-commands';
import { Fragment, Slice, type Mark, type MarkType } from 'prosemirror-model';
import type { Node } from 'prosemirror-model';
import { EditorState, NodeSelection, Plugin, PluginKey, TextSelection, type Transaction } from 'prosemirror-state';
import { Decoration, DecorationSet, EditorView } from 'prosemirror-view';
import { t } from '../i18n/t';
import { countText } from '../shell/status-context';
import { keys } from './keymap';
import { EMPTY_FRONT, lineMark, mediaKind, normaliseTag, parseBody, parsePage, withFront, writePage, type FrontMatter, type PageSettings } from './markdown';
import { shortcuts } from './rules';
import { dropPosition } from './handle';
import { commands, currentKind, topBlock } from './commands';
import { findNext, findPrev, getSearchState, replaceAll, replaceNext, search, SearchQuery, setSearchState } from 'prosemirror-search';
import { CANVAS_ASK, filterItems, runItem, slashKey, slashPlugin, type SlashInfo } from './slash';
import { schema } from './schema';
import { codeBlockView, codeHighlight, codeKeys, setLanguage } from './code';
import { foldKeys, foldPlugin, toggleView } from './fold';
import { isSelectedCell, NO_TABLE, pasteCells, readCells, tableKeys, tablePlugins, tableState, type TableState } from './table';
import { CellSelection } from 'prosemirror-tables';
import { mathKeys, mathPlugin, mathView, type EquationAt } from './math';
import { footnotesPlugin, withoutDroppedNotes } from './footnotes';
import { contentsPlugin, contentsView, headingEntries } from './contents';
import { chooseEmoji, emojiKey, emojiPlugin, PICKER, type EmojiInfo } from './emoji';
import { chooseMention, mentionKey, mentionPlugin, type MentionInfo, type PageRef } from './mention';
import { linkAt, missingLinksPlugin } from './link-view';
import { addBlock, endLinePlugin, endsWithALine, textWithoutEndLine } from './lines';
import { posterAfter } from './page-links';
import { ADDRESS_ASK, attachmentBlock, MEDIA_PICKER, mediaView, probeFile, type MediaPlace } from './media';
import { embedView, type EmbedContext } from './embed-view';
import { cardView, type FileDetails } from './card';
import { onlineVideo, playsInPage } from './online-video';
import { dropPoint } from 'prosemirror-transform';
import { copyHeadingLink, linkLabel, linkTo, missingTarget, pastedHeadingLink, relinkCandidate, resolveLink, retarget, type Move } from './links';
import { dateAttrs } from './dates';
import { keymap } from 'prosemirror-keymap';

export type DocEditorOptions = {
  /** Called after every change the user makes; never for loading a page. */
  onChange: () => void;
  /** `/` Image or Video: the app asks for files of that kind, and adds them at the caret. */
  onChooseMedia?: (kind: 'image' | 'video' | 'file') => void;
  /** A paste with no text: the app looks for an image on the clipboard. */
  onPasteImage?: () => void;
  /** A web card's details, fetched when its link is pasted; null when they could not be. */
  fetchCard?: (address: string) => Promise<{ title: string; description: string; icon: string; image: string } | null>;
  /** Whether a site's videos play inside Bava's window; by default, where the site allows it (`playsInPage`). */
  playsInPage?: (provider: 'YouTube' | 'Vimeo' | 'Loom') => boolean;
  /** A card clicked, or an online video that plays in the browser: the app opens what it reaches (its address as written in the page). */
  onOpenFile?: (href: string) => void;
  /** A file's size and date, for its card, by the folder the user opened and its path there. */
  fileDetails?: (root: string, path: string) => Promise<FileDetails>;
  /** Whether the file route has a file; asked for media that did not load. Defaults to asking the route. */
  probeFile?: (url: string) => Promise<boolean>;
  /**
   * Canvas embeds: how this page's frames are drawn and watched, whether
   * another page still holds one, and opening one on its canvas. Without
   * them, every embed shows its picture file.
   */
  embeds?: Pick<EmbedContext, 'draw' | 'watchCanvas' | 'holds' | 'open'>;
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
  /** `/` Embed frame or Diagram from Code: the app asks for a frame, or opens the dialog, and puts the result at the caret. */
  onCanvas?: (what: 'embed' | 'diagram', at: { left: number; top: number; bottom: number }) => void;
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
  /** The `@` menu opened, changed or closed (null). */
  onMention?: (info: MentionInfo | null) => void;
  /** The `@` menu opened in a Space: the app reads its pages and hands them to `setSpacePages`. */
  onMentionPages?: () => void;
  /** A click on a link: the app shows its card; null closes it. */
  onLinkCard?: (card: LinkCard | null) => void;
  /** ⌘ or Ctrl and a click on a link, or the card's Open: the app follows it. */
  onFollow?: (href: string) => void;
  /** A click on a date chip at `pos`: the app opens the calendar there. */
  onDateChip?: (pos: number, at: { left: number; top: number; bottom: number }, date: string) => void;
};

/** A link the app shows a card for: its range, address, and whether its page is missing. */
export type LinkCard = {
  from: number;
  to: number;
  href: string;
  at: { left: number; top: number; bottom: number };
  missing: boolean;
  /** The one page with the missing page's name, to relink to. */
  relink: PageRef | null;
  /** Opened from the keyboard: focus goes into the card. */
  focus: boolean;
};

/** The position of the table cell holding `target`, or null outside a table. */
function cellAt(view: EditorView, target: EventTarget | null): number | null {
  const dom = target instanceof Element ? target.closest('td, th') : null;
  if (!dom || !view.dom.contains(dom)) return null;
  const $inside = view.state.doc.resolve(view.posAtDOM(dom, 0));
  for (let d = $inside.depth; d > 0; d -= 1) {
    const type = $inside.node(d).type;
    if (type === schema.nodes.table_cell || type === schema.nodes.table_header) return $inside.before(d);
  }
  return null;
}

/** Whether the caret is in a table cell, which holds one line of text and no blocks. */
function isInTableCell(state: EditorState): boolean {
  const { $from } = state.selection;
  return $from.depth > 1 && ($from.node(-1).type === schema.nodes.table_cell || $from.node(-1).type === schema.nodes.table_header);
}

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

const emptyFront: FrontMatter = EMPTY_FRONT;

/** The marks the formatting bubble has a button for. */
export type BubbleMark = 'bold' | 'italic' | 'underline' | 'strike' | 'code' | 'link' | 'textColor' | 'highlight';

/** Asks `test` of each of the bubble's marks, by its button's name. */
function mapMarks(test: (type: MarkType) => boolean): Record<BubbleMark, boolean> {
  const m = schema.marks;
  return {
    bold: test(m.strong),
    italic: test(m.em),
    underline: test(m.underline),
    strike: test(m.strike),
    code: test(m.code),
    link: test(m.link),
    textColor: test(m.color),
    highlight: test(m.highlight),
  };
}

/** The empty line `/` Web link or Online video left the caret on, asking for an address, while it is still empty. */
type AddressHint = { at: number; kind: 'weblink' | 'onlinevideo' } | null;
const addressHintKey = new PluginKey<AddressHint>('address-hint');

/**
 * "Type / for commands" on the empty line the caret is in; on the line
 * `/` Web link or Online video left it on, what to paste there instead; in
 * a toggle's summary, which holds only text, what the summary is for.
 */
function placeholder(): Plugin<AddressHint> {
  return new Plugin<AddressHint>({
    key: addressHintKey,
    state: {
      init: () => null,
      apply(tr, hint, _old, state) {
        const asked = tr.getMeta(ADDRESS_ASK) as 'weblink' | 'onlinevideo' | undefined;
        const { $from, empty } = state.selection;
        if (asked) return { at: $from.before(), kind: asked };
        if (!hint) return null;
        // Kept only while the caret stays on that line and it stays empty.
        const at = tr.mapping.map(hint.at);
        return empty && $from.depth > 0 && $from.before() === at && $from.parent.content.size === 0 ? { at, kind: hint.kind } : null;
      },
    },
    props: {
      decorations(state) {
        const { $from, empty } = state.selection;
        const node = $from.parent;
        // Code and table cells are not where blocks are typed: no hint there.
        const inCell = $from.depth > 1 && ['table_cell', 'table_header'].includes($from.node(-1).type.name);
        if (!empty || !node.isTextblock || node.type.spec.code || inCell || node.content.size > 0) return null;
        const hint = addressHintKey.getState(state);
        // A toggle's summary takes only its title: no block goes there.
        const words =
          node.type === schema.nodes.toggle_summary
            ? t('doc.togglePlaceholder')
            : hint && hint.at === $from.before()
              ? t(hint.kind === 'onlinevideo' ? 'media.pasteVideo' : 'media.pasteLink')
              : t('doc.placeholder');
        return DecorationSet.create(state.doc, [Decoration.node($from.before(), $from.after(), { class: 'is-empty', 'data-placeholder': words })]);
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
  #loaded: { source: string; doc: Node; front: FrontMatter; body: string } | null = null;
  #foldMemory: string | null = null;
  /** Cells selected when a right-click began, for its menu to act on. */
  #heldCells: CellSelection | null = null;
  /** Whether the page has had the caret since it opened: where a canvas embed made from outside it goes. */
  #hadCaret = false;
  #options: DocEditorOptions | null = null;
  /** This page's path in its Space (null outside one), and the Space's pages once read. */
  #space: { here: string | null; pages: PageRef[] | null } = { here: null, pages: null };
  /** The folder this page's images and videos are loaded from, and the blocks to draw again when it changes. */
  #mediaPlace: MediaPlace | null = null;
  #mediaWatchers = new Set<() => void>();
  /** The link whose card is showing, to close it when the caret leaves. */
  #card: { from: number; to: number } | null = null;

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
        image: (node, view, getPos) => mediaView(node, view, getPos, this.#mediaContext()),
        video: (node, view, getPos) => mediaView(node, view, getPos, this.#mediaContext()),
        embed: (node, view, getPos) => embedView(node, view, getPos, { ...this.#mediaContext(), ...this.#embeds() }),
        card: (node, view, getPos) =>
          cardView(node, view, getPos, {
            ...this.#mediaContext(),
            details: (root, path) => this.#options?.fileDetails?.(root, path) ?? Promise.resolve({ exists: true, size: 0, modified: '', error: '' }),
            open: (href) => this.#options?.onOpenFile?.(href),
            relink: (pos, href) => this.setMediaAttrs(pos, { href }),
          }),
        code_block: (node, view, getPos) =>
          codeBlockView(node, view, getPos, {
            onCopy: (text) => this.#options?.onCopy?.(text),
            onCodeLanguage: (pos, at) => this.#options?.onCodeLanguage?.(pos, at),
          }),
      },
      attributes: { class: 'bava-doc', spellcheck: 'true' },
      // Spreadsheet cells pasted by the webview itself, as from a right-click Paste.
      handlePaste: (view, event) => {
        // No text, only files: an image, which the app reads from the clipboard.
        const types = [...(event.clipboardData?.types ?? [])];
        if (!this.locked && types.includes('Files') && !types.includes('text/plain') && !types.includes('text/html')) {
          this.#options?.onPasteImage?.();
          return true;
        }
        if (!this.locked && this.#pasteHeadingLink(event.clipboardData?.getData('text/plain') ?? '')) return true;
        if (!this.locked && this.#pasteAddress(event.clipboardData?.getData('text/plain') ?? '')) return true;
        const cells = inCodeAt(view.state) ? null : readCells(event.clipboardData?.getData('text/plain') ?? '');
        if (!cells || this.locked) return false;
        pasteCells(cells)(view.state, view.dispatch);
        return true;
      },
      // From the keyboard: Enter on a selected date chip opens its calendar,
      // ⌥Enter in a link opens its card with focus in it.
      handleKeyDown: (view, event) => {
        const { selection } = view.state;
        if (event.key !== 'Enter' || event.shiftKey || event.metaKey || event.ctrlKey) return false;
        // Enter on a selected card opens it, as a click does.
        if (!event.altKey && selection instanceof NodeSelection && selection.node.type === schema.nodes.card) {
          this.#options?.onOpenFile?.(selection.node.attrs.href as string);
          return true;
        }
        if (!event.altKey && selection instanceof NodeSelection && selection.node.type === schema.nodes.date) {
          this.#openDate(selection.from);
          return true;
        }
        const link = event.altKey && selection.empty ? linkAt(view.state, selection.from) : null;
        if (!link) return false;
        this.#openCard(link.from, link.to, link.href, true);
        return true;
      },
      handleClick: (view, pos, event) => {
        const link = linkAt(view.state, pos);
        if (!link) return false;
        if (event.metaKey || event.ctrlKey) {
          event.preventDefault();
          this.#closeCard();
          this.#options?.onFollow?.(link.href);
          return true;
        }
        this.#openCard(link.from, link.to, link.href);
        return false;
      },
      // Files from the desktop are the app's to add, where they land; an
      // attachment dragged from Media goes in where it lands, as it is.
      handleDrop: (view, event) => {
        const drop = event as DragEvent;
        const types = [...(drop.dataTransfer?.types ?? [])];
        if (types.includes('application/x-bava-attachment')) {
          const name = drop.dataTransfer!.getData('application/x-bava-attachment');
          if (name) this.insertMedia([name], this.posAtPoint(drop.clientX, drop.clientY) ?? undefined);
          return true;
        }
        return types.includes('Files');
      },
      handleClickOn: (_view, _pos, node, nodePos, _event, direct) => {
        if (direct && node.type === schema.nodes.date) this.#openDate(nodePos);
        return false;
      },
      // The bubble follows focus: a selection left behind by find is not one to format.
      handleDOMEvents: {
        // A link in the page never navigates the app's own window.
        click: (_view, event) => {
          if (event.target instanceof Element && event.target.closest('a')) event.preventDefault();
          return false;
        },
        focus: () => {
          this.#hadCaret = true;
          this.#options?.onSelection?.();
        },
        blur: () => void this.#options?.onSelection?.(),
        // A right-click on selected cells keeps them selected: WebKit on macOS
        // would select the word under the pointer instead.
        mousedown: (view, event) => {
          this.#heldCells = null;
          // A right-click, or on a Mac a Control-click, which WebKit treats as one.
          const context = event.button === 2 || (event.button === 0 && event.ctrlKey && /Mac/.test(navigator.platform));
          if (!context) return false;
          const cell = cellAt(view, event.target);
          if (cell === null || !isSelectedCell(view.state, cell)) return false;
          this.#heldCells = view.state.selection as CellSelection;
          event.preventDefault();
          return true;
        },
        contextmenu: (view, event) => {
          const held = this.#heldCells;
          this.#heldCells = null;
          const cell = cellAt(view, event.target);
          if (cell === null || !this.#options?.onTableMenu) return false;
          if (held && !(view.state.selection instanceof CellSelection) && held.$anchorCell.doc === view.state.doc) {
            view.dispatch(view.state.tr.setSelection(held));
          } else if (!isSelectedCell(view.state, cell)) {
            // Outside the selection: the caret goes into the cell clicked.
            view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(cell + 1))));
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
        mentionPlugin(
          (info) => this.#options?.onMention?.(info),
          () => this.#space,
          () => this.#options?.onMentionPages?.(),
        ),
        missingLinksPlugin(() => this.#space),
        // Before the code block's own ⌘Enter, which does the same for code.
        keymap({
          'Mod-Enter': (state, dispatch) => !this.locked && addBlock('after')(state, dispatch),
          'Shift-Mod-Enter': (state, dispatch) => !this.locked && addBlock('before')(state, dispatch),
        }),
        endLinePlugin(),
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
    if (tr.getMeta(MEDIA_PICKER)) this.#options?.onChooseMedia?.(tr.getMeta(MEDIA_PICKER));
    if (tr.getMeta(CANVAS_ASK)) this.#options?.onCanvas?.(tr.getMeta(CANVAS_ASK), this.#caretAt());
    if (tr.selectionSet || tr.docChanged) this.#options?.onSelection?.();
    const card = this.#card;
    const { from, to } = view.state.selection;
    if (card && (tr.docChanged || from < card.from || to > card.to)) this.#closeCard();
  }

  /** Asks the app for the calendar of the date chip at `pos`. */
  #openDate(pos: number): void {
    const view = this.view;
    const node = view?.state.doc.nodeAt(pos);
    if (!view || node?.type !== schema.nodes.date) return;
    const dom = view.nodeDOM(pos);
    const rect = dom instanceof Element ? dom.getBoundingClientRect() : { left: 0, top: 0, bottom: 0 };
    this.#options?.onDateChip?.(pos, { left: rect.left, top: rect.top, bottom: rect.bottom }, node.attrs.date as string);
  }

  #openCard(from: number, to: number, href: string, focus = false): void {
    const view = this.view;
    if (!view) return;
    const { here, pages } = this.#space;
    const missing = here !== null && pages ? missingTarget(here, href, new Set(pages.map((p) => p.path))) : null;
    let at = { left: 0, top: 0, bottom: 0 };
    try {
      const coords = view.coordsAtPos(from);
      at = { left: coords.left, top: coords.top, bottom: coords.bottom };
    } catch {
      // No layout (tests): the card still reports the link.
    }
    this.#card = { from, to };
    this.#options?.onLinkCard?.({ from, to, href, at, missing: missing !== null, relink: missing && pages ? relinkCandidate(missing, pages) : null, focus });
  }

  #closeCard(): void {
    if (!this.#card) return;
    this.#card = null;
    this.#options?.onLinkCard?.(null);
  }

  /**
   * Rewrites this page's links after pages or folders moved, as the other
   * pages are rewritten (`page-links.ts`): `page` is this page's path before
   * the moves.
   * One edit, undone as one; nothing when no link reaches what moved.
   */
  followMoves(page: string, moves: Move[]): void {
    const view = this.view;
    if (!view) return;
    // `plain`: one run of text carrying nothing but the link, whose words can follow a rename.
    const runs: { from: number; to: number; text: string; mark: Mark; marks: readonly Mark[]; plain: boolean }[] = [];
    view.state.doc.descendants((node, pos) => {
      if (!node.inlineContent) return true;
      node.forEach((child, offset) => {
        const mark = child.marks.find((m) => m.type === schema.marks.link);
        const last = runs.at(-1);
        const from = pos + 1 + offset;
        if (!mark) return;
        if (last && last.to === from && last.mark.eq(mark)) {
          last.to += child.nodeSize;
          last.text += child.isText ? child.text! : '￼';
          last.plain = false;
        } else {
          const text = child.isText ? child.text! : '￼';
          runs.push({ from, to: from + child.nodeSize, text, mark, marks: child.marks, plain: child.isText && child.marks.length === 1 });
        }
      });
      return false;
    });
    const tr = view.state.tr;
    // Media blocks keep their words; their address and poster follow. A card
    // follows as a link does, its pictures as a poster.
    view.state.doc.descendants((node, pos) => {
      if (node.type === schema.nodes.card) {
        const next = retarget(page, node.attrs.href as string, node.attrs.text as string, moves);
        const picture = (key: 'icon' | 'image') => (node.attrs[key] ? (posterAfter(node.attrs[key] as string, moves) ?? node.attrs[key]) : null);
        const attrs = { ...node.attrs, href: next?.href ?? node.attrs.href, text: next?.text ?? node.attrs.text, icon: picture('icon'), image: picture('image') };
        if (Object.keys(attrs).some((key) => attrs[key as keyof typeof attrs] !== node.attrs[key])) tr.setNodeMarkup(pos, null, attrs);
        return false;
      }
      // An embed's picture follows as a media block's address, and the page
      // its frame is on as a link's address.
      if (node.type === schema.nodes.embed) {
        const src = retarget(page, node.attrs.src as string, '￼', moves)?.href ?? node.attrs.src;
        const from = node.attrs.page ? (retarget(page, node.attrs.page as string, '￼', moves)?.href ?? node.attrs.page) : null;
        if (src !== node.attrs.src || from !== node.attrs.page) tr.setNodeMarkup(pos, null, { ...node.attrs, src, page: from });
        return false;
      }
      if (node.type !== schema.nodes.image && node.type !== schema.nodes.video) return true;
      const src = retarget(page, node.attrs.src as string, '￼', moves)?.href ?? node.attrs.src;
      const poster = node.attrs.poster ? (posterAfter(node.attrs.poster as string, moves) ?? node.attrs.poster) : null;
      if (src !== node.attrs.src || poster !== node.attrs.poster) tr.setNodeMarkup(pos, null, { ...node.attrs, src, poster });
      return false;
    });
    for (const run of runs.reverse()) {
      // Formatted words are never the file's name, as the other pages read them.
      const next = retarget(page, run.mark.attrs.href as string, run.plain ? run.text : '￼', moves);
      if (!next) continue;
      const link = schema.marks.link.create({ ...run.mark.attrs, href: next.href });
      if (run.plain && next.text !== run.text) tr.replaceWith(run.from, run.to, schema.text(next.text, link.addToSet(run.mark.removeFromSet(run.marks))));
      else tr.removeMark(run.from, run.to, schema.marks.link).addMark(run.from, run.to, link);
    }
    if (tr.docChanged) view.dispatch(tr);
  }

  /** Selects the text from `from` to `to`, as for editing a link. */
  selectRange(from: number, to: number): void {
    const view = this.view;
    if (!view) return;
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to)));
    view.focus();
  }

  /** Takes the link off the text from `from` to `to`, keeping the text. */
  removeLink(from: number, to: number): void {
    const view = this.view;
    if (!view || this.locked) return;
    view.dispatch(view.state.tr.removeMark(from, to, schema.marks.link));
  }

  /** Points the link from `from` to `to` at a page of the Space, keeping its anchor and title. */
  relink(from: number, to: number, path: string): void {
    const view = this.view;
    const here = this.#space.here;
    const link = view ? linkAt(view.state, from) : null;
    if (!view || this.locked || here === null || !link) return;
    const anchor = resolveLink(here, link.href)?.anchor ?? '';
    const next = schema.marks.link.create({ ...link.mark.attrs, href: linkTo(here, path, anchor) });
    view.dispatch(view.state.tr.removeMark(from, to, schema.marks.link).addMark(from, to, next));
  }

  /** Copies a link to the heading at `pos`, for pasting in any page of the Space. */
  copyHeadingLink(pos: number): void {
    const view = this.view;
    const entry = view ? headingEntries(view.state.doc).find((e) => e.pos === pos) : undefined;
    if (!entry) return;
    const here = this.#space.here;
    const text = here === null ? `[${linkLabel(entry.text)}](#${entry.slug})` : copyHeadingLink(here, `#${entry.slug}`, entry.text);
    this.#options?.onCopy?.(text);
  }

  /** A web address pasted alone on an empty line: an online video, an image, or a card (`insertAddress`). */
  #pasteAddress(text: string): boolean {
    const view = this.view;
    const address = text.trim();
    if (!view || !/^https?:\/\/\S+$/i.test(address)) return false;
    const { selection } = view.state;
    const line = selection.$from.parent;
    if (!selection.empty || line.type !== schema.nodes.paragraph || line.content.size > 0 || inCodeAt(view.state) || isInTableCell(view.state)) return false;
    this.insertAddress(address);
    return true;
  }

  /** A pasted link to a heading copied in this Space, made relative to this page; false for any other text. */
  #pasteHeadingLink(text: string): boolean {
    const view = this.view;
    const here = this.#space.here;
    const parts = /^(\s*)(\S[\s\S]*?)(\s*)$/.exec(text);
    const link = parts ? pastedHeadingLink(parts[2]) : null;
    if (!view || here === null || !parts || !link || inCodeAt(view.state)) return false;
    const href = link.path === here ? link.anchor : linkTo(here, link.path, link.anchor);
    const nodes = [
      ...(parts[1] ? [schema.text(parts[1])] : []),
      schema.text(link.name, [schema.marks.link.create({ href })]),
      ...(parts[3] ? [schema.text(parts[3])] : []),
    ];
    view.dispatch(view.state.tr.replaceSelection(new Slice(Fragment.fromArray(nodes), 0, 0)).scrollIntoView());
    return true;
  }

  /** Puts the caret at the heading an anchor names (`#goals`) and shows it; false when none does. */
  goToAnchor(anchor: string): boolean {
    const view = this.view;
    if (!view) return false;
    let slug = anchor.replace(/^#/, '');
    try {
      slug = decodeURIComponent(slug);
    } catch {
      // Not encoded: the anchor as written.
    }
    const entry = headingEntries(view.state.doc).find((e) => e.slug === slug);
    if (!entry) return false;
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, entry.pos + 1)));
    // The heading at the top of the view, as a jump to it reads.
    const dom = view.nodeDOM(entry.pos);
    if (dom instanceof HTMLElement) dom.scrollIntoView?.({ block: 'start' });
    return true;
  }

  /** Changes the date chip at `pos` to `day`, in Bava's words, as one step. */
  setDate(pos: number, day: string): void {
    const view = this.view;
    const node = view?.state.doc.nodeAt(pos);
    if (!view || this.locked || node?.type !== schema.nodes.date) return;
    const tr = view.state.tr.setNodeMarkup(pos, undefined, dateAttrs(day));
    view.dispatch(tr.setSelection(NodeSelection.create(tr.doc, pos)));
  }

  /**
   * Shows a page, with a fresh undo history of its own. `foldMemory` names
   * the page for remembering its folds on this computer; null remembers none.
   */
  setPage(markdown: string, foldMemory: string | null = null): void {
    this.#foldMemory = foldMemory;
    this.#hadCaret = false;
    const page = parsePage(markdown);
    const doc = endsWithALine(withALine(page.doc));
    this.#front = page.front;
    this.#loaded = { source: markdown, doc, front: page.front, body: page.body };
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
    if (doc.eq(loaded.doc)) {
      if (this.#front === loaded.front) return loaded.source;
      // Only the header changed: the prose stays as read, tidied only when it is edited.
      return withFront(this.#front, loaded.body);
    }
    return writePage(withoutDroppedNotes(doc, loaded.doc), this.#front);
  }

  get settings(): PageSettings {
    return { ...this.#front.settings };
  }

  get locked(): boolean {
    return this.#front.settings.locked === true;
  }

  /** The page's tags, converted. */
  get tags(): string[] {
    return [...this.#front.tags];
  }

  /** Changes the page's tags, converting each and dropping repeats: an edit to the page. */
  setTags(next: string[]): void {
    const tags: string[] = [];
    for (const tag of next.map(normaliseTag)) if (tag !== '' && !tags.includes(tag)) tags.push(tag);
    this.#front = { ...this.#front, tags };
    this.#options?.onChange();
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
    const text = empty ? textWithoutEndLine(state.doc, 0, state.doc.content.size, ' ') : textWithoutEndLine(state.doc, from, to, ' ');
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
  activeMarks(): Record<BubbleMark, boolean> {
    const state = this.view?.state;
    const has = (type: MarkType) => {
      if (!state) return false;
      const { from, to, empty, $from } = state.selection;
      return empty ? type.isInSet(state.storedMarks ?? $from.marks()) !== undefined : state.doc.rangeHasMark(from, to, type);
    };
    return mapMarks(has);
  }

  /** Which marks the selected text can take: those its lines allow, for the bubble to offer. */
  offeredMarks(): Record<BubbleMark, boolean> {
    const state = this.view?.state;
    const allows = (type: MarkType) => {
      if (!state) return false;
      const { from, to, $from } = state.selection;
      let allowed = $from.parent.inlineContent && $from.parent.type.allowsMarkType(type);
      state.doc.nodesBetween(from, to, (node) => {
        if (node.inlineContent && node.type.allowsMarkType(type)) allowed = true;
        return !allowed;
      });
      return allowed;
    };
    return mapMarks(allows);
  }

  /** The address the selected text links to, or null when it has no link. */
  selectionLink(): string | null {
    const state = this.view?.state;
    if (!state) return null;
    const { from, to, empty, $from } = state.selection;
    if (empty) return (schema.marks.link.isInSet(state.storedMarks ?? $from.marks())?.attrs.href as string | undefined) ?? null;
    let href: string | null = null;
    state.doc.nodesBetween(from, to, (node) => {
      const mark = href === null && node.isInline ? schema.marks.link.isInSet(node.marks) : undefined;
      if (mark) href = mark.attrs.href as string;
      return href === null;
    });
    return href;
  }

  /**
   * Where a field editing the block at `pos` sits on screen: a medium's
   * caption under it, where the caption shows; a card's new name over its
   * name, as tall as the name's line so the size under it stays whole. Null
   * for any other block.
   */
  fieldAt(pos: number): { left: number; top: number; height?: number } | null {
    const dom = this.view?.nodeDOM(pos);
    if (!(dom instanceof HTMLElement)) return null;
    const frame = dom.querySelector('.media-frame');
    const caption = dom.querySelector<HTMLElement>('.media-caption');
    if (frame && caption) {
      const box = frame.getBoundingClientRect();
      // No caption yet: the field takes its place, under the frame.
      return { left: box.left, top: caption.hidden ? box.bottom : caption.getBoundingClientRect().top };
    }
    const title = dom.querySelector('.card-title');
    if (title) {
      const rect = title.getBoundingClientRect();
      return { left: rect.left, top: rect.top, height: rect.height };
    }
    return null;
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

  /** The handle's `+` with ⌥: a line before the block at `pos`, with the `/` menu open on it. */
  addBlockBefore(pos: number): void {
    const view = this.view;
    const node = view?.state.doc.nodeAt(pos);
    if (!view || !node || this.locked) return;
    const tr = view.state.tr.insert(pos, schema.nodes.paragraph.create());
    tr.insertText('/', pos + 1);
    view.dispatch(tr.setSelection(TextSelection.create(tr.doc, pos + 2)).scrollIntoView());
    view.focus();
  }

  /** The block menu's Add a block before or after: an empty line beside the block at `pos`, the caret on it. */
  addBlockBeside(pos: number, side: 'before' | 'after'): void {
    const view = this.view;
    const node = view?.state.doc.nodeAt(pos);
    if (!view || !node || this.locked) return;
    // The notes stay last: a block for them goes before them.
    const at = side === 'before' || node.type === schema.nodes.footnotes ? pos : pos + node.nodeSize;
    const tr = view.state.tr.insert(at, schema.nodes.paragraph.create());
    view.dispatch(tr.setSelection(TextSelection.create(tr.doc, at + 1)).scrollIntoView());
    view.focus();
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
  tableState(): TableState {
    return this.view ? tableState(this.view.state) : NO_TABLE;
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

  /** The folder the user opened that holds this page, and its path there: where its images and videos load from. */
  setMediaPlace(place: MediaPlace | null): void {
    const same = place && this.#mediaPlace && place.root === this.#mediaPlace.root && place.here === this.#mediaPlace.here;
    if (same || (!place && !this.#mediaPlace)) return;
    this.#mediaPlace = place;
    for (const redraw of this.#mediaWatchers) redraw();
  }

  /** The app's canvas embeds; with none, each embed shows its picture file. */
  #embeds(): Pick<EmbedContext, 'draw' | 'watchCanvas' | 'holds' | 'open'> {
    return this.#options?.embeds ?? { watchCanvas: () => () => {}, holds: async () => null, open: () => {} };
  }

  #mediaContext() {
    return {
      place: () => this.#mediaPlace,
      probe: (url: string) => (this.#options?.probeFile ?? probeFile)(url),
      watchPlace: (redraw: () => void) => {
        this.#mediaWatchers.add(redraw);
        return () => this.#mediaWatchers.delete(redraw);
      },
      relink: (pos: number, src: string) => this.setMediaAttrs(pos, { src }),
      playsInPage: (provider: 'YouTube' | 'Vimeo' | 'Loom') => this.#options?.playsInPage?.(provider) ?? playsInPage(provider, window.location.protocol),
      openExternal: (href: string) => this.#options?.onOpenFile?.(href),
    };
  }

  /** Whether the page has had the caret since it opened. */
  hasCaret(): boolean {
    return this.#hadCaret;
  }

  /**
   * Puts a canvas embed in the page, as one edit: at the caret, as media goes
   * in, or at the end of a page that has had no caret since it opened,
   * before its empty last line and its notes.
   */
  insertEmbed(attrs: { frame: string; page: string | null; src: string; alt: string }): void {
    const view = this.view;
    if (!view) return;
    const node = schema.nodes.embed.create(attrs);
    if (this.#hadCaret) {
      this.#insertBlocks([node]);
      return;
    }
    // Before the notes, and before the empty line the page always ends with.
    const { doc } = view.state;
    let end = doc.content.size;
    if (doc.lastChild?.type === schema.nodes.footnotes) end -= doc.lastChild.nodeSize;
    const before = doc.resolve(end).nodeBefore;
    if (before?.type === schema.nodes.paragraph && before.content.size === 0) end -= before.nodeSize;
    this.#insertBlocks([node], end);
  }

  /**
   * Puts attachments into the page as media blocks, in order, as one edit: at
   * the caret (an empty line is replaced; a line is split, or they go beside
   * it at its ends), or where they were dropped (`pos`), between blocks. The
   * caret then waits on the line after them.
   */
  insertMedia(names: string[], pos?: number): void {
    const here = this.#space.here ?? '';
    this.#insertBlocks(names.map((name) => attachmentBlock(here, name)), pos);
  }

  /** Blocks put in at the caret or at `pos`, as `insertMedia` puts them; the caret after them, or (`caretIn`) at the end of the last. */
  #insertBlocks(nodes: Node[], pos?: number, caretIn = false): boolean {
    const view = this.view;
    if (!view || this.locked || nodes.length === 0) return false;
    const slice = new Slice(Fragment.from(nodes), 0, 0);
    const tr = view.state.tr;
    const { selection } = view.state;
    const $from = selection.$from;
    let at: number | null = pos ?? null;
    if (at === null && selection.empty && $from.parent.type === schema.nodes.paragraph) {
      const line = $from.parent;
      const holder = $from.node(-1);
      const index = $from.index(-1);
      if (line.content.size === 0 && holder.canReplace(index, index + 1, Fragment.from(nodes)) && !(holder.type === schema.nodes.list_item && index === 0)) {
        tr.replaceWith($from.before(), $from.after(), nodes);
        at = -1;
      } else if ($from.parentOffset === line.content.size) at = $from.after();
      else if ($from.parentOffset === 0) at = $from.before();
    }
    if (at === null) tr.replaceSelection(slice);
    else if (at >= 0) {
      const target = dropPoint(tr.doc, at, slice);
      if (target === null) return false;
      tr.insert(target, nodes);
    }
    // The caret waits on the line after them, to type on: the next line, or
    // a new one where no line follows.
    let after = -1;
    tr.doc.descendants((node, pos) => {
      if (after < 0 && node === nodes[nodes.length - 1]) after = pos + node.nodeSize;
      return after < 0;
    });
    if (after >= 0 && caretIn) tr.setSelection(TextSelection.create(tr.doc, after - 1));
    else if (after >= 0) {
      const $after = tr.doc.resolve(after);
      if ($after.nodeAfter?.isTextblock) tr.setSelection(TextSelection.create(tr.doc, after + 1));
      else {
        tr.insert(after, schema.nodes.paragraph.create());
        tr.setSelection(TextSelection.create(tr.doc, after + 1));
      }
    }
    view.dispatch(tr.scrollIntoView());
    view.focus();
    return true;
  }

  /**
   * A web address put in at the caret, as a paste of one alone on an empty
   * line: an online video, an image or a video file, or a link that becomes a
   * card once the page's details arrive (a separate edit: undone, it is the
   * link again). Left a link when they do not, or it was changed meanwhile.
   */
  insertAddress(address: string): void {
    const kind = onlineVideo(address) ? 'video' : mediaKind(address);
    if (kind) {
      this.#insertBlocks([schema.nodes[kind].create({ src: address, alt: '' })]);
      return;
    }
    const link = schema.nodes.paragraph.create(null, schema.text(address, [schema.marks.link.create({ href: address })]));
    if (!this.#insertBlocks([link], undefined, true)) return;
    void this.#options?.fetchCard?.(address).then((details) => {
      const view = this.view;
      if (!view || !details) return;
      let at = -1;
      view.state.doc.descendants((node, pos) => {
        if (at < 0 && node === link) at = pos;
        return at < 0;
      });
      if (at < 0) return;
      const card = schema.nodes.card.create({
        href: address,
        text: details.title || address,
        description: details.description || null,
        icon: details.icon || null,
        image: details.image || null,
      });
      view.dispatch(closeHistory(view.state.tr).replaceWith(at, at + link.nodeSize, card));
    });
  }

  /**
   * Finds the block at `pos` again later, after a wait (a dialog, a fetch):
   * where it is then, or null once it changed or went.
   */
  follow(pos: number): () => number | null {
    const node = this.view?.state.doc.nodeAt(pos);
    return () => {
      const view = this.view;
      if (!view || !node) return null;
      let at: number | null = null;
      view.state.doc.descendants((child, childPos) => {
        if (at === null && child === node) at = childPos;
        return at === null;
      });
      return at;
    };
  }

  /** Whether the block at `pos` is a line holding one plain link and nothing else, which can be a card. */
  loneLinkAt(pos: number): boolean {
    return this.#loneLink(pos) !== null;
  }

  #loneLink(pos: number): { href: string; title: string | null; text: string } | null {
    const node = this.view?.state.doc.nodeAt(pos);
    if (node?.type !== schema.nodes.paragraph || node.childCount !== 1) return null;
    const only = node.firstChild!;
    const link = only.marks.length === 1 && only.marks[0].type === schema.marks.link ? only.marks[0] : null;
    return only.isText && link ? { href: link.attrs.href as string, title: (link.attrs.title as string | null) ?? null, text: only.text! } : null;
  }

  /** Shows the lone link at `pos` as a card, as one edit. */
  linkToCard(pos: number): void {
    const view = this.view;
    const link = this.#loneLink(pos);
    if (!view || this.locked || !link) return;
    const node = view.state.doc.nodeAt(pos)!;
    // The line's colours and unknown keys go on with the card, as written.
    const a = node.attrs;
    const keys = [a.color ? `color=${a.color}` : '', a.background ? `background=${a.background}` : '', a.extra ?? ''].filter(Boolean).join(' ');
    view.dispatch(view.state.tr.replaceWith(pos, pos + node.nodeSize, schema.nodes.card.create({ ...link, extra: keys || null })));
  }

  /** Shows the card at `pos` as a plain link, as one edit; its saved details go with its mark. */
  cardToLink(pos: number): void {
    const view = this.view;
    const node = view?.state.doc.nodeAt(pos);
    if (!view || this.locked || node?.type !== schema.nodes.card) return;
    const mark = schema.marks.link.create({ href: node.attrs.href, title: node.attrs.title });
    // Its unknown keys stay, as a line's; its saved details go with its look.
    const line = schema.nodes.paragraph.create(lineMark(node.attrs.extra as string | null), schema.text(node.attrs.text as string, [mark]));
    view.dispatch(view.state.tr.replaceWith(pos, pos + node.nodeSize, line));
  }

  /** The video drawn for the block at `pos`, to take its frame; null for any other block. */
  videoAt(pos: number): HTMLVideoElement | null {
    const dom = this.view?.nodeDOM(pos);
    return dom instanceof HTMLElement ? dom.querySelector('video') : null;
  }

  /** The place in the page at a point on screen, for a drop; null outside it. */
  posAtPoint(x: number, y: number): number | null {
    try {
      return this.view?.posAtCoords({ left: x, top: y })?.pos ?? null;
    } catch {
      // A point the page cannot place: at the caret instead.
      return null;
    }
  }

  /** Changes the settings or address of the image, video or card at `pos`, as one edit. */
  setMediaAttrs(pos: number, attrs: Record<string, unknown>): void {
    const view = this.view;
    const node = view?.state.doc.nodeAt(pos);
    if (!view || this.locked || !node || ![schema.nodes.image, schema.nodes.video, schema.nodes.embed, schema.nodes.card].includes(node.type)) return;
    view.dispatch(view.state.tr.setNodeMarkup(pos, null, { ...node.attrs, ...attrs }));
  }

  /** Closes the menus that follow typing (`/`, `@`, emoji by name), as Escape does: a press outside the page. */
  dismissSuggestions(): void {
    const view = this.view;
    if (!view) return;
    const open = [slashKey, mentionKey, emojiKey].filter((key) => (key.getState(view.state) as { open?: unknown } | undefined)?.open);
    if (open.length === 0) return;
    const tr = view.state.tr;
    for (const key of open) tr.setMeta(key, { dismiss: true });
    view.dispatch(tr);
  }

  /** Where this page sits in its Space (null outside one), and the Space's pages once read. */
  setSpacePages(here: string | null, pages: PageRef[] | null): void {
    this.#space = { here, pages };
    // An open `@` menu shows the pages that have just arrived.
    if (this.view && mentionKey.getState(this.view.state) !== undefined) this.view.dispatch(this.view.state.tr.setMeta(mentionKey, {}));
  }

  /** Chooses the `@` item at `index`, picked with the pointer. */
  chooseMention(index: number): void {
    if (this.view) chooseMention(this.view, index, this.#space.here);
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
    // A block with nothing to put a caret in (an image, a card) is selected whole.
    if (node.isAtom && NodeSelection.isSelectable(node)) {
      view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, pos)));
      return;
    }
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
    return textWithoutEndLine(state.doc, from, to, (leaf) => leaf.type.spec.leafText?.(leaf) ?? ' ');
  }

  /**
   * Pastes text: tab-separated rows (spreadsheet cells) as table cells, a
   * single line as it is, anything longer read as Markdown, so pasted
   * Markdown arrives formatted and never as the marks themselves.
   */
  paste(text: string): void {
    const view = this.view;
    if (!view || this.locked) return;
    if (this.#pasteHeadingLink(text)) return;
    if (this.#pasteAddress(text)) return;
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
