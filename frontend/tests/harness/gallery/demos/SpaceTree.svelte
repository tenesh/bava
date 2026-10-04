<script lang="ts">
  import SpaceTree from '../../../../src/components/SpaceTree.svelte';
  import Cell from '../Cell.svelte';
  import { FOLDERS, ROWS } from '../data';

  let { variant }: { variant: string } = $props();

  type Mark = { target: string; force: 'hover' | 'focus' };

  const trees: { name: string; expanded: string[]; naming?: boolean; marks?: Mark[] }[] = [
    { name: "a Space's files", expanded: ['Engineering'] },
    {
      name: 'Roadmap hovered, Research focused',
      expanded: ['Engineering'],
      marks: [
        { target: '[data-path="Roadmap.md"]', force: 'hover' },
        { target: '[data-path="Research"]', force: 'focus' },
      ],
    },
    { name: 'Engineering folded', expanded: [] },
  ];
  // Naming holds a field that commits when it loses focus, so it is shown alone.
  const shown = variant === 'naming' ? [{ name: 'naming a new page', expanded: ['Engineering'], naming: true }] : trees;
</script>

{#each shown as tree (tree.name)}
  <Cell name={tree.name} width="16rem" height="14rem" ground="nav" marks={tree.marks}>
    <SpaceTree
      folders={FOLDERS}
      rows={ROWS}
      expanded={tree.expanded}
      pending={tree.naming ? { kind: 'page', folder: 'Engineering' } : null}
      activePath="Engineering/Architecture.md"
      unsavedPath="Roadmap.md"
      onToggle={() => {}}
      onOpen={() => {}}
      onRename={() => {}}
      onCommitNew={() => {}}
      onCancelNew={() => {}}
      onMove={() => {}}
      onTrash={() => {}}
      onContextMenu={() => {}}
    />
  </Cell>
{/each}
