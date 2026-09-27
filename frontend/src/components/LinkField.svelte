<script lang="ts">
  /**
   * The link field over selected text: type an address and press Enter to
   * link it, Remove to unlink, Escape to leave it as it was.
   *
   * Presentational: it reports the address; the Document editor links.
   */
  import { Portal } from '@ark-ui/svelte';
  import { portalRoot } from './portal-root';
  import { t } from '../i18n/t';

  type Props = {
    /** The selection's top left on screen; the field sits above it. */
    at: { left: number; top: number };
    /** The address the selection links to now, if any. */
    value: string;
    onApply: (href: string) => void;
    onRemove: () => void;
    onCancel: () => void;
  };

  let { at, value, onApply, onRemove, onCancel }: Props = $props();

  // Seeded once from the link the selection has; the field then owns it.
  // svelte-ignore state_referenced_locally
  let href = $state(value);
  let field: HTMLInputElement;

  $effect(() => {
    field.focus();
    field.select();
  });
</script>

<Portal container={portalRoot()}>
  <form
    class="link-field"
    style:left={`${at.left}px`}
    style:top={`calc(${at.top}px - var(--size-row-lg) - var(--space-3))`}
    onsubmit={(event) => {
      event.preventDefault();
      onApply(href);
    }}
  >
    <input
      bind:this={field}
      bind:value={href}
      class="bava-field"
      placeholder={t('link.placeholder')}
      aria-label={t('link.placeholder')}
      onkeydown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onCancel();
        }
      }}
    />
    <button type="button" class="bava-button ghost" onclick={onRemove}>{t('link.remove')}</button>
  </form>
</Portal>

<style>
  .link-field {
    position: fixed;
    z-index: var(--z-portal);
    display: flex;
    gap: var(--space-1);
    padding: var(--space-1);
    background: var(--color-surface-overlay);
    border: var(--border-width) solid var(--color-border-subtle);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-floating);
  }
</style>
