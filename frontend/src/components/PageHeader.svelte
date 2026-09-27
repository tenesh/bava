<script lang="ts">
  /**
   * The row above a page in the Document: where it is (its folders, then its
   * name) and the page's ⋯ menu, with a lock shown when the
   * page is locked.
   *
   * Presentational: it reports where the menu should open.
   */
  import ToolIcon from './ToolIcon.svelte';
  import { t } from '../i18n/t';

  type Props = {
    /** The page's folders, then its name. */
    crumbs: string[];
    locked: boolean;
    onMenu: (anchor: { x: number; y: number }) => void;
  };

  let { crumbs, locked, onMenu }: Props = $props();
</script>

<div class="page-header">
  <nav class="crumbs" aria-label={t('doc.where')}>
    {#each crumbs as crumb, index (index)}
      {#if index > 0}<span class="sep" aria-hidden="true">/</span>{/if}
      <span class:current={index === crumbs.length - 1}>{crumb}</span>
    {/each}
  </nav>
  {#if locked}
    <span class="locked" title={t('doc.locked')}><ToolIcon id="lock" size="sm" /><span class="locked-text">{t('doc.locked')}</span></span>
  {/if}
  <button
    type="button"
    class="bava-icon-button"
    aria-label={t('doc.pageMenu')}
    title={t('doc.pageMenu')}
    aria-haspopup="menu"
    onclick={(event) => {
      const box = event.currentTarget.getBoundingClientRect();
      onMenu({ x: box.right, y: box.bottom });
    }}
  >
    <ToolIcon id="more" size="sm" />
  </button>
</div>

<style>
  .page-header {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    height: var(--size-titlebar);
    padding: 0 var(--space-3) 0 var(--space-5);
    font-size: var(--text-note);
    color: var(--color-text-muted);
    flex: none;
  }

  .crumbs {
    display: flex;
    align-items: center;
    gap: var(--size-label-inset);
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .current {
    color: var(--color-text-secondary);
  }

  .locked {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    margin-inline-start: auto;
    color: var(--color-text-muted);
  }

  .locked + .bava-icon-button,
  .crumbs + .bava-icon-button {
    margin-inline-start: auto;
  }

  .locked + .bava-icon-button {
    margin-inline-start: 0;
  }
</style>
