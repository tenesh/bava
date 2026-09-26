<script lang="ts">
  /**
   * Dialog, wrapping Ark's.
   *
   * The compound structure stays inside the wrapper rather than being
   * flattened into props: flattening loses composition and fights the
   * library. Screens import this, never `@ark-ui/svelte` directly, so the swap
   * surface stays one file.
   */
  // Class names are prefixed because Ark renders its own elements, so Svelte's
  // scoping cannot reach them and these rules have to be global.
  import { Dialog, Portal } from '@ark-ui/svelte';
  import type { Snippet } from 'svelte';
  import { portalRoot } from './portal-root';

  type Props = {
    open: boolean;
    title: string;
    /**
     * Take the content out of the DOM while closed.
     *
     * Ark keeps it mounted by default, which suits a dialog whose contents are
     * cheap and stateless. A dialog that owns something imperative (an editor)
     * wants this: otherwise the thing it created outlives the close and the
     * next open shows what was there before.
     */
    unmountWhenClosed?: boolean;
    /**
     * `wide` gives the content a width of its own. By default the content is
     * as wide as what it holds, which suits a question with buttons; a dialog
     * whose panes share the width (code beside a preview) shrinks them to
     * nothing without one.
     */
    size?: 'default' | 'wide';
    onOpenChange?: (open: boolean) => void;
    children: Snippet;
  };

  let { open = $bindable(), title, unmountWhenClosed = false, size = 'default', onOpenChange, children }: Props = $props();
</script>

<Dialog.Root
  bind:open
  lazyMount={unmountWhenClosed}
  unmountOnExit={unmountWhenClosed}
  onOpenChange={(details) => onOpenChange?.(details.open)}
>
  <Portal container={portalRoot()}>
    <Dialog.Backdrop class="bava-dialog-backdrop" />
    <Dialog.Positioner class="bava-dialog-positioner">
      <Dialog.Content class="bava-dialog-content" data-size={size}>
        <Dialog.Title class="bava-dialog-title">{title}</Dialog.Title>
        {@render children()}
      </Dialog.Content>
    </Dialog.Positioner>
  </Portal>
</Dialog.Root>

<style>
  :global(.bava-dialog-backdrop) {
    position: fixed;
    inset: 0;
    background: var(--color-backdrop);
  }

  :global(.bava-dialog-positioner) {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
  }

  :global(.bava-dialog-content) {
    background: var(--color-surface-overlay);
    color: var(--color-text-primary);
    border: var(--border-width) solid var(--color-border-subtle);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-overlay);
    padding: var(--space-5);
  }

  :global(.bava-dialog-content[data-size='wide']) {
    box-sizing: border-box;
    width: var(--size-dialog-wide);
  }

  :global(.bava-dialog-title) {
    font-size: var(--text-control);
    font-weight: var(--weight-semibold);
    margin: 0 0 var(--space-3);
  }
</style>
