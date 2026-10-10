<script lang="ts">
  /**
   * The search palette: a field at the top centre of the window over a
   * backdrop, and what the search found, one row per page or folder with its
   * best match beneath, the typed words marked. ↑ ↓ move, Enter opens,
   * Escape or a press outside closes.
   *
   * Presentational: it shows the search it is given and reports what was
   * typed, moved, chosen or closed.
   */
  import Portal from './Portal.svelte';
  import ToolIcon from './ToolIcon.svelte';
  import Keycaps from './Keycaps.svelte';
  import { markWords } from './search-marks';
  import { pressAway } from './press-away';
  import { t } from '../i18n/t';
  import type { SearchHit } from '../files/space.svelte';

  type Props = {
    query: string;
    hits: SearchHit[];
    more: boolean;
    failed: boolean;
    highlighted: number;
    onQuery: (query: string) => void;
    onMove: (by: number) => void;
    onChoose: (hit: SearchHit) => void;
    onClose: () => void;
  };

  let { query, hits, more, failed, highlighted, onQuery, onMove, onChoose, onClose }: Props = $props();

  let field: HTMLInputElement | undefined = $state();
  let panel: HTMLDivElement | undefined = $state();
  let list: HTMLDivElement | undefined = $state();

  const typed = $derived(query.trim() !== '');

  $effect(() => {
    field?.focus();
  });

  $effect(() => pressAway(() => panel, onClose));

  // The highlighted row stays in view as the arrows move it.
  $effect(() => {
    list?.querySelector(`#search-row-${highlighted}`)?.scrollIntoView?.({ block: 'nearest' });
  });

  function keydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    } else if (event.key === 'Tab') {
      // The field is the palette's one stop: Tab stays, as in a modal.
      event.preventDefault();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      onMove(event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const hit = hits[highlighted];
      if (hit) onChoose(hit);
    }
  }

  function beneath(hit: SearchHit): string {
    if (hit.best.where === 'canvas') return t('search.onCanvas').replace('{text}', hit.best.text);
    if (hit.best.where === 'document') return hit.best.text;
    return hit.folder;
  }

  const countLabel = (n: number) => (n === 1 ? t('search.countOne') : t('search.count').replace('{n}', String(n)));
</script>

<Portal>
  <div class="search-backdrop"></div>
  <div bind:this={panel} class="search-palette" role="dialog" aria-modal="true" aria-label={t('search.label')} tabindex="-1">
    <div class="field">
      <ToolIcon id="search" size="sm" />
      <input
        bind:this={field}
        value={query}
        oninput={(event) => onQuery((event.currentTarget as HTMLInputElement).value)}
        onkeydown={keydown}
        type="search"
        placeholder={t('search.label')}
        aria-label={t('search.label')}
        aria-controls="search-results"
        aria-activedescendant={hits.length > 0 ? `search-row-${highlighted}` : undefined}
        spellcheck="false"
        autocomplete="off"
      />
      <span class="esc"><Keycaps keys={t('search.closeKey')} /></span>
    </div>
    {#if typed}
      <div bind:this={list} class="results" id="search-results" role="listbox" aria-label={t('search.results')}>
        {#if !failed}
          {#each hits as hit, index (hit.path)}
            <div
              id={`search-row-${index}`}
              class="row"
              role="option"
              tabindex="-1"
              aria-selected={index === highlighted}
              data-highlighted={index === highlighted ? '' : undefined}
              onpointermove={() => {
                if (index !== highlighted) onMove(index - highlighted);
              }}
              onclick={() => onChoose(hit)}
              onkeydown={() => {}}
            >
              <span class="line">
                <span class="icon" role="img" aria-label={hit.kind === 'folder' ? t('search.folder') : t('search.page')}>
                  <ToolIcon id={hit.kind === 'folder' ? 'folder' : 'page'} size="sm" />
                </span>
                <span class="name">{hit.name}</span>
                {#if hit.folder && hit.best.where !== 'name'}<span class="folder">{hit.folder}</span>{/if}
                <span class="count" title={countLabel(hit.count)}>{hit.count}</span>
              </span>
              {#if beneath(hit)}
                <span class="snippet">
                  {#each markWords(beneath(hit), hit.best.where === 'name' ? '' : query) as piece, at (at)}
                    {#if piece.marked}<mark>{piece.text}</mark>{:else}{piece.text}{/if}
                  {/each}
                </span>
              {/if}
            </div>
          {/each}
        {/if}
      </div>
      <p class="note" class:more={more && !failed && hits.length > 0} role="status">
        {#if failed}{t('search.failed')}{:else if hits.length === 0}{t('search.none')}{:else if more}{t('search.more')}{/if}
      </p>
    {:else}
      <p class="hint">{t('search.placeholder')}</p>
    {/if}
  </div>
</Portal>

<style>
  .search-backdrop {
    position: fixed;
    inset: 0;
    z-index: var(--z-overlay);
    background: var(--color-backdrop);
  }

  .search-palette {
    position: fixed;
    top: var(--size-search-palette-top);
    left: 50%;
    z-index: var(--z-portal);
    display: flex;
    flex-direction: column;
    width: var(--size-search-palette);
    transform: translateX(-50%);
    overflow: hidden;
    border: var(--border-width) solid var(--color-border-strong);
    border-radius: var(--radius-xl);
    background: var(--color-surface-overlay);
    box-shadow: var(--shadow-overlay);
    outline: none;
  }

  .field {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3);
    border-bottom: var(--border-width) solid var(--color-border-subtle);
    color: var(--color-text-muted);
  }

  /* The field holds the keys while the palette is open: a focus rule under it. */
  .field:focus-within {
    box-shadow: inset 0 calc(var(--focus-ring-width) * -1) 0 var(--color-focus-ring);
  }

  input {
    flex: 1;
    min-width: 0;
    padding: 0;
    border: 0;
    background: none;
    color: var(--color-text-primary);
    font: inherit;
    font-size: var(--text-title);
    outline: none;
  }

  input::placeholder {
    color: var(--color-placeholder);
  }

  input::-webkit-search-cancel-button {
    display: none;
  }

  .esc {
    display: flex;
  }

  .results {
    max-height: var(--size-search-results);
    overflow-y: auto;
    padding: var(--space-1);
  }

  .row {
    display: flex;
    flex-direction: column;
    gap: var(--space-half);
    padding: var(--space-2);
    border-radius: var(--radius-md);
    color: var(--color-text-secondary);
    cursor: default;
  }

  .row[data-highlighted] {
    background: var(--color-selection);
    color: var(--color-text-primary);
  }

  .line {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }

  .icon {
    display: flex;
    color: var(--color-text-faint);
  }

  .row[data-highlighted] .icon {
    color: var(--color-text-primary);
  }

  .name {
    flex: none;
    max-width: 60%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-text-primary);
    font-weight: var(--weight-medium);
  }

  .folder {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--font-data);
    font-size: var(--text-mono-status);
    color: var(--color-text-muted);
  }

  .count {
    margin-inline-start: auto;
    padding-inline-start: var(--space-2);
    font-family: var(--font-data);
    font-size: var(--text-mono-status);
    font-variant-numeric: tabular-nums;
    color: var(--color-text-faint);
  }

  .snippet {
    padding-inline-start: calc(var(--space-3) + var(--space-2));
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--text-meta);
    color: var(--color-text-muted);
  }

  .row[data-highlighted] .snippet {
    color: var(--color-text-secondary);
  }

  mark {
    padding: 0 var(--border-width);
    border-radius: var(--radius-sm);
    background: var(--color-find-match);
    color: inherit;
    font-weight: var(--weight-medium);
  }

  .hint,
  .note {
    margin: 0;
    padding: var(--space-3);
    font-size: var(--text-meta);
    color: var(--color-text-muted);
  }

  .note:empty {
    display: none;
  }

  .more {
    padding-block: var(--space-2);
    font-family: var(--font-data);
  }
</style>
