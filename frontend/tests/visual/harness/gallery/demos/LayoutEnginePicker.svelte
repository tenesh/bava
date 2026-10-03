<script lang="ts">
  import LayoutEnginePicker from '../../../../../src/components/LayoutEnginePicker.svelte';
  import type { Direction, LayoutEngine } from '../../../../../src/settings/layout-engine';
  import Cell from '../Cell.svelte';

  const pickers = $state<{ name: string; engine: LayoutEngine; direction: Direction; hint?: string }[]>([
    { name: 'TALA', engine: 'tala', direction: 'down' },
    { name: 'Dagre, with a hint', engine: 'dagre', direction: 'right', hint: 'Applies to the next insert' },
    { name: 'ELK', engine: 'elk', direction: 'down' },
  ]);
</script>

{#each pickers as picker (picker.name)}
  <Cell name={picker.name}>
    <LayoutEnginePicker
      engine={picker.engine}
      direction={picker.direction}
      directionHint={picker.hint}
      onEngine={(engine) => (picker.engine = engine)}
      onDirection={(direction) => (picker.direction = direction)}
    />
  </Cell>
{/each}
