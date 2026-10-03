<script lang="ts">
  import SpaceTree from '../../../../../src/components/SpaceTree.svelte';
  import Cell from '../Cell.svelte';
  import { FOLDERS, ROWS } from '../data';

  let { variant }: { variant: string } = $props();

  let expanded = $state(['Engineering']);
  let active = $state<string | null>('Engineering/Architecture.md');
  // svelte-ignore state_referenced_locally
  const pending = variant === 'naming' ? { kind: 'page' as const, folder: 'Engineering' } : null;
</script>

<Cell name="a Space's files" width="16rem" height="14rem" ground="nav">
  <SpaceTree
    folders={FOLDERS}
    rows={ROWS}
    {expanded}
    {pending}
    activePath={active}
    unsavedPath="Roadmap.md"
    onToggle={(folder) => (expanded = expanded.includes(folder) ? expanded.filter((f) => f !== folder) : [...expanded, folder])}
    onOpen={(path) => (active = path)}
    onRename={() => {}}
    onCommitNew={() => {}}
    onCancelNew={() => {}}
    onMove={() => {}}
    onTrash={() => {}}
    onContextMenu={() => {}}
  />
</Cell>
