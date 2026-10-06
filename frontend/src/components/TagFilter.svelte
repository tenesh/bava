<script lang="ts">
  /**
   * The Space's tags from the Files header: a search, then each tag with its
   * page count, the chosen ones ticked. Choosing one narrows the tree; each
   * tag's own button opens its menu; Manage tags opens the Tags dialog.
   * Escape, or a press outside it, closes it.
   *
   * Presentational: it reports what was chosen.
   */
  import Portal from './Portal.svelte';
  import ToolIcon from './ToolIcon.svelte';
  import { pressAway } from './press-away';
  import { t } from '../i18n/t';

  type Props = {
    /** Where it opens from; it sits below that. */
    at: { left: number; top: number; bottom: number };
    tags: { tag: string; count: number }[];
    chosen: string[];
    onToggle: (tag: string) => void;
    /** A tag's menu, at the point it opens from. */
    onMenu: (tag: string, anchor: { x: number; y: number }) => void;
    onManage: () => void;
    onClose: () => void;
  };

  let { at, tags, chosen, onToggle, onMenu, onManage, onClose }: Props = $props();

  let query = $state('');
  let highlighted = $state(0);
  let search: HTMLInputElement | undefined = $state();
  let panel: HTMLDivElement | undefined = $state();

  const shown = $derived(tags.filter((each) => each.tag.includes(query.trim().toLowerCase())));

  $effect(() => {
    search?.focus();
  });

  $effect(() => {
    void query;
    highlighted = 0;
  });

  $effect(() => pressAway(() => [panel, ...document.querySelectorAll('.bava-menu')], onClose));

  function keydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (shown.length > 0) highlighted = (highlighted + (event.key === 'ArrowDown' ? 1 : shown.length - 1)) % shown.length;
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const row = shown[highlighted];
      if (row) onToggle(row.tag);
    }
  }

  function more(event: MouseEvent, tag: string) {
    event.stopPropagation();
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    onMenu(tag, { x: box.right, y: box.top });
  }
</script>

<Portal>
  <div
    bind:this={panel}
    class="tag-filter"
    role="dialog"
    aria-label={t('tags.filter')}
    tabindex="-1"
    style:left={`${at.left}px`}
    style:top={`calc(${at.bottom}px + var(--space-1))`}
    onkeydown={keydown}
  >
    <input
      bind:this={search}
      bind:value={query}
      class="bava-field search"
      type="search"
      placeholder={t('tags.search')}
      aria-label={t('tags.search')}
      aria-controls="tag-filter-list"
      aria-activedescendant={shown.length > 0 ? `tag-filter-row-${highlighted}` : undefined}
    />
    <div class="scroll" id="tag-filter-list" role="listbox" aria-multiselectable="true" aria-label={t('tags.label')}>
      {#if tags.length === 0}
        <p class="none">{t('tags.empty')}</p>
      {:else if shown.length === 0}
        <p class="none">{t('tags.none')}</p>
      {:else}
        {#each shown as row, index (row.tag)}
          <div
            id={`tag-filter-row-${index}`}
            class="row"
            role="option"
            tabindex="-1"
            aria-selected={chosen.includes(row.tag)}
            data-highlighted={index === highlighted ? '' : undefined}
            onpointermove={() => (highlighted = index)}
            onclick={() => onToggle(row.tag)}
            onkeydown={() => {}}
          >
            <span class="box" class:on={chosen.includes(row.tag)} aria-hidden="true">{#if chosen.includes(row.tag)}<ToolIcon id="finishLine" size="sm" />{/if}</span>
            <span class="name">{row.tag}</span>
            <span class="count">{row.count}</span>
            <button type="button" class="more" aria-label={t('tags.more').replace('{tag}', row.tag)} title={t('tags.more').replace('{tag}', row.tag)} onclick={(event) => more(event, row.tag)}>
              <ToolIcon id="more" size="sm" />
            </button>
          </div>
        {/each}
      {/if}
    </div>
    <div class="separator"></div>
    <button type="button" class="manage" onclick={onManage}>{t('tags.manage')}</button>
  </div>
</Portal>

<style>
  .tag-filter {
    position: fixed;
    z-index: var(--z-portal);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    width: var(--size-tag-filter);
    max-height: var(--size-tag-filter-height);
    padding: var(--space-2);
    background: var(--color-surface-overlay);
    border: var(--border-width) solid var(--color-border-subtle);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-floating);
    outline: none;
  }

  .search {
    width: 100%;
  }

  .scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    height: var(--size-row);
    padding: 0 var(--space-1);
    border-radius: var(--radius-sm);
    color: var(--color-text-primary);
    cursor: pointer;
  }

  .row:hover {
    background: var(--color-control-hover);
  }

  .row[data-highlighted] {
    background: var(--color-selection);
  }

  .row:active {
    background: var(--color-control-active);
  }

  .box {
    display: inline-grid;
    place-items: center;
    flex: none;
    width: var(--size-check);
    height: var(--size-check);
    border: var(--border-width) solid var(--color-border-strong);
    border-radius: var(--radius-sm);
  }

  .box.on {
    border-color: var(--color-accent);
    background: var(--color-accent);
    color: var(--color-accent-contrast);
  }

  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .count {
    color: var(--color-text-muted);
    font-size: var(--text-meta);
    font-variant-numeric: tabular-nums;
  }

  .more,
  .manage {
    border: 0;
    background: none;
    font: inherit;
    cursor: pointer;
  }

  .more {
    display: inline-flex;
    padding: 0;
    border-radius: var(--radius-sm);
    color: var(--color-text-muted);
    opacity: 0;
  }

  .row:hover .more,
  .row[data-highlighted] .more,
  .more:focus-visible {
    opacity: 1;
  }

  .more:hover {
    color: var(--color-text-primary);
    background: var(--color-control-hover);
  }

  .more:active,
  .manage:active {
    background: var(--color-control-active);
  }

  .separator {
    height: var(--border-width);
    background: var(--color-border-subtle);
  }

  .manage {
    height: var(--size-row);
    padding: 0 var(--space-1);
    border-radius: var(--radius-sm);
    color: var(--color-text-primary);
    text-align: left;
  }

  .manage:hover {
    background: var(--color-control-hover);
  }

  .more:focus-visible,
  .manage:focus-visible {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
    outline-offset: calc(var(--focus-halo-width) * -1);
  }

  .none {
    margin: var(--space-2) var(--space-1);
    color: var(--color-text-muted);
  }
</style>
