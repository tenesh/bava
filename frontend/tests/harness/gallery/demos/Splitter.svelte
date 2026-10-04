<script lang="ts">
  import Splitter from '../../../../src/components/Splitter.svelte';
  import Cell from '../Cell.svelte';
</script>

{#snippet panel(id: string)}
  <p class="text">{id}</p>
{/snippet}

<Cell name="side by side" width="401px" height="8rem">
  <Splitter panels={[{ id: 'Files', size: 40, minSize: 20 }, { id: 'Document', size: 60, minSize: 20 }]} {panel} />
</Cell>
<Cell name="stacked" width="14rem" height="201px" ground="nav">
  <Splitter orientation="vertical" panels={[{ id: 'Files', size: 50, minSize: 20 }, { id: 'Media', size: 50, minSize: 20 }]} {panel} />
</Cell>

<style>
  .text {
    margin: var(--space-2);
    color: var(--color-text-secondary);
  }
</style>
