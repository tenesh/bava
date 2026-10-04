<script lang="ts">
  import EmojiPicker from '../../../../src/components/EmojiPicker.svelte';
  import { loadEmoji, type Emoji } from '../../../../src/docs/emoji';
  import type { MessageKey } from '../../../../src/i18n/messages';
  import { t } from '../../../../src/i18n/t';
  import Cell from '../Cell.svelte';
  import { settledBox } from '../settled';

  let emojis = $state.raw<Emoji[]>([]);
  $effect(() => {
    void loadEmoji().then((list) => (emojis = list));
  });

  // One picker with its emoji, the first hovered; one while they load.
  let loadedAnchor: HTMLElement | undefined = $state();
  let loadingAnchor: HTMLElement | undefined = $state();
  let loadedAt = $state<{ left: number; top: number; bottom: number } | null>(null);
  let loadingAt = $state<{ left: number; top: number; bottom: number } | null>(null);
  $effect(() => {
    if (loadedAnchor) void settledBox(loadedAnchor).then((box) => (loadedAt = box));
    if (loadingAnchor) void settledBox(loadingAnchor).then((box) => (loadingAt = box));
  });

  const groupLabel = (group: string) => t(`emoji.group.${group}` as MessageKey);
</script>

<Cell name="under the page's icon, an emoji hovered" width="22rem" height="26rem" force="hover" scope="page" target=".emoji-picker .emoji">
  <span class="anchor" bind:this={loadedAnchor}>Add icon</span>
</Cell>
<Cell name="while the emoji load" width="22rem" height="26rem">
  <span class="anchor" bind:this={loadingAnchor}>Add icon</span>
</Cell>

{#if loadedAt && emojis.length > 0}
  <EmojiPicker at={loadedAt} {emojis} {groupLabel} onPick={() => {}} onClose={() => {}} />
{/if}
{#if loadingAt}
  <EmojiPicker at={loadingAt} emojis={[]} {groupLabel} onPick={() => {}} onClose={() => {}} />
{/if}

<style>
  .anchor {
    color: var(--color-text-muted);
  }
</style>
