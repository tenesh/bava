<script lang="ts">
  import EmojiPicker from '../../../../../src/components/EmojiPicker.svelte';
  import { loadEmoji, type Emoji } from '../../../../../src/docs/emoji';
  import type { MessageKey } from '../../../../../src/i18n/messages';
  import { t } from '../../../../../src/i18n/t';
  import Cell from '../Cell.svelte';
  import { settledBox } from '../settled';

  let { variant }: { variant: string } = $props();

  let emojis = $state.raw<Emoji[]>([]);
  $effect(() => {
    if (variant !== 'loading') void loadEmoji().then((list) => (emojis = list));
  });

  let anchor: HTMLElement | undefined = $state();
  let at = $state<{ left: number; top: number; bottom: number } | null>(null);
  $effect(() => {
    if (anchor) void settledBox(anchor).then((box) => (at = { left: box.left, top: box.top, bottom: box.bottom }));
  });
</script>

<Cell name="under the page's icon" width="22rem" height="26rem">
  <span class="anchor" bind:this={anchor}>Add icon</span>
</Cell>
{#if at && (variant === 'loading' || emojis.length > 0)}
  <EmojiPicker {at} {emojis} groupLabel={(group) => t(`emoji.group.${group}` as MessageKey)} onPick={() => {}} onClose={() => {}} />
{/if}

<style>
  .anchor {
    color: var(--color-text-muted);
  }
</style>
