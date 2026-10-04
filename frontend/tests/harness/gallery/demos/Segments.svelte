<script lang="ts">
  import Segments from '../../../../src/components/Segments.svelte';
  import Cell from '../Cell.svelte';

  let view = $state<'grid' | 'list' | 'table'>('grid');
</script>

<Cell name="three choices">
  <Segments
    label="View"
    value={view}
    options={[
      { value: 'grid', label: 'Grid' },
      { value: 'list', label: 'List' },
      { value: 'table', label: 'Table' },
    ]}
    onValueChange={(next) => (view = next)}
  />
</Cell>
