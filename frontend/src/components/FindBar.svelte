<script lang="ts">
  /**
   * Find and replace in the page: a bar over the Document; over the Canvas,
   * find only (`replace` off).
   * Enter steps to the next match, Shift+Enter to the previous, Escape
   * closes. The count says where you are.
   *
   * Presentational: it reports what was typed and asked for; the Document
   * editor finds and replaces.
   */
  import ToolIcon from './ToolIcon.svelte';
  import { t } from '../i18n/t';

  type Props = {
    count: number;
    /** Which match is selected, from 0; -1 for none. */
    index: number;
    onFind: (text: string) => void;
    onNext: () => void;
    onPrevious: () => void;
    onReplace?: (text: string) => void;
    onReplaceAll?: (text: string) => void;
    onClose: () => void;
    /**
     * Which field to put the caret in; a new `at` asks again. With `text`,
     * the find field shows it, as when search opens a page at a match.
     */
    focus: { field: 'find' | 'replace'; at: number; text?: string };
    /** Whether replacing is offered: off on the Canvas. */
    replace?: boolean;
    /** What the bar finds in, for a screen reader. */
    label?: string;
    /** `bar` across the top of the page; `floating` over the Canvas, outlined and lifted. */
    look?: 'bar' | 'floating';
  };

  let { count, index, focus, onFind, onNext, onPrevious, onReplace, onReplaceAll, onClose, replace = true, label = t('find.label'), look = 'bar' }: Props = $props();

  let query = $state('');
  let replacement = $state('');

  function keydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    } else if (event.key === 'Enter' && event.currentTarget === findField) {
      event.preventDefault();
      if (event.shiftKey) onPrevious();
      else onNext();
    }
  }

  let findField: HTMLInputElement = $state()!;
  let replaceField: HTMLInputElement | undefined = $state();

  $effect(() => {
    const field = (focus.field === 'replace' && replace ? replaceField : undefined) ?? findField;
    void focus.at;
    if (focus.text !== undefined) query = focus.text;
    field.focus();
    field.select();
  });
  const position = $derived(count === 0 ? t('find.none') : t('find.position').replace('{n}', String(index + 1)).replace('{count}', String(count)));
</script>

<div class="find" class:floating={look === 'floating'} role="search" aria-label={label}>
  <input
    bind:this={findField}
    class="bava-field"
    type="search"
    placeholder={t('find.placeholder')}
    aria-label={t('find.placeholder')}
    bind:value={query}
    oninput={() => onFind(query)}
    onkeydown={keydown}
  />
  <span class="position" aria-live="polite">{query ? position : ''}</span>
  <!-- A chevron is half the height of its box: at the small size an enabled one read as disabled. -->
  <button type="button" class="bava-icon-button" aria-label={t('find.previous')} title={t('find.previous')} disabled={count === 0} onclick={onPrevious}>
    <ToolIcon id="chevronUp" />
  </button>
  <button type="button" class="bava-icon-button" aria-label={t('find.next')} title={t('find.next')} disabled={count === 0} onclick={onNext}>
    <ToolIcon id="chevronDown" />
  </button>
  {#if replace}
    <input
      bind:this={replaceField}
      class="bava-field"
      placeholder={t('find.replacePlaceholder')}
      aria-label={t('find.replacePlaceholder')}
      bind:value={replacement}
      onkeydown={keydown}
    />
    <button type="button" class="bava-button" disabled={count === 0} onclick={() => onReplace?.(replacement)}>{t('find.replace')}</button>
    <button type="button" class="bava-button" disabled={count === 0} onclick={() => onReplaceAll?.(replacement)}>{t('find.replaceAll')}</button>
  {/if}
  <button type="button" class="bava-icon-button" aria-label={t('dialog.close')} title={t('dialog.close')} onclick={onClose}>
    <ToolIcon id="close" size="sm" />
  </button>
</div>

<style>
  .find {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border-bottom: var(--border-width) solid var(--color-border-subtle);
    background: var(--color-surface-nav);
  }

  .find.floating {
    border: var(--border-width) solid var(--color-border-strong);
    border-radius: var(--radius-lg);
    background: var(--color-surface-raised);
    box-shadow: var(--shadow-floating);
  }

  .position {
    min-width: var(--size-find-count);
    font-size: var(--text-meta);
    color: var(--color-text-muted);
  }
</style>
