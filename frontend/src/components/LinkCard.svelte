<script lang="ts">
  /**
   * The card under a clicked link: its address, and Open, Edit and Remove. A
   * link to a page the Space does not have says so, and offers the one page
   * with that name. On a locked page it offers Open only. Escape, or a press
   * outside it, closes it; the caret stays in the page unless it was opened
   * from the keyboard, when focus starts on its first button.
   *
   * Presentational: the caller follows, edits or relinks the link.
   */
  import Portal from './Portal.svelte';
  import { t } from '../i18n/t';

  type Props = {
    /** The link's start on screen; the card sits below it. */
    at: { left: number; bottom: number };
    href: string;
    missing: boolean;
    /** The page a missing link can point at instead; null for none. */
    relinkName: string | null;
    onOpen: () => void;
    onEdit: () => void;
    onRemove: () => void;
    onRelink: () => void;
    onClose: () => void;
    /** A locked page: the link can be followed, never changed. */
    readOnly?: boolean;
    /** Opened from the keyboard: focus goes to its first button. */
    focusFirst?: boolean;
  };

  let { at, href, missing, relinkName, onOpen, onEdit, onRemove, onRelink, onClose, readOnly = false, focusFirst = false }: Props = $props();

  let card: HTMLDivElement | undefined = $state();

  // Spaces and other encoded characters as a person reads them.
  const address = $derived.by(() => {
    try {
      return decodeURI(href);
    } catch {
      return href;
    }
  });

  $effect(() => {
    if (focusFirst) card?.querySelector('button')?.focus();
  });

  $effect(() => {
    const away = (event: PointerEvent) => {
      if (card && !card.contains(event.target as Node)) onClose();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('pointerdown', away, true);
    document.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('pointerdown', away, true);
      document.removeEventListener('keydown', escape, true);
    };
  });
</script>

<Portal>
  <div
    bind:this={card}
    class="link-card"
    role="dialog"
    aria-label={t('linkCard.label')}
    style:left={`${at.left}px`}
    style:top={`calc(${at.bottom}px + var(--space-1))`}
  >
    <div class="address" title={address}>{address}</div>
    {#if missing}
      <div class="missing">{t('linkCard.missing')}</div>
    {/if}
    <div class="actions">
      {#if missing && relinkName && !readOnly}
        <button type="button" class="bava-button primary" onclick={onRelink}>{t('linkCard.relink').replace('{name}', relinkName)}</button>
      {:else if !missing}
        <button type="button" class="bava-button" onclick={onOpen}>{t('linkCard.open')}</button>
      {/if}
      {#if !readOnly}
        <button type="button" class="bava-button ghost" onclick={onEdit}>{t('linkCard.edit')}</button>
        <button type="button" class="bava-button ghost" onclick={onRemove}>{t('linkCard.remove')}</button>
      {/if}
    </div>
  </div>
</Portal>

<style>
  .link-card {
    position: fixed;
    z-index: var(--z-portal);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    max-width: var(--size-link-card);
    padding: var(--space-2);
    background: var(--color-surface-overlay);
    border: var(--border-width) solid var(--color-border-subtle);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-floating);
  }

  .address {
    overflow: hidden;
    font-size: var(--text-control);
    color: var(--color-text-secondary);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .missing {
    font-size: var(--text-meta);
    color: var(--color-danger);
  }

  .actions {
    display: flex;
    gap: var(--space-1);
  }
</style>
