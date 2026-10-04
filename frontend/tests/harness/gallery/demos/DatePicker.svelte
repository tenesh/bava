<script lang="ts">
  import DatePicker from '../../../../src/components/DatePicker.svelte';
  import Cell from '../Cell.svelte';
  import { settledBox } from '../settled';

  let chip: HTMLElement | undefined = $state();
  let at = $state<{ left: number; bottom: number } | null>(null);
  $effect(() => {
    if (chip) void settledBox(chip).then((box) => (at = { left: box.left, bottom: box.bottom }));
  });
</script>

<!-- The chosen day focused, and the 20th hovered. -->
<Cell
  name="under a date chip, the 14th focused and the 20th hovered"
  width="18rem"
  height="20rem"
  marks={[
    { scope: 'page', target: '.date-picker .day[data-selected]', force: 'focus' },
    { scope: 'page', target: ".date-picker .day[data-value='2026-09-20']", force: 'hover' },
  ]}
>
  <span class="chip" bind:this={chip}>14 Sep 2026</span>
</Cell>

{#if at}
  <DatePicker {at} value="2026-09-14" onPick={() => {}} onClose={() => {}} />
{/if}

<style>
  .chip {
    color: var(--color-text-prose);
  }
</style>
