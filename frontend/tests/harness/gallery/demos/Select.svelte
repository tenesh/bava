<script lang="ts">
  import Select from '../../../../src/components/Select.svelte';
  import Cell from '../Cell.svelte';

  const options = [
    { value: 'name', label: 'Name' },
    { value: 'size', label: 'Size' },
    { value: 'date', label: 'Date' },
  ];

  const cells: { name: string; prefix?: string; force?: 'hover' | 'active' | 'focus' }[] = [
    { name: 'rest, with a prefix', prefix: 'Sort:' },
    { name: 'rest, alone' },
    { name: 'hovered', prefix: 'Sort:', force: 'hover' },
    { name: 'pressed', prefix: 'Sort:', force: 'active' },
    { name: 'focused', prefix: 'Sort:', force: 'focus' },
  ];
  const values = $state<string[]>(cells.map(() => 'name'));
</script>

{#each cells as each, index (each.name)}
  <Cell name={each.name} force={each.force} target={each.force ? '.bava-select-trigger' : undefined}>
    <Select label="Sort by" prefix={each.prefix} value={values[index]} {options} onValueChange={(next) => (values[index] = next)} />
  </Cell>
{/each}
