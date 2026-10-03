<script lang="ts">
  import PanelBoundary from '../../../../../src/components/PanelBoundary.svelte';
  import Cell from '../Cell.svelte';

  /** A panel whose drawing throws. */
  function broken(): string {
    throw new Error('the panel could not draw');
  }
</script>

<Cell name="drawing" width="18rem" height="10rem">
  <PanelBoundary name="Files" onError={() => {}}>
    <p class="text">A panel drawn as it should be.</p>
  </PanelBoundary>
</Cell>
<Cell name="failed" width="18rem" height="10rem">
  <PanelBoundary name="Files" onError={() => {}}>
    <p class="text">{broken()}</p>
  </PanelBoundary>
</Cell>

<style>
  .text {
    margin: 0;
    color: var(--color-text-secondary);
  }
</style>
