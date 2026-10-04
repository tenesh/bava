<script lang="ts">
  import Pane from '../../../../src/components/Pane.svelte';
  import Cell from '../Cell.svelte';
</script>

{#snippet body()}
  <p class="text">What the pane holds.</p>
{/snippet}

<Cell name="titled" width="14rem" height="8rem" ground="nav"><Pane title="Files">{@render body()}</Pane></Cell>
<Cell name="titled, with meta" width="14rem" height="8rem" ground="nav"><Pane title="Media" meta="5 files">{@render body()}</Pane></Cell>
<Cell name="bare" width="14rem" height="8rem"><Pane title="Document" variant="bare">{@render body()}</Pane></Cell>

<style>
  .text {
    margin: var(--space-3);
    color: var(--color-text-secondary);
  }
</style>
