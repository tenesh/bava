<script lang="ts">
  /**
   * The row above a page in the Document: where it is (its folders, then its
   * name) and the page's ⋯ menu, with a lock shown when the
   * page is locked.
   *
   * Presentational: it reports where the menu should open.
   */
  import ToolIcon from './ToolIcon.svelte';
  import Tooltip from './Tooltip.svelte';
  import { t } from '../i18n/t';
  import { fitCrumbs, type CrumbFit } from './crumbs';

  type Props = {
    /** The page's folders, then its name. */
    crumbs: string[];
    locked: boolean;
    onMenu: (anchor: { x: number; y: number }) => void;
  };

  let { crumbs, locked, onMenu }: Props = $props();

  const folders = $derived(crumbs.slice(0, -1));
  const name = $derived(crumbs.at(-1) ?? '');
  const path = $derived(folders.join(' / '));

  let nav: HTMLElement | undefined = $state();
  let measure: HTMLElement | undefined = $state();
  let fit = $state<CrumbFit>('whole');
  /** Each folder's floor while the folders are shortened. */
  let floors = $state<number[]>([]);

  /** Reads the crumbs' natural widths from the hidden copy and picks a fit. */
  function refit() {
    if (!nav || !measure) return;
    const width = (element: Element | null) => element?.getBoundingClientRect().width ?? 0;
    const folderWidths = [...measure.querySelectorAll('[data-folder]')].map(width);
    const nameWidth = width(measure.querySelector('[data-name]'));
    const folderMin = width(measure.querySelector('[data-min]'));
    const total = width(measure.querySelector('[data-row]'));
    const chrome = total - nameWidth - folderWidths.reduce((sum, each) => sum + each, 0);
    fit = fitCrumbs({ available: nav.clientWidth, folders: folderWidths, name: nameWidth, chrome, folderMin });
    floors = folderWidths.map((each) => Math.min(each, folderMin));
  }

  $effect(() => {
    void crumbs;
    refit();
  });

  // The row's width and the crumbs' (once the font has loaded) both move the fit.
  $effect(() => {
    if (!nav || !measure || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(refit);
    observer.observe(nav);
    observer.observe(measure);
    return () => observer.disconnect();
  });
</script>

<div class="page-header">
  <nav class="crumbs" aria-label={t('doc.where')} bind:this={nav} data-fit={fit}>
    {#if fit === 'fold'}
      <!-- A tooltip trigger, as Ark draws one: focusable, so the keyboard reaches the folders it holds. -->
      <Tooltip label={path} placement="bottom">
        {#snippet trigger(tipProps)}
          <span {...tipProps()} class="crumb folded" role="button" tabindex="0" aria-label={path}>{t('doc.folded')}</span>
        {/snippet}
      </Tooltip>
      <span class="sep" aria-hidden="true">/</span>
    {:else}
      {#each folders as folder, index (index)}
        <span class="crumb" style:min-width={fit === 'shorten' ? `${floors[index] ?? 0}px` : undefined}>{folder}</span>
        <span class="sep" aria-hidden="true">/</span>
      {/each}
    {/if}
    <span class="crumb current">{name}</span>
    <span class="measure" aria-hidden="true" bind:this={measure}>
      <span class="measure-row" data-row>
        {#each folders as folder, index (index)}
          <span data-folder>{folder}</span>
          <span>/</span>
        {/each}
        <span data-name>{name}</span>
      </span>
      <span class="measure-min" data-min></span>
    </span>
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
    position: relative;
    display: flex;
    flex: 1 1 auto;
    align-items: center;
    gap: var(--size-label-inset);
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
  }

  /* A cut crumb ends in an ellipsis. The folders give way first: shortened
     to their floors, then folded into one; the name only once they have. */
  .crumb {
    flex: 0 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sep,
  .folded {
    flex: none;
  }

  /* It names the folders on hover and focus; a press does nothing. */
  .folded {
    cursor: default;
  }

  .current {
    color: var(--color-text-secondary);
  }

  .crumbs:not([data-fit='fold']) .current {
    flex-shrink: 0;
  }

  /* An unseen copy at natural width, measured to choose the fit. */
  .measure {
    position: absolute;
    inset-inline-start: 0;
    top: 0;
    display: flex;
    width: max-content;
    visibility: hidden;
    pointer-events: none;
  }

  .measure-row {
    display: flex;
    gap: var(--size-label-inset);
  }

  .measure-row > span {
    flex: none;
  }

  .measure-min {
    width: var(--size-crumb-min);
  }

  /* Only the crumbs give way: a long name would otherwise squeeze these too. */
  .locked,
  .page-header > .bava-icon-button {
    flex: none;
  }

  .locked {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    margin-inline-start: auto;
    color: var(--color-text-muted);
  }

</style>
