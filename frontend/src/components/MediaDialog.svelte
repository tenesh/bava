<script lang="ts">
  /**
   * The Media dialog: the Space's attachments, large, for tidying up. A grid
   * or a list; filters by kind and Unused; search; sort by name, size or
   * date. A file chosen shows its pages (each opens), and can be renamed,
   * shown in its folder or deleted. Add files; move every unused file to the
   * Trash.
   *
   * Presentational: the caller lists the files, runs each action, and asks
   * first where one needs asking. A name the caller refuses comes back as the
   * reason, shown under the rename field, which stays open: the dialog is
   * modal, so a word anywhere else sits behind it.
   */
  import Dialog from './Dialog.svelte';
  import Segments from './Segments.svelte';
  import Select from './Select.svelte';
  import ToolIcon from './ToolIcon.svelte';
  import MediaThumb from './MediaThumb.svelte';
  import { localDay, shownItems, type MediaFilter, type MediaItem, type MediaSort } from '../files/media';
  import { formatBytes } from '../files/space-helpers';
  import { formatDay } from '../docs/dates';
  import { t } from '../i18n/t';

  type Props = {
    open: boolean;
    items: MediaItem[];
    /** Whether every page was read; until then no file is called unused, and none can be moved as unused. */
    usageKnown: boolean;
    thumb: (item: MediaItem) => string | null;
    onOpenChange: (open: boolean) => void;
    onAdd: () => void;
    /**
     * A file renamed: its name, and the new one without its type. Answers
     * with the reason when the name is refused.
     */
    onRename: (name: string, next: string) => Promise<string | null | undefined> | void;
    onDelete: (item: MediaItem) => void;
    onReveal: (name: string) => void;
    /** A page that uses the file, opened by its path in the Space. */
    onOpenPage: (path: string) => void;
    onTrashUnused: () => void;
  };

  let { open = $bindable(), items, usageKnown, thumb, onOpenChange, onAdd, onRename, onDelete, onReveal, onOpenPage, onTrashUnused }: Props = $props();

  let view = $state<'grid' | 'list'>('grid');
  let filter = $state<MediaFilter>('all');
  let sort = $state<MediaSort>('name');
  let search = $state('');
  let chosenName = $state<string | null>(null);
  let renaming = $state<string | null>(null);
  let refusal = $state<string | null>(null);
  let renameField: HTMLInputElement | undefined = $state();
  let renameButton: HTMLButtonElement | undefined = $state();
  let root: HTMLDivElement | undefined = $state();

  const shown = $derived(shownItems(items, { filter, search, sort }));
  // A file the filter or search hides is not shown beside the list either.
  const chosen = $derived(shown.find((item) => item.name === chosenName) ?? null);
  const meta = (item: MediaItem) =>
    [formatBytes(item.size), view === 'list' ? formatDay(localDay(item.modified)) : '', item.unused ? t('media.unused') : ''].filter(Boolean).join(' · ');
  const unused = $derived(items.filter((item) => item.unused).length);
  const stem = (name: string) => name.replace(/\.[^.]*$/, '');

  function startRename(item: MediaItem) {
    renaming = stem(item.name);
    refusal = null;
  }

  function stopRenaming() {
    renaming = null;
    refusal = null;
  }

  /**
   * Escape while renaming leaves the rename, not the dialog. Ark listens for
   * Escape on the document, in the capture phase, before the field hears it,
   * and closes unless the key was already handled: the window's capture phase
   * comes first, so the key is claimed there.
   */
  function escapeRename(event: KeyboardEvent) {
    if (event.key !== 'Escape' || event.isComposing || !open || renaming === null) return;
    if (!(event.target instanceof Node) || !root?.contains(event.target)) return;
    event.preventDefault();
    const hadFocus = document.activeElement === renameField;
    stopRenaming();
    if (hadFocus) requestAnimationFrame(() => renameButton?.focus());
  }

  async function renameKey(event: KeyboardEvent, item: MediaItem) {
    if (event.key !== 'Enter' || renaming === null) return;
    event.preventDefault();
    const next = renaming.trim();
    if (!next || next === stem(item.name)) {
      stopRenaming();
      return;
    }
    const reason = await onRename(item.name, next);
    if (!reason) {
      stopRenaming();
      return;
    }
    refusal = reason;
    renameField?.focus();
  }

  /** The arrows move between items: across and down in the grid, down in the list. */
  function itemKey(event: KeyboardEvent) {
    const keys: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 1, ArrowUp: -1 };
    if (!(event.key in keys)) return;
    const all = [...((event.currentTarget as HTMLElement).parentElement?.querySelectorAll<HTMLElement>('.media-item') ?? [])];
    const at = all.indexOf(event.currentTarget as HTMLElement);
    let step = keys[event.key];
    if (view === 'grid' && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      const top = all[at].offsetTop;
      const perRow = all.filter((el) => el.offsetTop === top).length || 1;
      step *= perRow;
    }
    event.preventDefault();
    // One stop in the tab order: the arrows move through the files, choosing each.
    const next = all[Math.max(0, Math.min(all.length - 1, at + step))];
    next?.focus();
    if (next?.dataset.name) {
      chosenName = next.dataset.name;
      stopRenaming();
    }
  }
</script>

<svelte:window onkeydowncapture={escapeRename} />

<Dialog bind:open title={t('pane.media')} subtitle={t('media.dialogSubtitle')} size="media" flush closable unmountWhenClosed {onOpenChange}>
  {#snippet actions()}
    <button type="button" class="bava-button" onclick={onAdd}>{t('media.add')}</button>
    <button type="button" class="bava-button" disabled={!usageKnown || unused === 0} onclick={onTrashUnused}>{t('media.trashUnused')}</button>
  {/snippet}
  <div class="media-dialog" bind:this={root}>
    <div class="bar">
      <input class="bava-field search" type="search" data-autofocus bind:value={search} placeholder={t('media.search')} aria-label={t('media.search')} />
      <Select
        label={t('media.filter')}
        value={filter}
        options={[
          { value: 'all', label: t('media.filter.all') },
          { value: 'images', label: t('media.filter.images') },
          { value: 'videos', label: t('media.filter.videos') },
          { value: 'pdfs', label: t('media.filter.pdfs') },
          { value: 'other', label: t('media.filter.other') },
          { value: 'unused', label: t('media.filter.unused') },
        ]}
        onValueChange={(value) => (filter = value)}
      />
      <Select
        label={t('media.sort')}
        prefix={t('list.sortPrefix')}
        value={sort}
        options={[
          { value: 'name', label: t('media.sort.name') },
          { value: 'size', label: t('media.sort.size') },
          { value: 'date', label: t('media.sort.date') },
        ]}
        onValueChange={(value) => (sort = value)}
      />
      <Segments
        label={t('media.view')}
        value={view}
        options={[
          { value: 'grid', label: t('media.view.grid') },
          { value: 'list', label: t('media.view.list') },
        ]}
        onValueChange={(value) => (view = value)}
      />
    </div>
    {#if !usageKnown && items.length > 0}
      <p class="note">{t('media.usagePartial')}</p>
    {/if}
    <div class="body">
      {#if shown.length === 0}
        <p class="none">{items.length === 0 ? t('media.none') : t('media.noMatch')}</p>
      {:else}
        <div class="media-items" data-view={view} role="listbox" aria-label={t('pane.media')}>
          {#each shown as item, index (item.name)}
            <button
              type="button"
              class="media-item"
              role="option"
              aria-selected={chosenName === item.name}
              tabindex={(chosen ? chosen.name === item.name : index === 0) ? 0 : -1}
              data-name={item.name}
              onclick={() => {
                chosenName = item.name;
                stopRenaming();
              }}
              onkeydown={itemKey}
            >
              <MediaThumb kind={item.kind} src={thumb(item)} size={view === 'grid' ? 'grid' : 'row'} />
              <span class="media-item-name">{item.name}</span>
              <span class="media-item-meta">{meta(item)}</span>
            </button>
          {/each}
        </div>
      {/if}
      {#if chosen}
        <aside class="detail" aria-label={chosen.name}>
          <MediaThumb kind={chosen.kind} src={thumb(chosen)} size="grid" />
          {#if renaming !== null}
            <!-- svelte-ignore a11y_autofocus -->
            <input
              class="bava-field media-rename"
              bind:this={renameField}
              bind:value={renaming}
              autofocus
              aria-label={t('media.renamePlaceholder')}
              aria-invalid={refusal ? 'true' : undefined}
              aria-describedby={refusal ? 'media-rename-refusal' : undefined}
              oninput={() => (refusal = null)}
              onkeydown={(event) => void renameKey(event, chosen)}
            />
            {#if refusal}<p id="media-rename-refusal" class="refusal" role="alert">{refusal}</p>{/if}
          {:else}
            <p class="detail-name">{chosen.name}</p>
          {/if}
          <p class="detail-meta">{formatBytes(chosen.size)} · {formatDay(localDay(chosen.modified))}</p>
          <p class="detail-label">{t('media.usedBy')}</p>
          {#if chosen.usedBy.length === 0}
            <p class="detail-meta">{t('media.usedByNone')}</p>
          {:else}
            <ul class="media-used-by">
              {#each chosen.usedBy as page (page.path)}
                <li>
                  <button type="button" class="bava-button ghost" onclick={() => onOpenPage(page.path)}>
                    <ToolIcon id="page" size="sm" />
                    {page.name}
                  </button>
                </li>
              {/each}
            </ul>
          {/if}
          <div class="detail-actions">
            <button type="button" class="bava-button" bind:this={renameButton} onclick={() => startRename(chosen)}>{t('media.renameShort')}</button>
            <button type="button" class="bava-button" onclick={() => onReveal(chosen.name)}>{t('space.reveal')}</button>
            <button type="button" class="bava-button danger" onclick={() => onDelete(chosen)}>{t('media.delete')}</button>
          </div>
        </aside>
      {/if}
    </div>
  </div>
</Dialog>

<style>
  .media-dialog {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
    border-bottom: var(--border-width) solid var(--color-border-subtle);
  }

  .search {
    flex: 1;
    min-width: var(--size-media-grid-column);
  }

  .body {
    display: flex;
    flex: 1;
    min-height: 0;
  }

  .media-items {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
    padding: var(--space-3) var(--space-4);
    align-content: start;
  }

  .media-items[data-view='grid'] {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(var(--size-media-grid-column), 1fr));
    gap: var(--space-3);
  }

  .media-items[data-view='list'] {
    display: flex;
    flex-direction: column;
    gap: var(--space-half);
  }

  .media-item {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-2);
    border: var(--border-width) solid transparent;
    border-radius: var(--radius-md);
    background: none;
    color: var(--color-text-primary);
    font: inherit;
    font-size: var(--text-body);
    text-align: left;
    cursor: pointer;
  }

  .media-items[data-view='list'] .media-item {
    flex-direction: row;
    align-items: center;
    gap: var(--space-2);
  }

  .media-item:hover {
    background: var(--color-control-hover);
  }

  .media-item:active {
    background: var(--color-control-active);
  }

  .media-item[aria-selected='true'] {
    border-color: var(--color-focus-ring);
    background: var(--color-selection);
  }

  .media-item:focus-visible {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
    outline-offset: calc(var(--focus-halo-width) * -1);
  }

  .media-item-name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .media-items[data-view='list'] .media-item-name {
    flex: 1;
  }

  .media-item-meta,
  .detail-meta {
    margin: 0;
    color: var(--color-text-muted);
    font-size: var(--text-meta);
    font-family: var(--font-data);
    font-variant-numeric: tabular-nums;
  }

  .detail {
    display: flex;
    flex: none;
    flex-direction: column;
    gap: var(--space-2);
    width: var(--size-media-detail);
    padding: var(--space-3) var(--space-4);
    overflow-y: auto;
    border-inline-start: var(--border-width) solid var(--color-border-subtle);
  }

  .detail-name {
    margin: 0;
    font-weight: var(--weight-semibold);
    overflow-wrap: anywhere;
  }

  /* Over the shared field's focus colour, so a refused name stays red while the keyboard is in it. */
  .media-rename[aria-invalid='true'] {
    border-color: var(--color-danger);
  }

  .refusal {
    margin: 0;
    font-size: var(--text-meta);
    color: var(--color-danger);
  }

  .detail-label {
    margin: var(--space-2) 0 0;
    color: var(--color-text-muted);
    font-size: var(--text-label);
    font-weight: var(--weight-semibold);
    font-family: var(--font-label);
    letter-spacing: var(--tracking-label);
    text-transform: uppercase;
  }

  .media-used-by {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .detail-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }

  .note {
    margin: 0;
    padding: var(--space-2) var(--space-4);
    border-bottom: var(--border-width) solid var(--color-border-subtle);
    color: var(--color-text-muted);
    font-size: var(--text-meta);
  }

  .none {
    flex: 1;
    margin: 0;
    padding: var(--space-6);
    color: var(--color-text-muted);
    text-align: center;
  }
</style>
