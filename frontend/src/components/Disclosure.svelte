<script lang="ts">
  /**
   * A section that starts collapsed, wrapping Ark's Collapsible.
   *
   * Class names are prefixed and global because Ark renders the elements.
   */
  import { Collapsible } from '@ark-ui/svelte';
  import type { Snippet } from 'svelte';

  type Props = {
    label: string;
    children: Snippet;
  };

  let { label, children }: Props = $props();
</script>

<Collapsible.Root class="bava-disclosure">
  <Collapsible.Trigger class="bava-disclosure-trigger">{label}</Collapsible.Trigger>
  <Collapsible.Content class="bava-disclosure-content">
    {@render children()}
  </Collapsible.Content>
</Collapsible.Root>

<style>
  :global(.bava-disclosure-trigger) {
    height: var(--size-row);
    padding: 0;
    border: 0;
    background: transparent;
    font: inherit;
    font-size: var(--text-meta);
    color: var(--color-text-secondary);
  }

  :global(.bava-disclosure-trigger:focus-visible) {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
    outline-offset: var(--focus-halo-width);
  }

  :global(.bava-disclosure-content) {
    margin-top: var(--space-2);
  }
</style>
