<script lang="ts">
  /**
   * The Media section under Files: the Space's attachments, compact, to find
   * one and drag it into the page (or place it at the caret with Enter or a
   * double-click). Search by name; Add files; open the Media dialog.
   *
   * Presentational: it shows the items it is handed and reports what the
   * user did; reading, adding and placing are the caller's.
   */
  import ToolIcon from './ToolIcon.svelte';
  import MediaThumb from './MediaThumb.svelte';
  import { shownItems, type MediaItem } from '../files/media';
  import { formatBytes } from '../files/space-helpers';
  import { t } from '../i18n/t';

  type Props = {
    items: MediaItem[];
    /** Where an item's picture loads from; null for its kind's icon. */
    thumb: (item: MediaItem) => string | null;
    onAdd: () => void;
    onOpenDialog: () => void;
    /** An item placed at the page's caret, by its name. */
    onPlace: (name: string) => void;
  };

  let { items, thumb, onAdd, onOpenDialog, onPlace }: Props = $props();

  let search = $state('');
  const shown = $derived(shownItems(items, { filter: 'all', search, sort: 'name' }));
  let list: HTMLUListElement | undefined = $state();

  /** The arrows move between rows, as in a list. */
  function keydown(event: KeyboardEvent, name: string) {
    if (event.key === 'Enter') {
      event.preventDefault();
      onPlace(name);
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const rows = [...(list?.querySelectorAll<HTMLElement>('.media-row') ?? [])];
    const at = rows.indexOf(event.currentTarget as HTMLElement);
    rows[Math.max(0, Math.min(rows.length - 1, at + (event.key === 'ArrowDown' ? 1 : -1)))]?.focus();
  }
</script>

<div class="media-section">
  <div class="media-tools">
    <input class="bava-field media-search" type="search" bind:value={search} placeholder={t('media.search')} aria-label={t('media.search')} />
    <button type="button" class="bava-icon-button" aria-label={t('media.add')} title={t('media.add')} onclick={onAdd}>
      <ToolIcon id="upload" size="sm" />
    </button>
    <button type="button" class="bava-icon-button" aria-label={t('media.openDialog')} title={t('media.openDialog')} onclick={onOpenDialog}>
      <ToolIcon id="expand" size="sm" />
    </button>
  </div>
  {#if items.length === 0}
    <p class="media-empty">{t('media.none')}</p>
  {:else if shown.length === 0}
    <p class="media-empty">{t('media.noMatch')}</p>
  {:else}
    <ul class="media-rows" bind:this={list} aria-label={t('pane.media')}>
      {#each shown as item (item.name)}
        <li>
          <button
            type="button"
            class="media-row"
            draggable="true"
            title={item.name}
            ondragstart={(event) => {
              event.dataTransfer?.setData('application/x-bava-attachment', item.name);
              if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy';
            }}
            ondblclick={() => onPlace(item.name)}
            onkeydown={(event) => keydown(event, item.name)}
          >
            <MediaThumb kind={item.kind} src={thumb(item)} />
            <span class="media-row-name">{item.name}</span>
            <span class="media-row-size">{formatBytes(item.size)}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .media-section {
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;
  }

  .media-tools {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: 0 var(--space-2) var(--space-2);
  }

  .media-search {
    flex: 1;
    min-width: 0;
  }

  .media-rows {
    flex: 1;
    min-height: 0;
    margin: 0;
    padding: 0 var(--space-2);
    overflow-y: auto;
    list-style: none;
  }

  .media-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    height: var(--size-row-lg);
    padding: 0 var(--space-2);
    border: 0;
    border-radius: var(--radius-md);
    background: none;
    color: var(--color-text-primary);
    font: inherit;
    font-size: var(--text-body);
    text-align: left;
    cursor: grab;
  }

  .media-row:hover {
    background: var(--color-control-hover);
  }

  .media-row:active {
    background: var(--color-control-active);
  }

  .media-row:focus-visible {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
    outline-offset: calc(var(--focus-halo-width) * -1);
  }

  .media-row-name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .media-row-size {
    flex: none;
    color: var(--color-text-muted);
    font-size: var(--text-meta);
  }

  .media-empty {
    margin: 0;
    padding: var(--space-2) var(--space-4);
    color: var(--color-text-muted);
    font-size: var(--text-meta);
  }
</style>
