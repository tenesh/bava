<script lang="ts">
  /**
   * A Space's Trash: what was deleted, where it came from,
   * when; Restore, Delete, Empty Trash. Items stay until the user removes them.
   *
   * A row's buttons show on the row under the pointer, the one last clicked,
   * and the one holding the keyboard focus, so Tab still reaches them.
   *
   * Presentational: the caller lists the Trash and runs each action, and
   * confirms the ones with no undo.
   */
  import Dialog from './Dialog.svelte';
  import ToolIcon from './ToolIcon.svelte';
  import { t } from '../i18n/t';

  type Item = { id: string; path: string; kind: 'page' | 'folder' | 'attachment'; deletedAt: string; size: string };

  type Props = {
    open: boolean;
    items: Item[];
    total: string;
    onRestore: (id: string) => void;
    onDelete: (id: string) => void;
    onEmpty: () => void;
    onOpenChange: (open: boolean) => void;
  };

  let { open = $bindable(), items, total, onRestore, onDelete, onEmpty, onOpenChange }: Props = $props();

  let query = $state('');
  let selected = $state<string | null>(null);
  const shown = $derived(query.trim() ? items.filter((item) => item.path.toLowerCase().includes(query.trim().toLowerCase())) : items);

  const nameOf = (path: string) => path.split('/').pop()!.replace(/\.md$/i, '');
  // An attachment came from Media, not from a folder anyone sees.
  const folderOf = (path: string) =>
    path.startsWith('.bava/attachments/') ? t('pane.media') : path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : t('trash.top');
  const when = (iso: string) => {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  };
</script>

<Dialog bind:open title={t('trash.title')} subtitle={t('trash.subtitle')} size="trash" flush closable {onOpenChange}>
  {#snippet actions()}
    <button type="button" class="bava-button danger" disabled={items.length === 0} onclick={onEmpty}>{t('trash.empty')}</button>
  {/snippet}
  <div class="trash">
    <div class="bar">
      <input class="search" type="search" data-autofocus placeholder={t('trash.search')} aria-label={t('trash.search')} bind:value={query} />
      <span class="total">{t('trash.total').replace('{size}', total)}</span>
    </div>
    <div class="columns row" aria-hidden="true">
      <span></span>
      <span class="label">{t('trash.column.name')}</span>
      <span class="label">{t('trash.column.from')}</span>
      <span class="label">{t('trash.column.deleted')}</span>
      <span></span>
    </div>
    {#if shown.length === 0}
      <p class="none">{items.length === 0 ? t('trash.none') : t('trash.noMatch')}</p>
    {:else}
      <ul class="list">
        {#each shown as item (item.id)}
          <!-- Clicking a row only marks it; the keyboard reaches its buttons by Tab. -->
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
          <li class="item row" class:selected={selected === item.id} onclick={() => (selected = item.id)}>
            <ToolIcon id={item.kind === 'folder' ? 'folder' : item.kind === 'attachment' ? 'document' : 'page'} size="sm" />
            <span class="name">{nameOf(item.path)} <span class="meta">· {item.size}</span></span>
            <span class="meta">{folderOf(item.path)}</span>
            <span class="meta">{when(item.deletedAt)}</span>
            <span class="buttons">
              <button type="button" class="bava-button" aria-label={t('trash.restoreItem').replace('{name}', nameOf(item.path))} onclick={() => onRestore(item.id)}>{t('trash.restore')}</button>
              <button type="button" class="bava-button danger" aria-label={t('trash.deleteItem').replace('{name}', nameOf(item.path))} onclick={() => onDelete(item.id)}>{t('trash.delete')}</button>
            </span>
          </li>
        {/each}
      </ul>
    {/if}
    <p class="hint">{t('trash.hint')}</p>
  </div>
</Dialog>

<style>
  /*
   * The Trash keeps one size as items come and go. It spans the body edge to
   * edge, so its rows run full width; its height leaves room for the header
   * (its padding, its close button and its rule).
   */
  .trash {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .bar {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-5);
    border-bottom: var(--border-width) solid var(--color-border-subtle);
  }

  .search {
    box-sizing: border-box;
    width: var(--size-trash-search);
    height: var(--size-row-lg);
    padding: 0 var(--space-2);
    border: var(--border-width) solid var(--color-border-subtle);
    border-radius: var(--radius-md);
    background: var(--color-surface-raised);
    color: var(--color-text-primary);
    font: inherit;
    font-size: var(--text-control);
  }

  .search:focus {
    outline: none;
    border-color: var(--color-focus-ring);
    box-shadow: 0 0 0 var(--focus-halo-width) var(--color-focus-halo);
  }

  .total {
    margin-left: auto;
    font-size: var(--text-meta);
    color: var(--color-text-muted);
  }

  .row {
    display: grid;
    grid-template-columns:
      var(--size-trash-col-icon) minmax(0, 1fr) var(--size-trash-col-from) var(--size-trash-col-deleted)
      var(--size-trash-col-actions);
    align-items: center;
    gap: var(--space-3);
    padding: 0 var(--space-5);
    border-bottom: var(--border-width) solid var(--color-border-subtle);
  }

  .columns {
    flex: none;
    height: var(--size-toolbar);
    background: var(--color-surface-sunken);
  }

  .label {
    font-size: var(--text-label);
    font-weight: var(--weight-semibold);
    font-family: var(--font-label);
    letter-spacing: var(--tracking-label);
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .list {
    flex: 0 1 auto;
    min-height: 0;
    margin: 0;
    padding: 0;
    list-style: none;
    overflow: auto;
  }

  .item {
    height: var(--size-trash-row);
    font-size: var(--text-control);
    color: var(--color-text-primary);
  }

  .item.selected {
    background: var(--color-selection);
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .meta {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--text-meta);
    color: var(--color-text-muted);
    font-family: var(--font-data);
    font-variant-numeric: tabular-nums;
  }

  .buttons {
    display: flex;
    justify-content: flex-end;
    gap: var(--size-button-gap);
    opacity: 0;
  }

  .item:hover .buttons,
  .item:focus-within .buttons,
  .item.selected .buttons {
    opacity: 1;
  }

  .none {
    margin: 0;
    padding: var(--space-4) var(--space-5);
    font-size: var(--text-control);
    color: var(--color-text-muted);
  }

  .hint {
    margin: auto var(--space-5) var(--space-4);
    padding-top: var(--space-3);
    font-size: var(--text-note);
    color: var(--color-text-muted);
  }
</style>
