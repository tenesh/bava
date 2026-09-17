<script lang="ts">
  /**
   * The insert panel: a search, then categories as rows or a category's items
   * as a grid of tiles. Keyboard first: the search keeps focus and the arrow
   * keys move the highlight, which the listbox announces.
   *
   * Presentational over the insert state it is handed; it reports outcomes
   * (choose a tool, close) and does nothing to the canvas itself.
   */
  import { onMount } from 'svelte';
  import { GRID_COLUMNS, type InsertOutcome, type InsertState } from '../shell/insert.svelte';
  import ToolIcon from './ToolIcon.svelte';
  import { t } from '../i18n/t';

  type Props = {
    insert: InsertState;
    onOutcome: (outcome: InsertOutcome) => void;
  };

  let { insert, onOutcome }: Props = $props();

  let search: HTMLInputElement;
  let panel: HTMLDivElement;
  const listId = 'bava-insert-list';
  const optionId = (index: number) => `bava-insert-option-${index}`;

  onMount(() => {
    search.focus();
    // A press anywhere else closes the panel, except on the control that
    // toggles it, which closes it itself.
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (panel.contains(target) || target?.closest('[data-insert-trigger]')) return;
      onOutcome({ type: 'close' });
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  });

  function onKeydown(event: KeyboardEvent) {
    const handled = ['ArrowDown', 'ArrowUp', 'Enter', 'Escape'].includes(event.key) ||
      (insert.grid && insert.query === '' && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) ||
      (event.key === 'Backspace' && insert.query === '' && insert.category !== null);
    if (!handled) return;
    event.preventDefault();
    // Keys typed here never reach the canvas.
    event.stopPropagation();
    report(insert.press(event.key));
  }

  function report(outcome: InsertOutcome) {
    if (outcome.type !== 'none') onOutcome(outcome);
  }

  function pick(index: number) {
    insert.highlight(index);
    report(insert.choose(index));
    search.focus();
  }

  const highlightedName = $derived(insert.highlightedEntry ? t(insert.highlightedEntry.labelKey) : '');
</script>

<!-- Keys are handled here, so focus anywhere inside the panel still navigates. -->
<div class="panel" role="dialog" tabindex="-1" aria-label={t('insert.search')} bind:this={panel} onkeydown={onKeydown}>
  <div class="search">
    <ToolIcon id="search" size="sm" />
    <input
      bind:this={search}
      type="text"
      placeholder={t('insert.search')}
      value={insert.query}
      oninput={(event) => insert.setQuery(event.currentTarget.value)}
      role="combobox"
      aria-expanded="true"
      aria-controls={listId}
      aria-activedescendant={insert.entries.length > 0 ? optionId(insert.highlighted) : undefined}
      autocomplete="off"
      spellcheck="false"
    />
  </div>

  <nav class="crumbs">
    {#if insert.category}
      <button
        type="button"
        class="crumb"
        onclick={() => {
          insert.press('Backspace');
          search.focus();
        }}>{t('insert.all')}</button
      >
      <span class="separator" aria-hidden="true">/</span>
      <span class="current">{t(insert.category.labelKey)}</span>
    {:else}
      <span class="current">{t('insert.all')}</span>
    {/if}
  </nav>

  <div
    id={listId}
    class="entries"
    class:grid={insert.grid}
    style:--columns={GRID_COLUMNS}
    role="listbox"
    aria-label={t('insert.search')}
  >
    {#each insert.entries as entry, index (entry.id)}
      {#if entry.kind === 'category'}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div
          id={optionId(index)}
          class="row"
          role="option"
          aria-selected={index === insert.highlighted}
          tabindex="-1"
          onpointermove={() => insert.highlight(index)}
          onclick={() => pick(index)}
        >
          <span class="row-icon"><ToolIcon id={entry.icon} /></span>
          <span class="text">
            <span class="name">{t(entry.labelKey)}</span>
            <span class="description">{t(entry.descriptionKey)}</span>
          </span>
          <span class="chevron"><ToolIcon id="chevron" size="sm" /></span>
        </div>
      {:else}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div
          id={optionId(index)}
          class="tile"
          role="option"
          aria-selected={index === insert.highlighted}
          tabindex="-1"
          onpointermove={() => insert.highlight(index)}
          onclick={() => pick(index)}
        >
          <span class="tile-icon"><ToolIcon id={entry.icon} /></span>
          <span class="tile-label">{t(entry.labelKey)}</span>
        </div>
      {/if}
    {:else}
      <p class="empty">{t('insert.empty')}</p>
    {/each}
  </div>

  <footer>
    <span class="highlighted">{highlightedName}</span>
    <span class="hint">{t('insert.hint')}</span>
  </footer>
</div>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    width: var(--size-insert-panel);
    background: var(--color-surface-overlay);
    border: var(--border-width) solid var(--color-border-subtle);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-floating);
    color: var(--color-text-primary);
  }

  .search {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3);
    color: var(--color-text-muted);
  }

  .search input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: transparent;
    font: inherit;
    font-size: var(--text-body);
    color: var(--color-text-primary);
    outline: none;
  }

  .crumbs {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: 0 var(--space-3) var(--space-2);
    font-size: var(--text-meta);
    color: var(--color-text-muted);
  }

  .crumb {
    padding: 0;
    border: 0;
    background: transparent;
    font: inherit;
    color: var(--color-text-muted);
  }

  .crumb:focus-visible {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
  }

  .current {
    color: var(--color-text-primary);
    font-weight: var(--weight-medium);
  }

  .entries {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: 0 var(--space-3) var(--space-3);
  }

  .entries.grid {
    display: grid;
    grid-template-columns: repeat(var(--columns), 1fr);
    gap: var(--space-2);
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    border: var(--border-width) solid var(--color-border-subtle);
    border-radius: var(--radius-md);
    cursor: default;
  }

  .row[aria-selected='true'],
  .tile[aria-selected='true'] .tile-icon {
    background: var(--color-accent-subtle);
    border-color: var(--color-accent);
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
    outline-offset: calc(var(--focus-halo-width) * -1);
  }

  .row-icon {
    display: flex;
    color: var(--color-text-secondary);
  }

  .text {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .name {
    font-size: var(--text-control);
    font-weight: var(--weight-medium);
  }

  .description {
    font-size: var(--text-meta);
    color: var(--color-text-muted);
  }

  /* Clear of the text: the row's last column, with its own margin. */
  .chevron {
    display: flex;
    margin-inline-start: var(--space-3);
    color: var(--color-text-muted);
  }

  .tile {
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
    cursor: default;
  }

  .tile-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--size-insert-tile);
    height: var(--size-insert-tile);
    border: var(--border-width) solid var(--color-border-subtle);
    border-radius: var(--radius-md);
    color: var(--color-text-secondary);
  }

  .tile-label {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--text-meta);
    color: var(--color-text-muted);
  }

  .empty {
    margin: 0;
    padding: var(--space-3) 0;
    font-size: var(--text-meta);
    color: var(--color-text-muted);
  }

  footer {
    display: flex;
    justify-content: space-between;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    border-top: var(--border-width) solid var(--color-border-subtle);
    font-size: var(--text-meta);
    color: var(--color-text-muted);
  }
</style>
