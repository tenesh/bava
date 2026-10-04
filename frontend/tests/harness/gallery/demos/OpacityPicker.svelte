<script lang="ts">
  import OpacityPicker from '../../../../src/components/OpacityPicker.svelte';
  import Cell from '../Cell.svelte';

  let current = $state(60);
</script>

{#each [undefined, 'hover', 'focus'] as const as force (force ?? 'rest')}
  <Cell name={force === 'hover' ? 'hovered' : force === 'focus' ? 'focused' : 'in the selection toolbar'} {force} target={force ? '.bava-control-trigger' : undefined}>
    <div class="bar"><OpacityPicker {current} onSelect={(value) => (current = value)} /></div>
  </Cell>
{/each}

<style>
  .bar {
    display: inline-flex;
    padding: var(--space-1);
    background: var(--color-surface-overlay);
    border: var(--border-width) solid var(--color-border-subtle);
    border-radius: var(--radius-lg);
  }
</style>
