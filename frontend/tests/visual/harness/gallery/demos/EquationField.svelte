<script lang="ts">
  import EquationField from '../../../../../src/components/EquationField.svelte';
  import { renderTex } from '../../../../../src/docs/math';
  import Cell from '../Cell.svelte';
  import { settledBox } from '../settled';

  let { variant }: { variant: string } = $props();

  const display = $derived(variant === 'display');
  const value = $derived(variant === 'empty' ? '' : variant === 'display' ? '\\int_0^1 x^2 \\, dx = \\frac{1}{3}' : 'E = mc^2');

  let anchor: HTMLElement | undefined = $state();
  let at = $state<{ left: number; top: number; bottom: number } | null>(null);
  $effect(() => {
    if (anchor) void settledBox(anchor).then((box) => (at = { left: box.left, top: box.top, bottom: box.bottom }));
  });
</script>

<Cell name="under its equation" width="24rem" height="14rem">
  <span class="anchor" bind:this={anchor}>The equation</span>
</Cell>
{#if at}
  <EquationField {at} {value} {display} render={renderTex} onSave={() => {}} onCancel={() => {}} />
{/if}

<style>
  .anchor {
    color: var(--color-text-prose);
  }
</style>
