<script lang="ts">
  import Mark from '../../../../../src/components/Mark.svelte';
  import Cell from '../Cell.svelte';
</script>

{#each ['chrome', 'brand', 'hero', 'start', 'about', 'splash'] as const as size (size)}
  <Cell name={size}><Mark {size} /></Cell>
{/each}
