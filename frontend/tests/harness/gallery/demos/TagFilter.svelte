<script lang="ts">
  import TagFilter from '../../../../src/components/TagFilter.svelte';
  import Cell from '../Cell.svelte';
  import { settledBox } from '../settled';

  const TAGS = [
    { tag: 'design', count: 4 },
    { tag: 'launch', count: 3 },
    { tag: 'meeting-notes', count: 7 },
    { tag: 'q4', count: 5 },
    { tag: 'road-map', count: 2 },
  ];

  let tagsAnchor: HTMLElement | undefined = $state();
  let emptyAnchor: HTMLElement | undefined = $state();
  let tagsAt = $state<{ left: number; top: number; bottom: number } | null>(null);
  let emptyAt = $state<{ left: number; top: number; bottom: number } | null>(null);
  $effect(() => {
    if (tagsAnchor) void settledBox(tagsAnchor).then((box) => (tagsAt = box));
    if (emptyAnchor) void settledBox(emptyAnchor).then((box) => (emptyAt = box));
  });
</script>

<Cell name="two tags chosen, the first row highlighted" width="20rem" height="17rem">
  <span class="anchor" bind:this={tagsAnchor}>Files</span>
</Cell>
<Cell name="no tags yet" width="20rem" height="9rem">
  <span class="anchor" bind:this={emptyAnchor}>Files</span>
</Cell>

{#if tagsAt}
  <TagFilter at={tagsAt} tags={TAGS} chosen={['launch', 'q4']} onToggle={() => {}} onMenu={() => {}} onManage={() => {}} onClose={() => {}} />
{/if}
{#if emptyAt}
  <TagFilter at={emptyAt} tags={[]} chosen={[]} onToggle={() => {}} onMenu={() => {}} onManage={() => {}} onClose={() => {}} />
{/if}

<style>
  .anchor {
    color: var(--color-text-muted);
  }
</style>
