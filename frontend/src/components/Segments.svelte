<script lang="ts" generics="T extends string">
  /**
   * A small set of mutually exclusive choices, wrapping Ark's SegmentGroup.
   *
   * Ark supplies the radio semantics and arrow-key navigation; a row of
   * buttons with `role="radio"` has neither.
   */
  import { SegmentGroup } from '@ark-ui/svelte';

  type Props = {
    value: T;
    options: { value: T; label: string }[];
    /** Accessible name for the group. */
    label: string;
    onValueChange: (value: T) => void;
  };

  let { value, options, label, onValueChange }: Props = $props();
</script>

<SegmentGroup.Root
  {value}
  onValueChange={(details) => details.value && onValueChange(details.value as T)}
  class="bava-segments"
  aria-label={label}
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
  /* Global: Ark renders these elements itself, so scoping cannot reach them. */
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
