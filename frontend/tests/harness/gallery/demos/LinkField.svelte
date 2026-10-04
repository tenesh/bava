<script lang="ts">
  import LinkField from '../../../../src/components/LinkField.svelte';
  import { t } from '../../../../src/i18n/t';
  import Cell from '../Cell.svelte';
  import { settledBox } from '../settled';

  let { variant }: { variant: string } = $props();

  let anchor: HTMLElement | undefined = $state();
  let at = $state<{ left: number; top: number } | null>(null);
  $effect(() => {
    if (anchor) void settledBox(anchor).then((box) => (at = { left: box.left, top: box.top }));
  });
</script>

<Cell name="over selected words" width="26rem" height="5rem">
  <p class="line"><mark class="selected" bind:this={anchor}>selected words</mark> of a paragraph.</p>
</Cell>
{#if at}
  {#if variant === 'linked'}
    <LinkField {at} value="https://example.com/docs" onApply={() => {}} onRemove={() => {}} onCancel={() => {}} />
  {:else if variant === 'caption'}
    <LinkField {at} value="" placeholder={t('media.captionPlaceholder')} removeLabel={null} keepOnAway onApply={() => {}} onRemove={() => {}} onCancel={() => {}} />
  {:else}
    <LinkField {at} value="" onApply={() => {}} onRemove={() => {}} onCancel={() => {}} />
  {/if}
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
