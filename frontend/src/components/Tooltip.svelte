<script lang="ts">
  /**
   * A button that names itself on hover and focus, wrapping Ark's Tooltip.
   *
   * The button is the trigger: every attribute and handler passed in lands on
   * it, so a caller writes one element, not a wrapper around its own button.
   * Presentational only.
   */
  import type { Snippet } from 'svelte';
  import { Portal, Tooltip } from '@ark-ui/svelte';
  import { portalRoot } from './portal-root';

  type Placement = 'right' | 'left' | 'top' | 'bottom';

  /** What the button needs; kept narrow so it stays assignable to Ark's trigger. */
  type ButtonProps = {
    type?: 'button' | 'submit';
    class?: string;
    'aria-label'?: string;
    'aria-pressed'?: boolean;
    'aria-expanded'?: boolean;
    'data-active'?: boolean;
    /** Marks the control that opens and closes the insert panel. */
    'data-insert-trigger'?: boolean;
    disabled?: boolean;
    onclick?: (event: MouseEvent) => void;
  };

  type Props = ButtonProps & {
    label: string;
    /** The key that does the same, shown after the label. */
    keys?: string;
    placement?: Placement;
    children: Snippet;
  };

  let { label, keys, placement = 'right', children, ...button }: Props = $props();

  /** Long enough not to flash while the pointer crosses a toolbar; a named tunable. */
  const OPEN_DELAY_MS = 400;
</script>

<Tooltip.Root openDelay={OPEN_DELAY_MS} closeDelay={0} positioning={{ placement }}>
  <Tooltip.Trigger {...button}>
    {@render children()}
  </Tooltip.Trigger>
  <Portal container={portalRoot()}>
    <Tooltip.Positioner>
      <Tooltip.Content class="bava-tooltip">
        <span>{label}</span>
        {#if keys}<kbd class="bava-tooltip-key">{keys}</kbd>{/if}
      </Tooltip.Content>
    </Tooltip.Positioner>
  </Portal>
</Tooltip.Root>

<style>
  :global(.bava-tooltip) {
    z-index: var(--z-portal);
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-1) var(--space-2);
    border: var(--border-width) solid var(--color-border-subtle);
    border-radius: var(--radius-sm);
    background: var(--color-surface-overlay);
    box-shadow: var(--shadow-floating);
    font-size: var(--text-meta);
    color: var(--color-text-primary);
    white-space: nowrap;
  }

  :global(.bava-tooltip[hidden]) {
    display: none;
  }

  :global(.bava-tooltip-key) {
    font-family: var(--font-mono);
    font-size: var(--text-mono-chip);
    color: var(--color-text-muted);
  }
</style>
