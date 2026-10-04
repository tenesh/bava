<script lang="ts">
  import Segments from '../../../../src/components/Segments.svelte';
  import Cell from '../Cell.svelte';

  const options = [
    { value: 'grid', label: 'Grid' },
    { value: 'list', label: 'List' },
    { value: 'table', label: 'Table' },
  ] as const;
  type View = (typeof options)[number]['value'];

  const cells: { name: string; force?: 'hover' | 'active'; attrs?: Record<string, string> }[] = [
    { name: 'rest' },
    { name: 'List hovered', force: 'hover' },
    { name: 'List pressed', force: 'active' },
    { name: 'List focused', attrs: { 'data-focus-visible': '' } },
  ];
  const views = $state<View[]>(cells.map(() => 'grid'));
</script>

{#each cells as each, index (each.name)}
  <Cell name={each.name} force={each.force} attrs={each.attrs} target={each.name === 'rest' ? undefined : '.bava-segment:nth-child(2)'}>
    <Segments label="View" value={views[index]} options={[...options]} onValueChange={(next) => (views[index] = next)} />
  </Cell>
{/each}
