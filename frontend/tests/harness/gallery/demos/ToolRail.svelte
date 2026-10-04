<script lang="ts">
  import ToolRail from '../../../../src/components/ToolRail.svelte';
  import type { ToolId } from '../../../../src/canvas/tools.svelte';
  import Cell from '../Cell.svelte';

  const rails = $state<{ name: string; active: ToolId; insertOpen: boolean; locked: boolean }[]>([
    { name: 'Select', active: 'select', insertOpen: false, locked: false },
    { name: 'Rectangle', active: 'rect', insertOpen: false, locked: false },
    { name: 'Insert open', active: 'select', insertOpen: true, locked: false },
    { name: 'locked', active: 'pen', insertOpen: false, locked: true },
  ]);
</script>

{#each rails as rail (rail.name)}
  <Cell name={rail.name} width="5rem" height="33rem" ground="canvas">
    <ToolRail
      active={rail.active}
      insertOpen={rail.insertOpen}
      locked={rail.locked}
      onSelect={(tool) => (rail.active = tool)}
      onInsert={() => (rail.insertOpen = !rail.insertOpen)}
      onLock={() => (rail.locked = !rail.locked)}
    />
  </Cell>
{/each}
