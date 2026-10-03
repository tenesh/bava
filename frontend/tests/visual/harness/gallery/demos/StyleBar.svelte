<script lang="ts">
  import StyleBar from '../../../../../src/components/StyleBar.svelte';
  import Cell from '../Cell.svelte';

  let { variant }: { variant: string } = $props();

  type Current = string | null | 'mixed' | 'unavailable';
  const ALL: { name: string; fill: Current; stroke: Current; color: Current }[] = [
    { name: 'defaults', fill: null, stroke: null, color: null },
    { name: 'swatches', fill: 'blue', stroke: 'red', color: 'green' },
    { name: 'colours of their own', fill: '#ffe066', stroke: '#d9480f', color: '#5f3dc4' },
    { name: 'mixed', fill: 'mixed', stroke: 'mixed', color: 'mixed' },
    { name: 'a line: border only', fill: 'unavailable', stroke: 'purple', color: 'unavailable' },
  ];
  // A picker's chip is found by a fixed id, as the app has one bar at a time:
  // a bar opened or hovered is shown alone.
  const bars = $derived(variant === 'swatches' ? [ALL[1]] : variant === 'own' ? [ALL[2]] : ALL);
</script>

{#each bars as bar (bar.name)}
  <Cell name={bar.name}>
    <div class="bar"><StyleBar fill={bar.fill} stroke={bar.stroke} color={bar.color} onApply={() => {}} /></div>
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
