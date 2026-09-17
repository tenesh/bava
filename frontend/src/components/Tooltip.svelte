<script lang="ts">
  /**
   * A button that names itself on hover and focus, wrapping Ark's Tooltip.
   *
   * The button is the trigger: every attribute and handler passed in lands on
   * it, so a caller writes one element, not a wrapper around its own button.
   * A caller that already renders its own control (another Ark trigger, say)
   * passes `trigger` instead, and spreads the props it is handed onto it.
   * Presentational only.
   */
  import type { Snippet } from 'svelte';
  import { Portal, Tooltip, type TooltipTriggerProps } from '@ark-ui/svelte';
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

  type Common = {
    label: string;
    /** The key that does the same, shown after the label. */
    keys?: string;
    placement?: Placement;
    /**
     * The trigger's element id. Pass it when another machine (a popover, say)
     * shares this element: both then address the same node by the same id.
     */
    triggerId?: string;
  };

  /**
   * Either the tooltip renders the button (with the button props), or the
   * caller renders the control through `trigger` and the props go to it. The
   * two are exclusive, so button props cannot be passed and silently dropped.
   */
  type Props = Common &
    (
      | (ButtonProps & { children: Snippet; trigger?: never })
      | { trigger: TooltipTriggerProps['asChild']; children?: never }
    );

  let { label, keys, placement = 'right', children, trigger, triggerId, ...button }: Props = $props();

  /** Long enough not to flash while the pointer crosses a toolbar; a named tunable. */
  const OPEN_DELAY_MS = 400;
</script>

<Tooltip.Root
  openDelay={OPEN_DELAY_MS}
  closeDelay={0}
  positioning={{ placement }}
  ids={triggerId ? { trigger: triggerId } : undefined}
>
  {#if trigger}
    <Tooltip.Trigger asChild={trigger} />
  {:else}
    <Tooltip.Trigger {...button}>
      {@render children?.()}
    </Tooltip.Trigger>
  {/if}
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
