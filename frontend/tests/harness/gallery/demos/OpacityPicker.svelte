<script lang="ts">
  import OpacityPicker from '../../../../src/components/OpacityPicker.svelte';
  import Cell from '../Cell.svelte';

  let current = $state(60);
</script>

<Cell name="in the selection toolbar">
  <div class="bar"><OpacityPicker {current} onSelect={(value) => (current = value)} /></div>
</Cell>

<style>
  .bar {
    display: inline-flex;
    padding: var(--space-1);
    background: var(--color-surface-overlay);
    border: var(--border-width) solid var(--color-border-subtle);
    border-radius: var(--radius-lg);
  }
</style>
