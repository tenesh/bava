<script lang="ts">
  import { untrack } from 'svelte';
  /**
   * The Files tree of a Space: folders and pages, wrapping Ark's TreeView
   * (expand and collapse, arrow keys, typeahead, F2 to rename), with drag to
   * move and reorder added on top, which the TreeView does not do.
   *
   * Presentational: it shows the folders it is handed and reports what the user
   * did. Opening a page, and every file operation, is the caller's.
   */
  import { TreeView, useTreeView, createTreeCollection } from '@ark-ui/svelte';
  import ToolIcon from './ToolIcon.svelte';
  import { dropTarget, PENDING, treeRoot, zoneAt, type DropZone, type TreeNodeData } from '../files/tree';
  import type { EntryKind, SpaceEntry, TreeRow } from '../files/space.svelte';
  import { t } from '../i18n/t';

  type Props = {
    folders: Record<string, SpaceEntry[]>;
    rows: TreeRow[];
    expanded: string[];
    pending: { kind: EntryKind; folder: string; name?: string } | null;
    activePath: string | null;
    unsavedPath: string | null;
    /** A path to start renaming, from the right-click menu; the caller clears it. */
    renameRequest?: string | null;
    /** The row whose right-click menu is open, marked while it is. */
    menuPath?: string | null;
    onToggle: (folder: string) => void;
    onOpen: (path: string) => void;
    onRename: (path: string, name: string) => void;
    onCommitNew: (name: string) => void;
    onCancelNew: () => void;
    onMove: (path: string, folder: string, index: number) => void;
    onTrash: (path: string) => void;
    onContextMenu: (path: string | null, point: { x: number; y: number }) => void;
    onRenameStarted?: () => void;
    /** A row to bring into view and focus; a new `at` asks again (search shows a folder it found). */
    reveal?: { path: string; at: number };
  };

  let {
    folders,
    rows,
    expanded,
    pending,
    activePath,
    unsavedPath,
    renameRequest = null,
    menuPath = null,
    onToggle,
    onOpen,
    onRename,
    onCommitNew,
    onCancelNew,
    onMove,
    onTrash,
    onContextMenu,
    onRenameStarted = () => {},
    reveal,
  }: Props = $props();

  // Each request is met once, when its row is there: the rows may arrive a
  // moment later, as the folders unfold. After that the row lets go, or any
  // change to the tree would pull the keys back to it.
  let revealed = 0;
  $effect(() => {
    if (!reveal?.path || reveal.at === revealed) return;
    void rows;
    const row = document.querySelector<HTMLElement>(`.space-tree [data-path="${CSS.escape(reveal.path)}"]`);
    if (!row) return;
    revealed = reveal.at;
    row.scrollIntoView({ block: 'nearest' });
    row.focus();
  });

  /** A page shows its name without `.md`; renaming it keeps the extension (Go adds it). */
  const label = (node: TreeNodeData) => (node.kind === 'page' ? node.name.replace(/\.md$/i, '') : node.name);

  const collection = $derived(
    createTreeCollection<TreeNodeData>({
      rootNode: treeRoot(folders, pending, { page: t('tree.untitled'), folder: t('tree.newFolderName') }) as TreeNodeData,
      nodeToValue: (node) => node.value,
      nodeToString: (node) => label(node),
    }),
  );

  // Set when a new row's name is submitted, so the end of renaming is not
  // mistaken for a cancel.
  let committed = false;

  const tree = useTreeView<TreeNodeData>(() => ({
    id: 'bava-space-tree',
    collection,
    expandedValue: expanded,
    selectedValue: activePath ? [activePath] : [],
    expandOnClick: true,
    canRename: (node) => node.value !== '',
    onExpandedChange: (details) => {
      const next = new Set(details.expandedValue);
      const changed = [...expanded.filter((f) => !next.has(f)), ...details.expandedValue.filter((f) => !expanded.includes(f))];
      for (const folder of changed) onToggle(folder);
    },
    onSelectionChange: (details) => {
      const value = details.selectedValue[0];
      if (!value || value === PENDING) return;
      const node = collection.findNode(value);
      if (node?.kind === 'page') onOpen(value);
    },
    onRenameComplete: (details) => {
      if (details.value === PENDING) {
        committed = true;
        onCommitNew(details.label);
        return;
      }
      const node = collection.findNode(details.value);
      if (node && details.label.trim() && details.label !== label(node)) onRename(details.value, details.label);
    },
  }));

  // A new row starts in its name field; leaving it with Escape cancels it.
  // Each `pending` object is one naming session: a refused name comes back
  // as a new object, and naming starts again.
  let namingNew = false;
  let session: object | null = null;
  $effect(() => {
    const indexPath = pending ? collection.getIndexPath(PENDING) : undefined;
    if (!pending || !indexPath) {
      // The row went (made, or cancelled by the app): leave nothing renaming.
      if (namingNew) untrack(() => tree().cancelRenaming());
      namingNew = false;
      session = null;
      return;
    }
    const node = collection.at(indexPath);
    const renaming = node ? tree().getNodeState({ node, indexPath }).renaming : false;
    if (pending !== session) {
      session = pending;
      committed = false;
      namingNew = false;
      queueMicrotask(() => {
        if (renaming) tree().cancelRenaming();
        tree().startRenaming(PENDING);
      });
      return;
    }
    // Submitted: wait for the app to make it or refuse it.
    if (committed) return;
    // Naming counts from the moment the field is open, not before.
    if (!namingNew && renaming) {
      namingNew = true;
      return;
    }
    if (namingNew && !renaming) {
      namingNew = false;
      onCancelNew();
    }
  });

  // A rename asked for from a menu starts a frame later: the menu moves focus
  // into itself in an animation frame as it closes, which would otherwise take
  // focus from the name field and end the rename before it began.
  $effect(() => {
    if (!renameRequest) return;
    const path = renameRequest;
    requestAnimationFrame(() => {
      tree().startRenaming(path);
      onRenameStarted();
    });
  });

  // Dragging: which row is carried, and where it would land.
  let dragged = $state<string | null>(null);
  let over = $state<{ path: string; zone: DropZone } | null>(null);

  function dragStart(event: DragEvent, node: TreeNodeData) {
    dragged = node.value;
    event.dataTransfer?.setData('text/plain', node.value);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  function dragOver(event: DragEvent, node: TreeNodeData) {
    if (!dragged) return;
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const zone = zoneAt(event.clientY - box.top, box.height, node.kind === 'folder');
    if (!dropTarget(rows, node.value, zone, dragged)) {
      over = null;
      return;
    }
    event.preventDefault();
    over = { path: node.value, zone };
  }

  function drop(event: DragEvent) {
    event.preventDefault();
    const target = over && dragged ? dropTarget(rows, over.path, over.zone, dragged) : null;
    if (target && dragged) onMove(dragged, target.folder, target.index);
    dragged = null;
    over = null;
  }

  function dragEnd() {
    dragged = null;
    over = null;
  }

  const depthOf = (path: string) => (path === PENDING ? (pending?.folder ? pending.folder.split('/').length : 0) : path.split('/').length - 1);

  function keydown(event: KeyboardEvent) {
    if (event.key !== 'Delete' && event.key !== 'Backspace') return;
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT') return;
    const path = target.closest<HTMLElement>('[data-path]')?.dataset.path;
    if (!path || path === PENDING) return;
    event.preventDefault();
    onTrash(path);
  }

  function contextMenu(event: MouseEvent) {
    event.preventDefault();
    const path = (event.target as HTMLElement).closest<HTMLElement>('[data-path]')?.dataset.path ?? null;
    onContextMenu(path === PENDING ? null : path, { x: event.clientX, y: event.clientY });
  }
</script>

{#snippet row(node: TreeNodeData, isFolder: boolean)}
  {#if isFolder}
    <TreeView.BranchIndicator class="chevron"><ToolIcon id="chevron" size="sm" /></TreeView.BranchIndicator>
    <ToolIcon id="folder" size="sm" />
    <TreeView.BranchText class="name">{label(node)}</TreeView.BranchText>
  {:else}
    <span class="chevron-space" aria-hidden="true"></span>
    <ToolIcon id="page" size="sm" />
    <TreeView.ItemText class="name">{label(node)}</TreeView.ItemText>
    {#if node.value === unsavedPath}<span class="dot" role="img" aria-label={t('file.dirty')} title={t('file.dirty')}></span>{/if}
  {/if}
  <TreeView.NodeRenameInput class="rename" aria-label={t('tree.renameField')} />
{/snippet}

{#snippet renderNode(node: TreeNodeData, indexPath: number[])}
  <TreeView.NodeProvider {node} {indexPath}>
    {#if node.kind === 'folder' && node.value !== PENDING}
      <TreeView.Branch>
        <TreeView.BranchControl
          class="row"
          data-path={node.value}
          data-menu={node.value === menuPath ? '' : undefined}
          data-drop={over?.path === node.value ? over.zone : undefined}
          style={`--depth: ${depthOf(node.value)}`}
          draggable="true"
          ondragstart={(event: DragEvent) => dragStart(event, node)}
          ondragover={(event: DragEvent) => dragOver(event, node)}
          ondrop={drop}
          ondragend={dragEnd}
        >
          {@render row(node, true)}
        </TreeView.BranchControl>
        <TreeView.BranchContent>
          {#each node.children ?? [] as child, index (child.value)}
            {@render renderNode(child, [...indexPath, index])}
          {/each}
        </TreeView.BranchContent>
      </TreeView.Branch>
    {:else}
      <TreeView.Item
        class="row"
        data-path={node.value}
        data-menu={node.value === menuPath ? '' : undefined}
        data-drop={over?.path === node.value ? over.zone : undefined}
        style={`--depth: ${depthOf(node.value)}`}
        draggable={node.value === PENDING ? 'false' : 'true'}
        ondragstart={(event: DragEvent) => dragStart(event, node)}
        ondragover={(event: DragEvent) => dragOver(event, node)}
        ondrop={drop}
        ondragend={dragEnd}
      >
        {@render row(node, node.kind === 'folder')}
      </TreeView.Item>
    {/if}
  </TreeView.NodeProvider>
{/snippet}

<TreeView.RootProvider value={tree} class="space-tree">
  <TreeView.Tree class="tree" aria-label={t('pane.files')} onkeydown={keydown} oncontextmenu={contextMenu}>
    {#each collection.rootNode.children ?? [] as node, index (node.value)}
      {@render renderNode(node, [index])}
    {/each}
  </TreeView.Tree>
</TreeView.RootProvider>

<style>
  /* Fills what the pane has left below its header, so right-clicking empty
     space works, without making the pane taller than the window. */
  :global(.space-tree) {
    flex: 1 0 auto;
  }

  :global(.space-tree .tree) {
    display: flex;
    flex-direction: column;
    gap: var(--border-width);
    padding: 0 var(--space-2) var(--space-4);
    outline: none;
  }

  :global(.space-tree .row) {
    position: relative;
    display: flex;
    align-items: center;
    gap: var(--size-row-gap);
    height: var(--size-row);
    padding-inline: calc(var(--space-2) + var(--depth, 0) * var(--size-tree-indent)) var(--space-2);
    border-radius: var(--radius-md);
    font-size: var(--text-control);
    color: var(--color-text-secondary);
    cursor: default;
    user-select: none;
    outline: none;
  }

  /* Hovered, or the row a right-click menu is open for. */
  :global(.space-tree .row:hover),
  :global(.space-tree .row[data-menu]) {
    background: var(--color-accent-subtle);
  }

  :global(.space-tree .row[data-selected]) {
    background: var(--color-selection);
    color: var(--color-text-primary);
  }

  /* Keyboard focus only: Ark marks the row Tab would land on even before the tree is focused. */
  :global(.space-tree .row:focus-visible) {
    box-shadow: inset 0 0 0 var(--focus-ring-width) var(--color-focus-ring);
  }

  :global(.space-tree .row[data-drop='inside']) {
    background: var(--color-selection);
  }

  :global(.space-tree .row[data-drop='before'])::before,
  :global(.space-tree .row[data-drop='after'])::after {
    content: '';
    position: absolute;
    inset-inline: var(--space-2) 0;
    height: var(--size-tree-drop-line);
    border-radius: var(--radius-full);
    background: var(--color-accent);
  }

  :global(.space-tree .row[data-drop='before'])::before {
    top: 0;
  }

  :global(.space-tree .row[data-drop='after'])::after {
    bottom: 0;
  }

  :global(.space-tree .chevron),
  :global(.space-tree .chevron-space) {
    display: inline-flex;
    width: var(--size-tree-indent);
    flex: none;
    color: var(--color-text-muted);
  }

  :global(.space-tree .chevron[data-state='open']) {
    transform: rotate(90deg);
  }

  :global(.space-tree .name) {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :global(.space-tree .row:has(.rename:not([hidden])) .name) {
    display: none;
  }

  /* The field shows its own focus; the row's ring around it would double it. */
  :global(.space-tree .row:has(.rename:not([hidden]))) {
    box-shadow: none;
    background: transparent;
  }

  :global(.space-tree .rename) {
    flex-grow: 1;
    min-width: 0;
    height: calc(var(--size-row) - var(--space-1));
    padding: 0 var(--space-1);
    border: var(--border-width) solid var(--color-focus-ring);
    border-radius: var(--radius-sm);
    background: var(--color-surface-raised);
    color: var(--color-text-primary);
    font: inherit;
  }

  :global(.space-tree .rename[hidden]) {
    display: none;
  }

  :global(.space-tree .dot) {
    width: var(--size-unsaved-dot);
    height: var(--size-unsaved-dot);
    margin-left: auto;
    flex: none;
    border-radius: var(--radius-full);
    background: var(--color-accent);
  }
</style>
