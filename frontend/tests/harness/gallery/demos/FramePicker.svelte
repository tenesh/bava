<script lang="ts">
  import FramePicker from '../../../../src/components/FramePicker.svelte';
  import Cell from '../Cell.svelte';
  import { settledBox } from '../settled';
  import { t } from '../../../../src/i18n/t';

  const picture = (name: string) => `/bava-file/?${new URLSearchParams({ path: `.bava/attachments/${name}` })}`;

  // This page's frames, then another page's; and a Space with no frames yet.
  const groups = [
    {
      page: null,
      title: t('frames.thisPage'),
      frames: [
        { id: 'f1', label: 'Ingest pipeline', thumb: picture('landscape.png') },
        { id: 'f2', label: t('frames.untitled'), thumb: picture('logo.png') },
      ],
    },
    { page: 'Engineering/Architecture.md', title: 'Architecture', frames: [{ id: 'f7', label: 'Write path', thumb: null }] },
  ];

  let framesAnchor: HTMLElement | undefined = $state();
  let emptyAnchor: HTMLElement | undefined = $state();
  let framesAt = $state<{ left: number; top: number; bottom: number } | null>(null);
  let emptyAt = $state<{ left: number; top: number; bottom: number } | null>(null);
  $effect(() => {
    if (framesAnchor) void settledBox(framesAnchor).then((box) => (framesAt = box));
    if (emptyAnchor) void settledBox(emptyAnchor).then((box) => (emptyAt = box));
  });
</script>

<Cell name="at the caret, the first frame highlighted" width="22rem" height="24rem">
  <span class="anchor" bind:this={framesAnchor}>/embed</span>
</Cell>
<Cell name="no frames yet" width="22rem" height="12rem">
  <span class="anchor" bind:this={emptyAnchor}>/embed</span>
</Cell>

{#if framesAt}
  <FramePicker at={framesAt} {groups} onPick={() => {}} onClose={() => {}} />
{/if}
{#if emptyAt}
  <FramePicker at={emptyAt} groups={[]} onPick={() => {}} onClose={() => {}} />
{/if}

<style>
  .anchor {
    color: var(--color-text-muted);
  }
</style>
