<script lang="ts">
  import ToolRail from '../../../../src/components/ToolRail.svelte';
  import type { ToolId } from '../../../../src/canvas/tools.svelte';
  import Cell from '../Cell.svelte';

  type Mark = { target: string; force: 'hover' | 'focus' | 'active' };

  const rails = $state<{ name: string; active: ToolId; insertOpen: boolean; locked: boolean; marks?: Mark[] }[]>([
    { name: 'Select', active: 'select', insertOpen: false, locked: false },
    { name: 'Rectangle', active: 'rect', insertOpen: false, locked: false },
    { name: 'Insert open', active: 'select', insertOpen: true, locked: false },
    { name: 'locked', active: 'pen', insertOpen: false, locked: true },
    {
      name: 'Ellipse hovered, Insert focused, Text pressed',
      active: 'select',
      insertOpen: false,
      locked: false,
      marks: [
        { target: '[aria-label="Ellipse"]', force: 'hover' },
        { target: '[data-insert-trigger]', force: 'focus' },
        { target: '[aria-label="Text"]', force: 'active' },
      ],
    },
  ]);
</script>

{#each rails as rail (rail.name)}
  <Cell name={rail.name} width="5rem" height="33rem" ground="canvas" marks={rail.marks}>
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
