<script lang="ts">
  import FormatBubble from '../../../../../src/components/FormatBubble.svelte';
  import Cell from '../Cell.svelte';
  import { settledBox } from '../settled';

  let first: HTMLElement | undefined = $state();
  let second: HTMLElement | undefined = $state();
  let atFirst = $state<{ left: number; top: number } | null>(null);
  let atSecond = $state<{ left: number; top: number } | null>(null);
  $effect(() => {
    if (first) void settledBox(first).then((box) => (atFirst = { left: box.left, top: box.top }));
  });
  $effect(() => {
    if (second) void settledBox(second).then((box) => (atSecond = { left: box.left, top: box.top }));
  });
</script>

<Cell name="bold and a link" width="24rem" height="5rem">
  <p class="line">Some <mark class="selected" bind:this={first}>selected words</mark> of a paragraph.</p>
</Cell>
<Cell name="in a block that cannot turn" width="24rem" height="5rem">
  <p class="line">A <mark class="selected" bind:this={second}>table cell's</mark> words.</p>
</Cell>
{#if atFirst && atSecond}
  <FormatBubble at={atFirst} active={{ bold: true, link: true }} onCommand={() => {}} />
  <FormatBubble at={atSecond} active={{}} turnable={false} onCommand={() => {}} />
{/if}

<style>
  .line {
    margin: 0;
    padding-top: var(--space-10);
    color: var(--color-text-prose);
  }

  .selected {
    background: var(--color-selection);
    color: inherit;
  }
</style>
