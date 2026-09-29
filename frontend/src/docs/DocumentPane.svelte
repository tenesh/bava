<script lang="ts">
  /**
   * The Document pane: the page header, find and replace, and the editor with
   * its `/` menu, formatting bubble and block handle. It owns the editor,
   * mounted once and destroyed in the cleanup (.ai/rules/editors.md); the app
   * hands it pages and asks it for the Markdown back.
   */
  import { onMount, untrack } from 'svelte';
  import BlockHandle from '../components/BlockHandle.svelte';
  import { currentPlatform, modifierName } from '../shell/shortcuts';
  import ContextMenu from '../components/ContextMenu.svelte';
  import FindBar from '../components/FindBar.svelte';
  import FormatBubble from '../components/FormatBubble.svelte';
  import LinkField from '../components/LinkField.svelte';
  import LinkCard from '../components/LinkCard.svelte';
  import DatePicker from '../components/DatePicker.svelte';
  import EquationField from '../components/EquationField.svelte';
  import EmojiPicker from '../components/EmojiPicker.svelte';
  import PageHeader from '../components/PageHeader.svelte';
  import SlashMenu from '../components/SlashMenu.svelte';
  import type { MenuNode } from '../canvas/context-menu';
  import { SWATCHES } from '../canvas/palette';
  import { t } from '../i18n/t';
  import type { MessageKey } from '../i18n/messages';
  import { commands, turnIntoChoices, type BlockKind } from './commands';
  import { DocEditor, type LinkCard as LinkCardInfo } from './editor';
  import type { PageSettings } from './markdown';
  import type { SlashInfo } from './slash';
  import { pageWidth } from './page-settings';
  import { CUSTOM_DEFAULT, callouts } from './callout';
  import { math, renderTex, type EquationAt } from './math';
  import { tables } from './table';
  import type { Command } from 'prosemirror-state';
  import { loadEmoji, type Emoji, type EmojiInfo } from './emoji';
  import type { MentionInfo, MentionItem, PageRef } from './mention';
  import { linkTo, resolveLink, type Move } from './links';
  import { latestReads } from './reads';
  import { backlinks as findBacklinks, type PageText } from './page-links';
  import { formatDay } from './dates';
  import { isWeb, mediaUrl, videoFrame, type MediaPlace } from './media';
  import { cardMenuItems, mediaMenuItems, mediaSetting, posterName } from './media-menu';
  import { onlineVideo } from './online-video';
  import type { FileDetails } from './card';
  import MediaViewer from '../components/MediaViewer.svelte';
  import { LANGUAGES } from '../canvas/code/languages';

  type Props = {
    /** The page's folders, then its name; empty with no page open. */
    crumbs: string[];
    /** The Space's page width, used when the page sets none; empty when it sets none either. */
    spaceWidth: string;
    /** The app's page width, used when neither the page nor the Space sets one. */
    appWidth: string;
    /** The user changed the page. */
    onEdit: () => void;
    /** The page's words and characters, or the selection's. */
    onCounts: (counts: { words: number; characters: number }) => void;
    onDuplicatePage: () => void;
    onTrashPage: () => void;
    /** Text for the clipboard: a code block's Copy. */
    onCopyText: (text: string) => void;
    /** This page's path in its Space; null outside a Space. */
    here: string | null;
    /** The folder the user opened that holds this page, where its images and videos load from; null with no page. */
    mediaPlace: MediaPlace | null;
    /** The Space's pages, with their text when `withText` is set; null when they could not be read. */
    readIndex: (withText: boolean) => Promise<PageText[] | null>;
    /** A link followed: the app opens it. */
    onFollow: (href: string) => void;
    /** A page of the Space to open, by its path. */
    onOpenPage: (path: string) => void;
    /** `/` Image or Video: the app asks for files, then adds them (`insertMedia`). */
    onChooseMedia: (kind: 'image' | 'video' | 'file') => void;
    /** A card clicked, or an online video that plays in the browser: the app opens its address, as written in the page. */
    onOpenFile: (href: string) => void;
    /** A file's size and date, for its card. */
    fileDetails: (root: string, path: string) => Promise<FileDetails>;
    /** A web card's details, fetched when its link is pasted or refreshed; null when they could not be. */
    fetchCard: (address: string) => Promise<{ title: string; description: string; icon: string; image: string } | null>;
    /** A paste with no text: the app looks for an image on the clipboard. */
    onPasteImage: () => void;
    /** A medium's file replaced: the app asks for one and attaches it; its name, or null. */
    onReplaceMedia: (kind: 'image' | 'video' | 'file') => Promise<string | null>;
    /** An attachment renamed; the app follows it in every page. */
    onRenameAttachment: (name: string, next: string) => void;
    /** A file of the Space shown in its folder, by its path in the Space. */
    onRevealFile: (path: string) => void;
    /** A video's frame kept as its poster: bytes in base64 and a name; the name it was saved under, or null. */
    onAttachPoster: (data: string, name: string) => Promise<string | null>;
    /** Something could not be done. */
    onNotify: (message: string) => void;
  };

  let { crumbs, spaceWidth, appWidth, onEdit, onCounts, onDuplicatePage, onTrashPage, onCopyText, here, mediaPlace, readIndex, onFollow, onOpenPage, onChooseMedia, onOpenFile, fileDetails, fetchCard, onPasteImage, onReplaceMedia, onRenameAttachment, onRevealFile, onAttachPoster, onNotify }: Props = $props();

  const editor = new DocEditor();
  let host: HTMLDivElement;
  let scroller: HTMLDivElement;

  let settings = $state.raw<PageSettings>({});
  let slash = $state.raw<SlashInfo | null>(null);
  let bubble = $state.raw<{ left: number; top: number } | null>(null);
  // Alt+F10 moved focus into the bubble: it stays while focus is there.
  let bubbleHeld = false;
  let bubbleFocus = $state.raw(0);
  let turnable = $state.raw(true);
  let marks = $state.raw<ReturnType<DocEditor['activeMarks']>>(editor.activeMarks());
  let hovered = $state.raw<{ pos: number; left: number; top: number } | null>(null);
  let menu = $state.raw<{ items: MenuNode[]; anchor: { x: number; y: number }; run: (id: string) => void } | null>(null);
  let finding = $state.raw(false);
  let findFocus = $state.raw<{ field: 'find' | 'replace'; at: number }>({ field: 'find', at: 0 });
  let found = $state.raw({ count: 0, index: -1 });
  let emojiSuggest = $state.raw<EmojiInfo | null>(null);
  let mention = $state.raw<MentionInfo | null>(null);
  let linkCard = $state.raw<LinkCardInfo | null>(null);
  let dateChip = $state.raw<{ pos: number; at: { left: number; bottom: number }; date: string } | null>(null);
  let backlinks = $state.raw<PageRef[]>([]);
  let picker = $state.raw<{ at: { left: number; top: number; bottom: number }; pick: (emoji: string) => void } | null>(null);
  let emojiList = $state.raw<Emoji[]>([]);
  let equation = $state.raw<{ pos: number; at: EquationAt; value: string; display: boolean } | null>(null);
  let link = $state.raw<{ left: number; top: number; value: string } | null>(null);
  // A medium's caption or its file's new name, asked for beside it.
  let mediaField = $state.raw<{ kind: 'caption' | 'rename' | 'weblink' | 'onlinevideo'; pos: number; left: number; top: number; value: string } | null>(null);
  let viewer = $state.raw<{ src: string; alt: string } | null>(null);
  let dragging: number | null = null;

  // The `@` menu links from wherever this page now is, and the page's links
  // and "Linked from" are read again for it.
  $effect(() => {
    void here;
    untrack(() => void refreshLinks());
  });

  // Images and videos load from the folder the page sits in, followed as it moves.
  $effect(() => {
    editor.setMediaPlace(mediaPlace);
  });

  const reads = latestReads();

  /**
   * Reads the Space's pages, and what links here, again: when a page opens,
   * the window regains focus, pages move, and (pages only) each time the `@`
   * menu opens. A read that fails keeps what was shown.
   */
  export async function refreshLinks(withBacklinks = true) {
    const asked = here;
    const read = reads.start(withBacklinks);
    if (asked === null) {
      editor.setSpacePages(null, null);
      backlinks = [];
      return;
    }
    const pages = await readIndex(withBacklinks);
    if (here !== asked || !pages) return;
    if (read.pagesCurrent()) editor.setSpacePages(asked, pages);
    if (read.backlinksCurrent()) backlinks = findBacklinks(pages, asked);
  }

  /** The open page's text as it is now, saved or not; null before a page is shown. */
  export function currentMarkdown(): string | null {
    return editor.markdown();
  }

  /** Adds attachments as media blocks: where files were dropped (`at`, a point on screen), else at the caret. */
  export function insertMedia(names: string[], at?: { x: number; y: number }) {
    editor.insertMedia(names, at ? (editor.posAtPoint(at.x, at.y) ?? undefined) : undefined);
  }

  /** Rewrites this page's links after pages moved; `page` is where it was. */
  export function followMoves(page: string, moves: Move[]) {
    editor.followMoves(page, moves);
  }

  /** Shows the heading an anchor names (`#goals`); false when the page has none. */
  export function goToAnchor(anchor: string): boolean {
    return editor.goToAnchor(anchor);
  }

  function mentionRow(entry: MentionItem, index: number) {
    if (entry.kind === 'page') {
      const folder = entry.path.includes('/') ? entry.path.slice(0, entry.path.lastIndexOf('/')) : undefined;
      return { id: String(index), label: entry.name, detail: folder, group: t('mention.group.pages') };
    }
    const day = formatDay(entry.date);
    return entry.word
      ? { id: String(index), label: t(`mention.${entry.word}`), detail: day, group: t('mention.group.dates') }
      : { id: String(index), label: day, group: t('mention.group.dates') };
  }

  const width = $derived(pageWidth(settings.width, spaceWidth, appWidth));
  const widthValue = $derived(width === 'narrow' ? 'var(--size-page-narrow)' : width === 'full' ? '100%' : 'var(--size-page-wide)');

  function refreshSelection() {
    onCounts(editor.counts());
    marks = editor.activeMarks();
    turnable = turnIntoChoices(editor.currentKind()).length > 0;
    bubble = editor.locked ? null : (editor.selectionRect() ?? (bubbleHeld ? bubble : null));
  }

  onMount(() => {
    editor.mount(host, {
      onChange: () => {
        // The handle's block moved with the edit; it comes back on the next pointer move.
        hovered = null;
        settings = editor.settings;
        onEdit();
        refreshSelection();
      },
      onSelection: refreshSelection,
      onSlash: (info) => (slash = info),
      onLink: openLink,
      onCopy: (text) => onCopyText(text),
      onTableMenu: (anchor) => {
        if (!editor.locked) menu = { anchor, items: tableItems(), run: runTable };
      },
      onEmoji: (info) => (emojiSuggest = info),
      onMention: (info) => (mention = info),
      onMentionPages: () => void refreshLinks(false),
      onLinkCard: (card) => (linkCard = card),
      onFollow: (href) => onFollow(href),
      onChooseMedia: (kind) => onChooseMedia(kind),
      onOpenFile: (href) => onOpenFile(href),
      fileDetails: (root, path) => fileDetails(root, path),
      fetchCard: (address) => fetchCard(address),
      onAskAddress: (kind, at) => {
        if (!editor.locked) mediaField = { kind, pos: -1, left: at.left, top: at.bottom, value: '' };
      },
      onPasteImage: () => onPasteImage(),
      onDateChip: (pos, at, date) => {
        if (!editor.locked) dateChip = { pos, at, date };
      },
      onEmojiPicker: (at) => openPicker(at, (emoji) => editor.insertText(emoji)),
      onEquation: (pos, at) => {
        const block = editor.blockInfo(pos);
        if (!block || editor.locked) return;
        equation = { pos, at, value: String(block.attrs.tex ?? ''), display: block.type === 'math_block' };
      },
      onCodeLanguage: (pos, anchor) => {
        menu = {
          anchor,
          items: [item('lang:', t('code.plain')), { kind: 'separator' }, ...LANGUAGES.map((language) => item(`lang:${language.name}`, language.label))],
          run: (id) => editor.setCodeLanguage(pos, id.slice(5)),
        };
      },
      onBlockMenu: () => {
        const block = editor.caretBlock();
        if (block) openBlockMenu({ x: block.left, y: block.bottom }, block.pos);
      },
      onBubble: () => {
        if (!bubble) return;
        bubbleHeld = true;
        bubbleFocus += 1;
      },
    });
    return () => editor.destroy();
  });

  // ---- what the app calls -------------------------------------------------

  /**
   * Shows a page, with fresh undo, and closes anything open over the last
   * one; `page` names it for remembering its folds on this computer.
   */
  export function setPage(markdown: string, page: string | null = null) {
    editor.setPage(markdown, page);
    settings = editor.settings;
    slash = null;
    equation = null;
    emojiSuggest = null;
    mention = null;
    linkCard = null;
    dateChip = null;
    picker = null;
    bubble = null;
    menu = null;
    link = null;
    hovered = null;
    onCounts(editor.counts());
    void refreshLinks();
  }

  export const markdown = () => editor.markdown();
  export const undo = () => editor.undo();
  export const redo = () => editor.redo();
  export const selectAll = () => editor.selectAll();
  export const selectedText = () => editor.selectedText();
  export const deleteSelection = () => editor.deleteSelection();
  export const paste = (text: string) => editor.paste(text);

  /** Opens find, or Find and Replace with the caret in the replace field. */
  export function openFind(replace = false) {
    finding = true;
    findFocus = { field: replace ? 'replace' : 'find', at: findFocus.at + 1 };
  }

  // ---- menus ---------------------------------------------------------------

  const item = (id: string, label: string): MenuNode => ({ kind: 'item', id, label, keys: '' });
  const colours = (prefix: string, none: MessageKey): MenuNode[] => [
    item(`${prefix}:`, t(none)),
    ...SWATCHES.map((name) => item(`${prefix}:${name}`, t(`swatch.${name}` as MessageKey))),
  ];

  const TURN_LABELS: Record<string, MessageKey> = {
    paragraph: 'slash.paragraph',
    'heading:1': 'slash.heading1',
    'heading:2': 'slash.heading2',
    'heading:3': 'slash.heading3',
    'heading:4': 'slash.heading4',
    'heading:5': 'slash.heading5',
    'heading:6': 'slash.heading6',
    bullet_list: 'slash.bullet',
    ordered_list: 'slash.numbered',
    todo: 'slash.todo',
  };

  /** What the caret's block can turn into: text and headings, or lists; empty for any other block. */
  function turnIntoItems(): MenuNode[] {
    return turnIntoChoices(editor.currentKind()).map((kind) => item(`turn:${kind}`, t(TURN_LABELS[kind])));
  }

  function runTurn(id: string) {
    const [, kind, level] = id.split(':');
    if (kind === 'bullet_list' || kind === 'ordered_list' || kind === 'todo') editor.run(commands.switchList(kind));
    else editor.run(commands.turnInto(kind as BlockKind, Number(level) || 1));
  }

  /** The table menu, for the cell or cells selected: only what can be done there. */
  function tableItems(): MenuNode[] {
    const table = editor.tableState();
    const separator: MenuNode = { kind: 'separator' };
    const when = (on: boolean, node: MenuNode) => (on ? [node] : []);
    const moves = [
      ...when(table.canMoveRowUp, item('t:moveRowUp', t('table.moveRowUp'))),
      ...when(table.canMoveRowDown, item('t:moveRowDown', t('table.moveRowDown'))),
      ...when(table.canMoveColumnLeft, item('t:moveColumnLeft', t('table.moveColumnLeft'))),
      ...when(table.canMoveColumnRight, item('t:moveColumnRight', t('table.moveColumnRight'))),
    ];
    const cells = [
      ...when(table.canMerge, item('t:merge', t('table.merge'))),
      ...when(table.canSplit, item('t:split', t('table.split'))),
    ];
    return [
      item('t:rowAbove', t('table.rowAbove')),
      item('t:rowBelow', t('table.rowBelow')),
      item('t:columnLeft', t('table.columnLeft')),
      item('t:columnRight', t('table.columnRight')),
      ...(moves.length > 0 ? [separator, ...moves] : []),
      separator,
      ...cells,
      item('t:headerRow', t(table.headerRow ? 'table.headerRowOff' : 'table.headerRowOn')),
      item('t:headerColumn', t(table.headerColumn ? 'table.headerColumnOff' : 'table.headerColumnOn')),
      {
        kind: 'submenu',
        id: 't:align',
        label: t(table.columns > 1 ? 'table.alignColumns' : 'table.align'),
        items: [
          item('t:align:left', t('table.alignLeft')),
          item('t:align:center', t('table.alignCenter')),
          item('t:align:right', t('table.alignRight')),
          item('t:align:', t('table.alignNone')),
        ],
      },
      { kind: 'submenu', id: 't:color', label: t(table.cells > 1 ? 'table.colorCells' : 'table.color'), items: colours('t:color', 'bubble.none') },
      separator,
      item('t:deleteRow', t(table.rows > 1 ? 'table.deleteRows' : 'table.deleteRow')),
      item('t:deleteColumn', t(table.columns > 1 ? 'table.deleteColumns' : 'table.deleteColumn')),
      item('t:deleteTable', t('table.deleteTable')),
    ];
  }

  function runTable(id: string) {
    const [, action, value] = id.split(':');
    const simple: Record<string, Command> = {
      rowAbove: tables.rowAbove,
      rowBelow: tables.rowBelow,
      columnLeft: tables.columnLeft,
      columnRight: tables.columnRight,
      moveRowUp: tables.moveRow(-1),
      moveRowDown: tables.moveRow(1),
      moveColumnLeft: tables.moveColumn(-1),
      moveColumnRight: tables.moveColumn(1),
      merge: tables.merge,
      split: tables.split,
      headerRow: tables.headerRow,
      headerColumn: tables.headerColumn,
      deleteRow: tables.deleteRow,
      deleteColumn: tables.deleteColumn,
      deleteTable: tables.deleteTable,
    };
    if (action === 'align') editor.run(tables.align((value || null) as 'left' | 'center' | 'right' | null));
    else if (action === 'color') editor.run(tables.color(value || null));
    else if (simple[action]) editor.run(simple[action]);
  }

  /** Opens the emoji picker at `at`; the names load the first time. */
  function openPicker(at: { left: number; top: number; bottom: number }, pick: (emoji: string) => void) {
    picker = { at, pick };
    if (emojiList.length === 0) void loadEmoji().then((list) => (emojiList = list));
  }

  /** The block menu, for the hovered block or (from ⌘/) the one at `pos`. */
  function openBlockMenu(anchor: { x: number; y: number }, pos = hovered?.pos) {
    if (pos === undefined || editor.locked) return;
    const block = editor.blockInfo(pos);
    editor.selectBlock(pos);
    // An image, a video or a card turns into nothing.
    const turnOptions = block?.type === 'image' || block?.type === 'video' || block?.type === 'card' ? [] : turnIntoItems();
    // A callout's colour is its panel's; a text colour on it would be a second one.
    // A table's menu is the table's own.
    const media = block?.type === 'image' || block?.type === 'video' ? mediaFile(block.attrs.src as string) : null;
    const card = block?.type === 'card' ? mediaFile(block.attrs.href as string) : null;
    const styling: MenuNode[] =
      block && media
        ? mediaMenuItems(
            block.type as 'image' | 'video',
            block.attrs as { loop: boolean; muted: boolean; poster: string | null },
            media.attachment !== null,
            here !== null,
            isWeb(block.attrs.src as string),
            onlineVideo(block.attrs.src as string) !== null,
          )
        : block && card
        ? cardMenuItems({ web: isWeb(block.attrs.href as string), attachment: card.attachment !== null, inSpace: here !== null })
        : block?.type === 'table'
        ? tableItems()
        : block?.type === 'callout'
        ? [
            {
              kind: 'submenu',
              id: 'callout',
              label: t('callout.kind'),
              items: [
                ...(['info', 'note', 'success', 'warning', 'error'] as const).map((kind) => item(`kind:${kind}`, t(`slash.${kind}`))),
                item('kind:custom', t('callout.custom')),
              ],
            },
            ...(block.attrs.color
              ? [
                  {
                    kind: 'submenu',
                    id: 'panel',
                    label: t('callout.color'),
                    items: SWATCHES.map((name) => item(`panel:${name}`, t(`swatch.${name}` as MessageKey))),
                  } satisfies MenuNode,
                ]
              : []),
            ...(block.attrs.color ? [item('icon', t('callout.icon'))] : []),
          ]
        : [
            ...(block?.type === 'paragraph' && editor.loneLinkAt(pos) ? [item('c:tocard', t('card.toCard'))] : []),
            ...(block?.type === 'heading' ? [item('copylink', t('block.copyLink'))] : []),
            ...(block?.type === 'ordered_list'
              ? [
                  {
                    kind: 'submenu',
                    id: 'numbering',
                    label: t('block.numbering'),
                    items: (['1', 'a', 'i'] as const).map((style) => item(`numbering:${style}`, t(`numbering.${style}`))),
                  } satisfies MenuNode,
                ]
              : []),
            { kind: 'submenu', id: 'color', label: t('block.color'), items: colours('color', 'swatch.default') },
            { kind: 'submenu', id: 'background', label: t('block.background'), items: colours('background', 'bubble.none') },
          ];
    menu = {
      anchor,
      items: [
        ...(turnOptions.length > 0 ? [{ kind: 'submenu', id: 'turn', label: t('block.turnInto'), items: turnOptions } satisfies MenuNode] : []),
        item('addbefore', t('block.addBefore')),
        item('addafter', t('block.addAfter')),
        item('duplicate', t('block.duplicate')),
        item('delete', t('block.delete')),
        { kind: 'separator' },
        ...styling,
      ],
      run: (id) => {
        if (id.startsWith('m:')) void runMedia(pos, id, anchor);
        else if (id.startsWith('c:')) void runCard(pos, id, anchor);
        else if (id.startsWith('t:')) runTable(id);
        else if (id === 'kind:custom') editor.run(callouts.setColor(pos, (block?.attrs.color as string | null) ?? CUSTOM_DEFAULT.color));
        else if (id.startsWith('kind:')) editor.run(callouts.setKind(pos, id.slice(5)));
        else if (id.startsWith('panel:')) editor.run(callouts.setColor(pos, id.slice(6)));
        else if (id === 'icon') openPicker({ left: anchor.x, top: anchor.y, bottom: anchor.y }, (emoji) => editor.run(callouts.setIcon(pos, emoji)));
        else if (id === 'copylink') editor.copyHeadingLink(pos);
        else if (id.startsWith('numbering:')) editor.run(commands.listStyle(id.slice(10) as '1' | 'a' | 'i'));
        else if (id.startsWith('turn:')) runTurn(id);
        else if (id === 'addbefore' || id === 'addafter') editor.addBlockBeside(pos, id === 'addbefore' ? 'before' : 'after');
        else if (id === 'duplicate') editor.run(commands.duplicateBlock);
        else if (id === 'delete') editor.run(commands.deleteBlock);
        else if (id.startsWith('color:')) editor.run(commands.blockColor({ color: id.slice(6) || null }));
        else if (id.startsWith('background:')) editor.run(commands.blockColor({ background: id.slice(11) || null }));
      },
    };
  }

  const ATTACHMENTS = '.bava/attachments/';

  /** The file a medium's address reaches in the Space, and its name when it is an attachment. */
  function mediaFile(src: string): { target: string | null; attachment: string | null } {
    const target = mediaPlace ? (resolveLink(mediaPlace.here, src)?.target ?? null) : null;
    const attachment = here !== null && target?.startsWith(ATTACHMENTS) && !target.slice(ATTACHMENTS.length).includes('/') ? target.slice(ATTACHMENTS.length) : null;
    return { target, attachment };
  }

  async function runMedia(pos: number, id: string, anchor: { x: number; y: number }) {
    const block = editor.blockInfo(pos);
    if (!block || (block.type !== 'image' && block.type !== 'video')) return;
    const attrs = block.attrs;
    const setting = mediaSetting(id, attrs);
    const file = mediaFile(attrs.src as string);
    // Ark's menu may still focus itself in the frame an item is chosen: what
    // takes focus opens after that frame.
    if (id === 'm:caption' || id === 'm:rename' || id === 'm:fullscreen') await new Promise((next) => requestAnimationFrame(next));
    if (setting) editor.setMediaAttrs(pos, setting);
    else if (id === 'm:caption') mediaField = { kind: 'caption', pos, left: anchor.x, top: anchor.y, value: (attrs.caption as string | null) ?? '' };
    else if (id === 'm:rename' && file.attachment) mediaField = { kind: 'rename', pos, left: anchor.x, top: anchor.y, value: file.attachment.replace(/\.[^.]*$/, '') };
    else if (id === 'm:reveal' && file.target) onRevealFile(file.target);
    else if (id === 'm:open') onOpenFile(attrs.src as string);
    else if (id === 'm:fullscreen') {
      const src = mediaUrl(mediaPlace, attrs.src as string);
      if (src) viewer = { src, alt: attrs.alt as string };
    } else if (id === 'm:replace') {
      const now = editor.follow(pos);
      const name = await onReplaceMedia(block.type);
      const at = now();
      if (name && at !== null) editor.setMediaAttrs(at, { src: linkTo(here ?? '', ATTACHMENTS + name, '') });
    } else if (id === 'm:poster') {
      const video = editor.videoAt(pos);
      const frame = video ? videoFrame(video) : null;
      if (!frame) {
        onNotify(t('media.posterFailed'));
        return;
      }
      // A name that could not be saved was said already.
      const now = editor.follow(pos);
      const name = await onAttachPoster(frame, posterName(attrs.src as string));
      const at = now();
      if (name && at !== null) editor.setMediaAttrs(at, { poster: name });
    }
  }

  async function runCard(pos: number, id: string, anchor: { x: number; y: number }) {
    if (id === 'c:tocard') {
      editor.linkToCard(pos);
      return;
    }
    const block = editor.blockInfo(pos);
    if (block?.type !== 'card') return;
    const href = block.attrs.href as string;
    const file = mediaFile(href);
    if (id === 'c:rename') await new Promise((next) => requestAnimationFrame(next));
    if (id === 'c:look:link') editor.cardToLink(pos);
    else if (id === 'c:look:card' || id === 'c:look:extended') editor.setMediaAttrs(pos, { look: id.slice(7) });
    else if (id === 'c:reveal' && file.target) onRevealFile(file.target);
    else if (id === 'c:rename' && file.attachment) mediaField = { kind: 'rename', pos, left: anchor.x, top: anchor.y, value: file.attachment.replace(/\.[^.]*$/, '') };
    else if (id === 'c:replace' || id === 'c:refresh') {
      // What the card holds may move while the dialog or the site answers.
      const now = editor.follow(pos);
      if (id === 'c:replace') {
        const name = await onReplaceMedia('file');
        const at = now();
        if (name && at !== null) editor.setMediaAttrs(at, { href: linkTo(here ?? '', ATTACHMENTS + name, ''), text: name });
        return;
      }
      const details = await fetchCard(href);
      const at = now();
      if (!details) onNotify(t('card.refreshFailed'));
      else if (at !== null) editor.setMediaAttrs(at, { description: details.description || null, icon: details.icon || null, image: details.image || null });
    }
  }

  /** The address typed for `/` Web link or Online video, put in at the caret. */
  function applyAddress(kind: 'weblink' | 'onlinevideo', value: string) {
    const address = value.trim();
    if (!/^https?:\/\/\S+$/i.test(address)) onNotify(t('media.notAddress'));
    else if (kind === 'onlinevideo' && !onlineVideo(address)) onNotify(t('media.notOnlineVideo'));
    else editor.insertAddress(address);
  }

  function applyMediaField(value: string) {
    const field = mediaField;
    mediaField = null;
    if (!field) return;
    if (field.kind === 'weblink' || field.kind === 'onlinevideo') {
      if (value.trim() !== '') applyAddress(field.kind, value);
      editor.focus();
      return;
    }
    if (field.kind === 'caption') editor.setMediaAttrs(field.pos, { caption: value.trim() === '' ? null : value });
    else {
      const attrs = editor.blockInfo(field.pos)?.attrs;
      const attachment = mediaFile((attrs?.src ?? attrs?.href) as string).attachment;
      if (attachment && value.trim() !== '' && value.trim() !== attachment.replace(/\.[^.]*$/, '')) onRenameAttachment(attachment, value.trim());
    }
    editor.focus();
  }

  function openPageMenu(anchor: { x: number; y: number }) {
    const widths: MenuNode[] = [
      item('width:', t('doc.widthDefault')),
      item('width:narrow', t('width.narrow')),
      item('width:wide', t('width.wide')),
      item('width:full', t('width.full')),
    ];
    menu = {
      anchor,
      items: [
        item('lock', editor.locked ? t('doc.unlock') : t('doc.lock')),
        { kind: 'submenu', id: 'width', label: t('doc.width'), items: widths },
        { kind: 'separator' },
        item('duplicate', t('doc.duplicatePage')),
        item('trash', t('doc.trashPage')),
      ],
      run: (id) => {
        if (id === 'lock') editor.setSettings({ locked: !editor.locked });
        else if (id.startsWith('width:')) editor.setSettings({ width: id.slice(6) || undefined });
        else if (id === 'duplicate') onDuplicatePage();
        else if (id === 'trash') onTrashPage();
        settings = editor.settings;
      },
    };
  }

  function bubbleCommand(command: string, anchor: { x: number; y: number }) {
    bubbleHeld = false;
    if (command === 'turnInto') menu = { anchor, items: turnIntoItems(), run: runTurn };
    else if (command === 'textColor') menu = { anchor, items: colours('text', 'swatch.default'), run: (id) => editor.run(commands.textColor(id.slice(5) || null)) };
    else if (command === 'highlight') menu = { anchor, items: colours('mark', 'bubble.none'), run: (id) => editor.run(commands.highlight(id.slice(5) || null)) };
    else if (command === 'link') openLink();
    else editor.run(commands[command as 'bold' | 'italic' | 'underline' | 'strike' | 'code']);
  }

  /** Closes the link card, then acts on the link it showed. */
  function closeCard(then?: (card: LinkCardInfo) => void) {
    const card = linkCard;
    linkCard = null;
    if (card) then?.(card);
  }

  /** The calendar's pick: the chip it opened for takes the day. */
  function pickDate(day: string) {
    const chip = dateChip;
    dateChip = null;
    if (!chip) return;
    editor.setDate(chip.pos, day);
    editor.focus();
  }

  function openLink(value = '') {
    const at = editor.selectionRect();
    if (at) link = { ...at, value };
  }

  function applyLink(value: string) {
    editor.run(commands.link(value.trim() || null));
    link = null;
  }

  // ---- the handle ----------------------------------------------------------

  function pointerMove(event: PointerEvent) {
    if (editor.locked || dragging !== null) return;
    const block = editor.blockAt(event.clientX + 1, event.clientY);
    if (!block) return;
    const pane = scroller.getBoundingClientRect();
    hovered = { pos: block.pos, left: block.rect.left - pane.left, top: block.rect.top - pane.top + scroller.scrollTop };
  }
</script>

<div class="document-pane" style:--page-width={widthValue}>
  {#if crumbs.length > 0}
    <PageHeader {crumbs} locked={settings.locked === true} onMenu={openPageMenu} />
  {/if}
  {#if finding}
    <FindBar
      focus={findFocus}
      count={found.count}
      index={found.index}
      onFind={(text) => (found = editor.find(text))}
      onNext={() => (found = editor.findNext())}
      onPrevious={() => (found = editor.findPrevious())}
      onReplace={(text) => (found = editor.replace(text))}
      onReplaceAll={(text) => (found = editor.replaceAll(text))}
      onClose={() => {
        finding = false;
        found = editor.find('');
        editor.focus();
      }}
    />
  {/if}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="scroller"
    bind:this={scroller}
    onpointermove={pointerMove}
    onpointerleave={() => {
      if (dragging === null) hovered = null;
    }}
    ondragover={(event) => {
      if (dragging !== null) event.preventDefault();
    }}
    ondrop={(event) => {
      if (dragging === null) return;
      event.preventDefault();
      editor.dropBlock(dragging, event.clientX + 1, event.clientY);
      dragging = null;
    }}
  >
    <!-- Files from the desktop are taken here, and added where they land. -->
    <div class="host" bind:this={host} data-file-drop-target></div>
    {#if backlinks.length > 0}
      <nav class="backlinks" aria-label={t('backlinks.label')}>
        <h2>{t('backlinks.label')}</h2>
        <ul>
          {#each backlinks as page (page.path)}
            <li>
              <button type="button" onclick={() => onOpenPage(page.path)}>{page.name}</button>
              {#if page.path.includes('/')}
                <span class="folder">{page.path.slice(0, page.path.lastIndexOf('/'))}</span>
              {/if}
            </li>
          {/each}
        </ul>
      </nav>
    {/if}
    {#if hovered}
      <BlockHandle
        at={{ left: hovered.left, top: hovered.top }}
        alt={modifierName('optionoralt', currentPlatform())}
        onAdd={(before) => hovered && (before ? editor.addBlockBefore(hovered.pos) : editor.addBlockAfter(hovered.pos))}
        onMenu={openBlockMenu}
        onDragStart={(event) => {
          if (!hovered) return;
          dragging = hovered.pos;
          event.dataTransfer?.setData('text/plain', '');
          if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
        }}
        onDragEnd={() => (dragging = null)}
      />
    {/if}
  </div>
</div>

{#if slash}
  <SlashMenu
    items={slash.items.map((i) => ({ id: i.id, label: t(i.label), group: t(`slash.group.${i.group}`) }))}
    active={slash.active}
    at={slash.at}
    onChoose={(id) => editor.chooseSlash(id)}
  />
{/if}

{#if bubble && !slash && !link}
  <FormatBubble
    at={bubble}
    active={marks}
    {turnable}
    focus={bubbleFocus}
    onCommand={bubbleCommand}
    onLeave={() => {
      bubbleHeld = false;
      editor.focus();
    }}
    onBlur={() => {
      bubbleHeld = false;
      refreshSelection();
    }}
  />
{/if}

{#if mention}
  <SlashMenu
    label={t('mention.label')}
    items={mention.items.map(mentionRow)}
    active={mention.active}
    at={mention.at}
    onChoose={(id) => editor.chooseMention(Number(id))}
  />
{/if}

{#if emojiSuggest}
  <SlashMenu
    label={t('emoji.label')}
    items={emojiSuggest.items.map((e, i) => ({ id: String(i), label: `${e.emoji}  ${e.name}` }))}
    active={emojiSuggest.active}
    at={emojiSuggest.at}
    onChoose={(id) => editor.chooseEmoji(Number(id))}
  />
{/if}

{#if picker}
  {@const open = picker}
  <EmojiPicker
    at={open.at}
    emojis={emojiList}
    groupLabel={(group) => t(`emoji.group.${group}` as MessageKey)}
    onPick={(emoji) => {
      // Read before closing: `open` follows `picker`, and is gone once it is null.
      const { pick } = open;
      picker = null;
      pick(emoji);
    }}
    onClose={() => {
      picker = null;
      editor.focus();
    }}
  />
{/if}

{#if equation}
  {@const open = equation}
  <EquationField
    at={open.at}
    value={open.value}
    display={open.display}
    render={renderTex}
    onSave={(tex) => {
      // Read before closing: `open` follows `equation`, and is gone once it is null.
      const { pos } = open;
      equation = null;
      editor.run(math.setTex(pos, tex));
    }}
    onCancel={() => {
      const { pos, value } = open;
      equation = null;
      // A new equation left without TeX is not kept.
      if (value === '') editor.run(math.setTex(pos, ''));
      else editor.focus();
    }}
  />
{/if}

<!-- Each shows a copy of what it was opened for, so closing it never leaves it reading nothing. -->
{#each linkCard ? [linkCard] : [] as card (card)}
  <LinkCard
    at={card.at}
    href={card.href}
    missing={card.missing}
    relinkName={card.relink?.name ?? null}
    onOpen={() => closeCard((shown) => onFollow(shown.href))}
    onEdit={() =>
      closeCard((shown) => {
        editor.selectRange(shown.from, shown.to);
        openLink(shown.href);
      })}
    onRemove={() => closeCard((shown) => editor.removeLink(shown.from, shown.to))}
    onRelink={() => closeCard((shown) => shown.relink && editor.relink(shown.from, shown.to, shown.relink.path))}
    readOnly={editor.locked}
    focusFirst={card.focus}
    onClose={() => {
      closeCard();
      editor.focus();
    }}
  />
{/each}

{#each dateChip ? [dateChip] : [] as chip (chip)}
  <DatePicker
    at={chip.at}
    value={chip.date}
    onPick={pickDate}
    onClose={() => {
      dateChip = null;
      editor.focus();
    }}
  />
{/each}

{#if link}
  <LinkField
    at={link}
    value={link.value}
    onApply={applyLink}
    onRemove={() => applyLink('')}
    onCancel={() => {
      link = null;
      editor.focus();
    }}
  />
{/if}

{#if mediaField}
  <LinkField
    at={mediaField}
    value={mediaField.value}
    placeholder={t(mediaField.kind === 'caption' ? 'media.captionPlaceholder' : mediaField.kind === 'rename' ? 'media.renamePlaceholder' : 'media.address')}
    removeLabel={mediaField.kind === 'caption' && mediaField.value ? t('media.captionRemove') : null}
    onApply={applyMediaField}
    onRemove={() => applyMediaField('')}
    onCancel={() => {
      mediaField = null;
      editor.focus();
    }}
  />
{/if}

{#if viewer}
  <MediaViewer
    open
    src={viewer.src}
    alt={viewer.alt}
    onOpenChange={(open) => {
      if (!open) {
        viewer = null;
        editor.focus();
      }
    }}
  />
{/if}

<ContextMenu
  items={menu?.items ?? []}
  open={menu !== null}
  anchor={menu?.anchor ?? null}
  onSelect={(id) => {
    const run = menu?.run;
    menu = null;
    run?.(id);
  }}
  onOpenChange={(open) => {
    if (open) return;
    menu = null;
    // A field or the viewer the chosen item opened takes focus itself.
    if (mediaField || viewer) return;
    // Closed with nothing to give focus back to (a menu opened at a point has
    // no button), the page takes it from the closing menu.
    const active = document.activeElement;
    if (active === null || active === document.body || active.closest('.bava-menu')) editor.focus();
  }}
/>

<style>
  .document-pane {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .scroller {
    position: relative;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  /* A short page keeps "Linked from" at the bottom of the pane; a long one, after its end. */
  .scroller {
    display: flex;
    flex-direction: column;
  }

  .host {
    display: flex;
    flex: 1 0 auto;
    flex-direction: column;
  }

  .host > :global(.bava-doc) {
    flex: 1 0 auto;
    width: 100%;
    min-height: 0;
  }

  /* The page's text column, its rule as wide as the text. */
  .backlinks {
    box-sizing: border-box;
    width: calc(100% - 2 * var(--size-doc-gutter));
    max-width: var(--page-width, var(--size-page-wide));
    margin: 0 auto;
    padding: var(--space-4) 0 var(--space-8);
    border-top: var(--border-width) solid var(--color-border-subtle);
  }

  h2 {
    margin: 0 0 var(--space-2);
    font-size: var(--text-meta);
    font-weight: var(--weight-semibold);
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: var(--tracking-label);
  }

  ul {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    gap: var(--space-2);
    align-items: baseline;
  }

  li button {
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    font-size: var(--text-control);
    color: var(--color-accent);
    cursor: pointer;
  }

  li button:hover {
    text-decoration: underline;
  }

  li button:focus-visible {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
    border-radius: var(--radius-sm);
  }

  .folder {
    font-size: var(--text-meta);
    color: var(--color-text-muted);
  }
</style>
