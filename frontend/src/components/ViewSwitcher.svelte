<script lang="ts">
  /** Document | Both | Canvas, wrapping Ark's SegmentGroup. */
  import { SegmentGroup } from '@ark-ui/svelte';
  import { t } from '../i18n/t';
  import type { ViewMode } from '../shell/view.svelte';

  type Props = {
    value: ViewMode;
    onValueChange: (value: ViewMode) => void;
  };

  let { value, onValueChange }: Props = $props();

  const options: { value: ViewMode; label: string }[] = [
    { value: 'document', label: t('view.document') },
    { value: 'both', label: t('view.both') },
    { value: 'canvas', label: t('view.canvas') },
  ];
</script>

<SegmentGroup.Root
  {value}
  onValueChange={(details) => details.value && onValueChange(details.value as ViewMode)}
  class="bava-segments"
  aria-label={t('view.switcher')}
>
  {#each options as option (option.value)}
    <SegmentGroup.Item value={option.value} class="bava-segment">
      <SegmentGroup.ItemText>{option.label}</SegmentGroup.ItemText>
      <SegmentGroup.ItemControl />
      <SegmentGroup.ItemHiddenInput />
    </SegmentGroup.Item>
  {/each}
</SegmentGroup.Root>

<style>
  :global(.bava-segments) {
    display: inline-flex;
    gap: var(--space-1);
    padding: var(--space-1);
    background: var(--color-surface-sunken);
    border-radius: var(--radius-md);
  }

  :global(.bava-segment) {
    padding: 0 var(--space-3);
    height: var(--size-row);
    display: inline-flex;
    align-items: center;
    border-radius: var(--radius-sm);
    font-size: var(--text-control);
    color: var(--color-text-secondary);
    cursor: default;
  }

  :global(.bava-segment[data-state='checked']) {
    background: var(--color-surface-raised);
    color: var(--color-text-primary);
  }

  :global(.bava-segment:focus-within) {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
    outline-offset: calc(var(--focus-halo-width) * -1);
  }
</style>
