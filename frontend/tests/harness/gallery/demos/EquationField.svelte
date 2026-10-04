<script lang="ts">
  import EquationField from '../../../../src/components/EquationField.svelte';
  import { renderTex } from '../../../../src/docs/math';
  import Cell from '../Cell.svelte';
  import { settledBox } from '../settled';

  // Empty, inline and on its own line: each under its equation.
  const fields = [
    { name: 'empty', value: '', display: false },
    { name: 'inline', value: 'E = mc^2', display: false },
    { name: 'on its own line', value: '\\int_0^1 x^2 \\, dx = \\frac{1}{3}', display: true },
  ];

  const anchors = $state<(HTMLElement | undefined)[]>([]);
  const at = $state<({ left: number; top: number; bottom: number } | null)[]>(fields.map(() => null));
  $effect(() => {
    anchors.forEach((anchor, index) => {
      if (anchor) void settledBox(anchor).then((box) => (at[index] = box));
    });
  });
</script>

{#each fields as field, index (field.name)}
  <Cell name={field.name} width="24rem" height="14rem">
    <span class="anchor" bind:this={anchors[index]}>The equation</span>
  </Cell>
{/each}

{#each fields as field, index (field.name)}
  {@const place = at[index]}
  {#if place}
    <EquationField at={place} value={field.value} display={field.display} render={renderTex} onSave={() => {}} onCancel={() => {}} />
  {/if}
{/each}

<style>
  .anchor {
    color: var(--color-text-prose);
  }
</style>
