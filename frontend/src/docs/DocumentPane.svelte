<script lang="ts">
  /**
   * The Document pane: the page header, find and replace, and the editor with
   * its `/` menu, formatting bubble and block handle. It owns the editor,
   * mounted once and destroyed in the cleanup (.ai/rules/editors.md); the app
   * hands it pages and asks it for the Markdown back.
   */
  import { onMount } from 'svelte';
  import BlockHandle from '../components/BlockHandle.svelte';
  import ContextMenu from '../components/ContextMenu.svelte';
  import FindBar from '../components/FindBar.svelte';
  import FormatBubble from '../components/FormatBubble.svelte';
  import LinkField from '../components/LinkField.svelte';
  import PageHeader from '../components/PageHeader.svelte';
  import SlashMenu from '../components/SlashMenu.svelte';
  import type { MenuNode } from '../canvas/context-menu';
  import { SWATCHES } from '../canvas/palette';
  import { t } from '../i18n/t';
  import type { MessageKey } from '../i18n/messages';
  import { commands, type BlockKind } from './commands';
  import { DocEditor } from './editor';
  import type { PageSettings } from './markdown';
  import type { SlashInfo } from './slash';
  import { pageWidth } from './page-settings';

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
  };

  let { crumbs, spaceWidth, appWidth, onEdit, onCounts, onDuplicatePage, onTrashPage }: Props = $props();

  const editor = new DocEditor();
  let host: HTMLDivElement;
  let scroller: HTMLDivElement;

  let settings = $state.raw<PageSettings>({});
  let slash = $state.raw<SlashInfo | null>(null);
  let bubble = $state.raw<{ left: number; top: number } | null>(null);
  // Alt+F10 moved focus into the bubble: it stays while focus is there.
  let bubbleHeld = false;
  let bubbleFocus = $state.raw(0);
  let marks = $state.raw<ReturnType<DocEditor['activeMarks']>>(editor.activeMarks());
  let hovered = $state.raw<{ pos: number; left: number; top: number } | null>(null);
  let menu = $state.raw<{ items: MenuNode[]; anchor: { x: number; y: number }; run: (id: string) => void } | null>(null);
  let finding = $state.raw(false);
  let findFocus = $state.raw<{ field: 'find' | 'replace'; at: number }>({ field: 'find', at: 0 });
  let found = $state.raw({ count: 0, index: -1 });
  let link = $state.raw<{ left: number; top: number; value: string } | null>(null);
  let dragging: number | null = null;

  const width = $derived(pageWidth(settings.width, spaceWidth, appWidth));
  const widthValue = $derived(width === 'narrow' ? 'var(--size-page-narrow)' : width === 'full' ? '100%' : 'var(--size-page-wide)');

  function refreshSelection() {
    onCounts(editor.counts());
    marks = editor.activeMarks();
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

  /** Shows a page, with fresh undo, and closes anything open over the last one. */
  export function setPage(markdown: string) {
    editor.setPage(markdown);
    settings = editor.settings;
    slash = null;
    bubble = null;
    menu = null;
    link = null;
    hovered = null;
    onCounts(editor.counts());
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

  const turnInto: MenuNode[] = [
    item('turn:paragraph', t('slash.paragraph')),
    item('turn:heading:1', t('slash.heading1')),
    item('turn:heading:2', t('slash.heading2')),
    item('turn:heading:3', t('slash.heading3')),
    item('turn:bullet_list', t('slash.bullet')),
    item('turn:ordered_list', t('slash.numbered')),
    item('turn:todo', t('slash.todo')),
    item('turn:blockquote', t('slash.quote')),
  ];

  function runTurn(id: string) {
    const [, kind, level] = id.split(':');
    editor.run(commands.turnInto(kind as BlockKind, Number(level) || 1));
  }

  /** The block menu, for the hovered block or (from ⌘/) the one at `pos`. */
  function openBlockMenu(anchor: { x: number; y: number }, pos = hovered?.pos) {
    if (pos === undefined || editor.locked) return;
    editor.selectBlock(pos);
    menu = {
      anchor,
      items: [
        { kind: 'submenu', id: 'turn', label: t('block.turnInto'), items: turnInto },
        item('duplicate', t('block.duplicate')),
        item('delete', t('block.delete')),
        { kind: 'separator' },
        { kind: 'submenu', id: 'color', label: t('block.color'), items: colours('color', 'swatch.default') },
        { kind: 'submenu', id: 'background', label: t('block.background'), items: colours('background', 'bubble.none') },
      ],
      run: (id) => {
        if (id.startsWith('turn:')) runTurn(id);
        else if (id === 'duplicate') editor.run(commands.duplicateBlock);
        else if (id === 'delete') editor.run(commands.deleteBlock);
        else if (id.startsWith('color:')) editor.run(commands.blockColor({ color: id.slice(6) || null }));
        else if (id.startsWith('background:')) editor.run(commands.blockColor({ background: id.slice(11) || null }));
      },
    };
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
    if (command === 'turnInto') menu = { anchor, items: turnInto, run: runTurn };
    else if (command === 'textColor') menu = { anchor, items: colours('text', 'swatch.default'), run: (id) => editor.run(commands.textColor(id.slice(5) || null)) };
    else if (command === 'highlight') menu = { anchor, items: colours('mark', 'bubble.none'), run: (id) => editor.run(commands.highlight(id.slice(5) || null)) };
    else if (command === 'link') openLink();
    else editor.run(commands[command as 'bold' | 'italic' | 'underline' | 'strike' | 'code']);
  }

  function openLink() {
    const at = editor.selectionRect();
    if (at) link = { ...at, value: '' };
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
    <div class="host" bind:this={host}></div>
    {#if hovered}
      <BlockHandle
        at={{ left: hovered.left, top: hovered.top }}
        onAdd={() => hovered && editor.addBlockAfter(hovered.pos)}
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
    items={slash.items.map((i) => ({ id: i.id, label: t(i.label) }))}
    active={slash.active}
    at={slash.at}
    onChoose={(id) => editor.chooseSlash(id)}
  />
{/if}

{#if bubble && !slash && !link}
  <FormatBubble
    at={bubble}
    active={marks}
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

  .host {
    min-height: 100%;
  }
</style>
