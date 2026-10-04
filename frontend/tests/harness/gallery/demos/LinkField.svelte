<script lang="ts">
  import LinkField from '../../../../src/components/LinkField.svelte';
  import { t } from '../../../../src/i18n/t';
  import Cell from '../Cell.svelte';
  import { settledBox } from '../settled';

  // A new link, its field focused as it opens; a link with its address; and a
  // caption: each over its words.
  const fields = [
    { name: 'a new link', value: '', caption: false },
    { name: 'linked', value: 'https://example.com/docs', caption: false },
    { name: 'a caption', value: '', caption: true },
  ];

  const anchors = $state<(HTMLElement | undefined)[]>([]);
  const at = $state<({ left: number; top: number } | null)[]>(fields.map(() => null));
  $effect(() => {
    anchors.forEach((anchor, index) => {
      if (anchor) void settledBox(anchor).then((box) => (at[index] = { left: box.left, top: box.top }));
    });
  });
</script>

{#each fields as field, index (field.name)}
  <Cell
    name={field.name}
    width="26rem"
    height="5rem"
    force={index === 0 ? 'focus' : undefined}
    scope="page"
    target={index === 0 ? '.link-field input' : undefined}
  >
    <p class="line"><mark class="selected" bind:this={anchors[index]}>selected words</mark> of a paragraph.</p>
  </Cell>
{/each}

{#each fields as field, index (field.name)}
  {@const place = at[index]}
  {#if place}
    {#if field.caption}
      <LinkField at={place} value="" placeholder={t('media.captionPlaceholder')} removeLabel={null} keepOnAway onApply={() => {}} onRemove={() => {}} onCancel={() => {}} />
    {:else}
      <LinkField at={place} value={field.value} onApply={() => {}} onRemove={() => {}} onCancel={() => {}} />
    {/if}
  {/if}
{/each}

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
