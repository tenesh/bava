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
  import ToolIcon from './ToolIcon.svelte';
  import { t } from '../i18n/t';

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
    size?: 'default' | 'narrow' | 'medium' | 'wide' | 'about' | 'export' | 'settings' | 'diagram' | 'shortcuts' | 'trash' | 'viewer' | 'media';
    /** The body runs to the frame's edges, for panes that draw their own. */
    flush?: boolean;
    /** The header is hidden from sight but still names the dialog. */
    headless?: boolean;
    /** An alert's column, centred. */
    align?: 'start' | 'center';
    /** Shown above an alert's title: a mark, an icon. */
    leading?: Snippet;
    /** A line beside the title, in muted type: what the dialog is for. */
    subtitle?: string;
    /** A close button at the header's end. */
    closable?: boolean;
    /** Controls at the header's end, before the close button. */
    actions?: Snippet;
    /** The dialog's buttons, in a ruled footer, at the end. */
    footer?: Snippet;
    /**
     * `alert` keeps a short question or error in one box: title, text and
     * buttons, with no header or footer rule.
     */
    variant?: 'sectioned' | 'alert';
    onOpenChange?: (open: boolean) => void;
    children: Snippet;
  };

  let {
    open = $bindable(),
    title,
    unmountWhenClosed = false,
    size = 'default',
    subtitle,
    closable = false,
    actions,
    footer,
    variant = 'sectioned',
    flush = false,
    headless = false,
    align = 'start',
    leading,
    onOpenChange,
    children,
  }: Props = $props();

  // Opening focuses what the dialog marks `data-autofocus` (its first field),
  // else Ark's default, the first thing focusable.
  const uid = $props.id();
  const initialFocus = () => document.querySelector<HTMLElement>(`[data-dialog="${uid}"] [data-autofocus]`);
</script>

<Dialog.Root
  bind:open
  lazyMount={unmountWhenClosed}
  unmountOnExit={unmountWhenClosed}
  onOpenChange={(details) => onOpenChange?.(details.open)}
  initialFocusEl={() => initialFocus()}
>
  <Portal container={portalRoot()}>
    <Dialog.Backdrop class="bava-dialog-backdrop" />
    <Dialog.Positioner class="bava-dialog-positioner">
      <Dialog.Content class="bava-dialog-content" data-dialog={uid} data-size={size} data-variant={variant} data-align={align}>
        {#if variant === 'alert'}
          {#if leading}{@render leading()}{/if}
          <Dialog.Title class="bava-dialog-title">{title}</Dialog.Title>
          {@render children()}
        {:else}
          <div class="bava-dialog-header" data-hidden={headless ? 'true' : undefined}>
            <Dialog.Title class="bava-dialog-title">{title}</Dialog.Title>
            {#if subtitle}<span class="bava-dialog-subtitle">{subtitle}</span>{/if}
            {#if actions || closable}
              <span class="bava-dialog-actions">
                {#if actions}{@render actions()}{/if}
                {#if closable}
                  <Dialog.CloseTrigger class="bava-dialog-close" aria-label={t('dialog.close')}>
                    <ToolIcon id="close" size="sm" />
                  </Dialog.CloseTrigger>
                {/if}
              </span>
            {/if}
          </div>
          <div class="bava-dialog-body" data-flush={flush ? 'true' : undefined}>
            {@render children()}
          </div>
          {#if footer}
            <div class="bava-dialog-footer">{@render footer()}</div>
          {/if}
        {/if}
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
    display: flex;
    flex-direction: column;
    max-height: var(--size-dialog-max-height);
    background: var(--color-surface-overlay);
    color: var(--color-text-primary);
    border: var(--border-width) solid var(--color-border-subtle);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-overlay);
    overflow: hidden;
  }

  :global(.bava-dialog-content[data-variant='alert']) {
    gap: var(--space-3);
    padding: var(--space-5);
  }

  :global(.bava-dialog-content[data-align='center']) {
    align-items: center;
    text-align: center;
    padding: var(--space-7);
  }

  :global(.bava-dialog-content[data-align='center'] .bava-dialog-title) {
    font-size: var(--text-title-about);
  }

  :global(.bava-dialog-content[data-size='about']) {
    box-sizing: border-box;
    width: var(--size-dialog-about);
  }

  :global(.bava-dialog-content[data-size='export']) {
    box-sizing: border-box;
    width: var(--size-dialog-export);
  }

  :global(.bava-dialog-content[data-size='settings']) {
    box-sizing: border-box;
    width: var(--size-settings-width);
    height: var(--size-settings-height);
  }

  :global(.bava-dialog-content[data-size='diagram']) {
    box-sizing: border-box;
    width: var(--size-diagram-dialog-width);
    height: var(--size-diagram-dialog-height);
  }

  :global(.bava-dialog-content[data-size='shortcuts']) {
    box-sizing: border-box;
    width: var(--size-dialog-shortcuts-width);
    height: var(--size-dialog-shortcuts-height);
  }

  :global(.bava-dialog-content[data-size='trash']) {
    box-sizing: border-box;
    width: var(--size-dialog-trash-width);
    height: var(--size-dialog-trash-height);
  }

  :global(.bava-dialog-content[data-size='media']) {
    box-sizing: border-box;
    width: var(--size-dialog-media-width);
    height: var(--size-dialog-media-height);
  }

  :global(.bava-dialog-content[data-size='viewer']) {
    box-sizing: border-box;
    width: var(--size-media-viewer-width);
    height: var(--size-media-viewer-height);
  }

  :global(.bava-dialog-content[data-size='viewer'] .bava-dialog-header[data-hidden='true'] + .bava-dialog-body) {
    height: 100%;
  }

  :global(.bava-dialog-content[data-size='narrow']) {
    box-sizing: border-box;
    width: var(--size-dialog-narrow);
  }

  :global(.bava-dialog-content[data-size='medium']) {
    box-sizing: border-box;
    width: var(--size-dialog-medium);
  }

  :global(.bava-dialog-content[data-size='wide']) {
    box-sizing: border-box;
    width: var(--size-dialog-wide);
  }

  :global(.bava-dialog-header) {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-4) var(--space-5);
    border-bottom: var(--border-width) solid var(--color-border-subtle);
  }

  :global(.bava-dialog-title) {
    margin: 0;
    font-size: var(--text-title);
    font-weight: var(--weight-semibold);
  }

  :global(.bava-dialog-subtitle) {
    font-size: var(--text-meta);
    color: var(--color-text-muted);
  }

  :global(.bava-dialog-actions) {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-inline-start: auto;
  }

  :global(.bava-dialog-close) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--size-row-lg);
    height: var(--size-row-lg);
    padding: 0;
    border: 0;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-text-secondary);
  }

  :global(.bava-dialog-close:hover) {
    background: var(--color-control-hover);
    color: var(--color-text-primary);
  }

  :global(.bava-dialog-close:active) {
    background: var(--color-control-active);
  }

  :global(.bava-dialog-close:focus-visible) {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
  }

  :global(.bava-dialog-body) {
    flex: 1 1 auto;
    min-height: 0;
    padding: var(--space-5);
    overflow: auto;
  }

  :global(.bava-dialog-body[data-flush='true']) {
    padding: 0;
    overflow: hidden;
  }

  /* Hidden from sight, not from assistive technology: it names the dialog. */
  :global(.bava-dialog-header[data-hidden='true']) {
    position: absolute;
    width: var(--border-width);
    height: var(--border-width);
    margin: calc(var(--border-width) * -1);
    padding: 0;
    border: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  :global(.bava-dialog-footer) {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-5);
    border-top: var(--border-width) solid var(--color-border-subtle);
  }
</style>
