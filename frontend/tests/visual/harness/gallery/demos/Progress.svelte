<script lang="ts">
  import Progress from '../../../../../src/components/Progress.svelte';
  import Cell from '../Cell.svelte';
</script>

{#each [null, 0, 40, 100] as value (value)}
  <Cell name={value === null ? 'unknown' : `${value}%`} width="12rem"><Progress label="Loading" {value} /></Cell>
{/each}
