<script lang="ts">
  import NumberField from '../../../../src/components/NumberField.svelte';
  import Cell from '../Cell.svelte';

  const fields = $state([
    { name: 'rest', value: 210 },
    { name: 'a fraction', value: 0.5 },
    { name: 'focused', value: 297, focus: true },
  ]);
</script>

{#each fields as field (field.name)}
  <Cell name={field.name} width="8rem" target={field.focus ? 'input' : undefined} force={field.focus ? 'focus' : undefined}>
    <NumberField label="Width" value={field.value} onValueChange={(next) => (field.value = next)} />
  </Cell>
{/each}
