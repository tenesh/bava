<script lang="ts">
  /**
   * The Space's tags, managed: each with its page count, searchable, sorted
   * by name or by pages. A tag is renamed in its row (a name another tag has
   * is refused there); its ⋯ menu renames, merges or deletes it; boxes select
   * several, and a bar then merges them into one tag or deletes them.
   *
   * Presentational: it reports what to do; the caller asks first and changes
   * the pages.
   */
  import { tick } from 'svelte';
  import Dialog from './Dialog.svelte';
  import ContextMenu from './ContextMenu.svelte';
  import Segments from './Segments.svelte';
  import ToolIcon from './ToolIcon.svelte';
  import TagChip from './TagChip.svelte';
  import { t } from '../i18n/t';
  import type { MenuNode } from '../canvas/context-menu';

  type Props = {
    open: boolean;
    tags: { tag: string; count: number }[];
    /** The pages that have any tag, for the summary. */
    pages: number;
    /** A tag to start renaming as the dialog opens. */
    renaming: string | null;
    onRename: (tag: string, next: string) => void;
    onMerge: (tags: string[], into: string) => void;
    onDelete: (tags: string[]) => void;
    onOpenChange: (open: boolean) => void;
  };

  let { open, tags, pages, renaming, onRename, onMerge, onDelete, onOpenChange }: Props = $props();

  let query = $state('');
  let sort = $state<'name' | 'pages'>('name');
  let selected = $state<string[]>([]);
  // Opened to rename one tag, its field is there from the first frame, so
  // the dialog's first focus lands in it.
  // svelte-ignore state_referenced_locally
  let editing = $state<{ tag: string; value: string; refusal: string | null } | null>(renaming ? { tag: renaming, value: renaming, refusal: null } : null);
  let menu = $state.raw<{ anchor: { x: number; y: number } } | null>(null);
  // What the open menu offers and the tags it acts on; kept past its close,
  // which can come before the choice made in it.
  let menuItems = $state.raw<MenuNode[]>([]);
  let menuTags: string[] = [];

  const shown = $derived.by(() => {
    const q = query.trim().toLowerCase();
    const rows = tags.filter((row) => row.tag.includes(q));
    return [...rows].sort((a, b) => (sort === 'pages' ? b.count - a.count : 0) || a.tag.localeCompare(b.tag));
  });

  // A tag gone from the Space is no longer selected.
  $effect(() => {
    const present = tags.map((row) => row.tag);
    if (selected.some((tag) => !present.includes(tag))) selected = selected.filter((tag) => present.includes(tag));
  });

  const asTag = (text: string) => text.toLowerCase().replace(/\s+/g, '-');

  async function startRename(tag: string) {
    editing = { tag, value: tag, refusal: null };
    await tick();
    const field = document.querySelector<HTMLInputElement>('.tags-table input.rename');
    field?.focus();
    field?.select();
  }

  function commitRename() {
    if (!editing) return;
    const next = editing.value.replace(/^-+|-+$/g, '');
    if (next === '' || next === editing.tag) {
      editing = null;
      return;
    }
    if (tags.some((row) => row.tag === next)) {
      editing = { ...editing, refusal: t('tags.taken').replace('{tag}', next) };
      return;
    }
    onRename(editing.tag, next);
    editing = null;
  }

  function renameKeys(event: KeyboardEvent) {
    if (event.key === 'Enter') {
      event.preventDefault();
      commitRename();
    }
  }

  /**
   * Escape while renaming leaves the rename, not the dialog. Ark listens for
   * Escape on the document, in the capture phase, before the field hears it,
   * so the window's capture phase, which runs first, takes it.
   */
  function escapeRename(event: KeyboardEvent) {
    if (event.key !== 'Escape' || event.isComposing || !open || editing === null) return;
    event.preventDefault();
    event.stopPropagation();
    editing = null;
  }

  function toggle(tag: string) {
    selected = selected.includes(tag) ? selected.filter((each) => each !== tag) : [...selected, tag];
  }

  const allShown = $derived(shown.length > 0 && shown.every((row) => selected.includes(row.tag)));

  function toggleAll() {
    const names = shown.map((row) => row.tag);
    selected = allShown ? selected.filter((tag) => !names.includes(tag)) : [...new Set([...selected, ...names])];
  }

  /** The tags the given ones can be merged into: every other tag. */
  const mergeItems = (from: string[]): MenuNode[] =>
    tags.filter((row) => !from.includes(row.tag)).map((row) => ({ kind: 'item', id: `merge:${row.tag}`, label: row.tag, keys: '' }));

  function openMenu(event: MouseEvent, items: MenuNode[], forTags: string[]) {
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const anchor = { x: box.left, y: box.bottom };
    menuTags = forTags;
    menuItems = items;
    setTimeout(() => (menu = { anchor }));
  }

  function rowMenu(event: MouseEvent, tag: string) {
    const merge = mergeItems([tag]);
    openMenu(
      event,
      [
        { kind: 'item', id: 'rename', label: t('tags.renameItem'), keys: '' },
        ...(merge.length > 0 ? [{ kind: 'submenu', id: 'merge', label: t('tags.mergeMenu'), items: merge } satisfies MenuNode] : []),
        { kind: 'separator' },
        { kind: 'item', id: 'delete', label: t('tags.deleteItem'), keys: '' },
      ],
      [tag],
    );
  }

  function chosen(id: string) {
    const forTags = menuTags;
    menu = null;
    if (id === 'rename' && forTags[0]) void startRename(forTags[0]);
    else if (id === 'delete') onDelete(forTags);
    else if (id.startsWith('merge:')) onMerge(forTags, id.slice('merge:'.length));
  }

  const deleteLabel = $derived(selected.length === 1 ? t('tags.deleteOne') : t('tags.deleteSome').replace('{count}', String(selected.length)));
</script>

<svelte:window onkeydowncapture={escapeRename} />

<Dialog
  {open}
  title={t('tags.dialog')}
  subtitle={t('tags.summary')
    .replace('{tags}', tags.length === 1 ? t('tags.tagCount.one') : t('tags.tagCount').replace('{count}', String(tags.length)))
    .replace('{pages}', pages === 1 ? t('tags.pageCount.one') : t('tags.pageCount').replace('{count}', String(pages)))}
  size="trash"
  flush
  closable
  {onOpenChange}
>
  <div class="tags-body">
    <div class="tools">
      <input class="bava-field search" type="search" placeholder={t('tags.search')} aria-label={t('tags.search')} bind:value={query} />
      <Segments
        value={sort}
        label={t('tags.sort')}
        options={[
          { value: 'name', label: t('tags.byName') },
          { value: 'pages', label: t('tags.byPages') },
        ]}
        onValueChange={(next) => (sort = next)}
      />
    </div>
    <div class="scroll">
      {#if tags.length === 0}
        <p class="none">{t('tags.empty')}</p>
      {:else if shown.length === 0}
        <p class="none">{t('tags.none')}</p>
      {:else}
        <table class="tags-table">
          <thead>
            <tr>
              <th class="pick"><input type="checkbox" aria-label={t('tags.selectAll')} checked={allShown} onchange={toggleAll} /></th>
              <th>{t('tags.tag')}</th>
              <th class="num">{t('tags.pages')}</th>
              <th class="act"></th>
            </tr>
          </thead>
          <tbody>
            {#each shown as row (row.tag)}
              <tr data-selected={selected.includes(row.tag) ? '' : undefined}>
                <td class="pick"><input type="checkbox" aria-label={t('tags.select').replace('{tag}', row.tag)} checked={selected.includes(row.tag)} onchange={() => toggle(row.tag)} /></td>
                <td>
                  {#if editing?.tag === row.tag}
                    <!-- Opened to rename a tag, the dialog's first focus goes here. -->
                    <input
                      data-autofocus
                      class="bava-field rename"
                      aria-label={t('tags.renameField').replace('{tag}', row.tag)}
                      aria-invalid={editing.refusal ? 'true' : undefined}
                      spellcheck="false"
                      value={editing.value}
                      oninput={(event) => {
                        const target = event.currentTarget;
                        target.value = asTag(target.value);
                        editing = { tag: row.tag, value: target.value, refusal: null };
                      }}
                      onkeydown={renameKeys}
                      onblur={() => {
                        if (editing && !editing.refusal) commitRename();
                      }}
                    />
                    {#if editing.refusal}<p class="refusal" role="alert">{editing.refusal}</p>{/if}
                  {:else}
                    <TagChip tag={row.tag} ondblclick={() => void startRename(row.tag)} />
                  {/if}
                </td>
                <td class="num">{row.count}</td>
                <td class="act">
                  <button type="button" class="bava-icon-button" aria-label={t('tags.rename').replace('{tag}', row.tag)} title={t('tags.rename').replace('{tag}', row.tag)} onclick={() => void startRename(row.tag)}>
                    <ToolIcon id="pen" size="sm" />
                  </button>
                  <button type="button" class="bava-icon-button" aria-label={t('tags.more').replace('{tag}', row.tag)} title={t('tags.more').replace('{tag}', row.tag)} aria-haspopup="menu" onclick={(event) => rowMenu(event, row.tag)}>
                    <ToolIcon id="more" size="sm" />
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>
    {#if selected.length > 0}
      <div class="bulk">
        <span class="count">{t('tags.selected').replace('{count}', String(selected.length))}</span>
        <button
          type="button"
          class="bava-button"
          aria-haspopup="menu"
          disabled={mergeItems(selected).length === 0}
          onclick={(event) => openMenu(event, mergeItems(selected), [...selected])}>{t('tags.mergeInto')}</button
        >
        <button type="button" class="bava-button danger" onclick={() => onDelete([...selected])}>{deleteLabel}</button>
      </div>
    {/if}
  </div>
</Dialog>

<ContextMenu
  items={menuItems}
  open={menu !== null}
  anchor={menu?.anchor ?? null}
  onSelect={chosen}
  onOpenChange={(next) => {
    if (!next) menu = null;
  }}
/>

<style>
  .tags-body {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .tools {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-4);
  }

  .search {
    flex: 1;
    max-width: var(--size-tag-filter);
  }

  .scroll {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: 0 var(--space-2);
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th {
    padding: var(--space-1) var(--space-2);
    border-bottom: var(--border-width) solid var(--color-border-subtle);
    color: var(--color-text-muted);
    font-size: var(--text-label);
    font-weight: var(--weight-semibold);
    letter-spacing: var(--tracking-label);
    text-align: left;
    text-transform: uppercase;
  }

  td {
    padding: var(--space-1) var(--space-2);
    border-bottom: var(--border-width) solid var(--color-border-hairline);
    vertical-align: middle;
  }

  tr[data-selected] td {
    background: var(--color-accent-subtle);
  }

  .pick {
    width: var(--size-row-lg);
  }

  .pick input {
    width: var(--size-check);
    height: var(--size-check);
    margin: 0;
    accent-color: var(--color-accent);
    cursor: pointer;
  }

  .pick input:focus-visible {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
    outline-offset: var(--focus-halo-width);
  }

  .num {
    width: var(--size-tag-count);
    text-align: right;
    color: var(--color-text-secondary);
    font-variant-numeric: tabular-nums;
  }

  .act {
    width: calc(var(--size-row-lg) * 2 + var(--space-1));
    text-align: right;
    white-space: nowrap;
  }


  .rename {
    width: var(--size-tag-field);
  }

  .refusal {
    margin: var(--space-1) 0 0;
    color: var(--color-danger);
    font-size: var(--text-meta);
  }

  .bulk {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-4);
    border-top: var(--border-width) solid var(--color-border-subtle);
    background: var(--color-surface-nav);
  }

  .bulk .count {
    flex: 1;
    font-weight: var(--weight-semibold);
  }

  .none {
    margin: var(--space-3) var(--space-2);
    color: var(--color-text-muted);
  }
</style>
