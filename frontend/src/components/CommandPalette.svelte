<script lang="ts">
  /**
   * The command palette: a field at the top centre of the window over a
   * backdrop, and the commands to run, grouped, each with its menu path where
   * the group does not say it and its keys, the typed words marked. ↑ ↓ move,
   * Enter runs, Escape or a press outside closes.
   *
   * Presentational: it shows the groups it is given and reports what was
   * typed, moved, run or closed.
   */
  import Portal from './Portal.svelte';
  import ToolIcon from './ToolIcon.svelte';
  import Keycaps from './Keycaps.svelte';
  import { markWords } from './search-marks';
  import { pressAway } from './press-away';
  import { t } from '../i18n/t';
  import type { PaletteGroup } from '../shell/palette';

  type Props = {
    query: string;
    groups: PaletteGroup[];
    /** The highlighted row, counted across every group. */
    highlighted: number;
    onQuery: (query: string) => void;
    onMove: (by: number) => void;
    onRun: (id: string) => void;
    onClose: () => void;
  };

  let { query, groups, highlighted, onQuery, onMove, onRun, onClose }: Props = $props();

  let field: HTMLInputElement | undefined = $state();
  let panel: HTMLDivElement | undefined = $state();
  let list: HTMLDivElement | undefined = $state();

  /** Every row, in the order shown, each with its place across the groups. */
  const rows = $derived(groups.flatMap((group) => group.commands));
  /** Where each group's first row sits across them all. */
  const starts = $derived(groups.map((_, index) => groups.slice(0, index).reduce((sum, group) => sum + group.commands.length, 0)));

  $effect(() => {
    field?.focus();
  });

  $effect(() => pressAway(() => panel, onClose));

  // The highlighted row stays in view as the arrows move it.
  $effect(() => {
    list?.querySelector(`#command-row-${highlighted}`)?.scrollIntoView?.({ block: 'nearest' });
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
      const command = rows[highlighted];
      if (command) onRun(command.id);
    }
  }
</script>

<Portal>
  <div class="command-backdrop"></div>
  <div bind:this={panel} class="command-palette" role="dialog" aria-modal="true" aria-label={t('palette.label')} tabindex="-1">
    <div class="field">
      <ToolIcon id="command" size="sm" />
      <input
        bind:this={field}
        value={query}
        oninput={(event) => onQuery((event.currentTarget as HTMLInputElement).value)}
        onkeydown={keydown}
        type="search"
        placeholder={t('palette.placeholder')}
        aria-label={t('palette.label')}
        aria-controls="command-rows"
        aria-activedescendant={rows.length > 0 ? `command-row-${highlighted}` : undefined}
        spellcheck="false"
        autocomplete="off"
      />
      <span class="esc"><Keycaps keys={t('search.closeKey')} /></span>
    </div>
    {#if rows.length > 0}
      <div bind:this={list} class="rows" id="command-rows" role="listbox" aria-label={t('palette.commands')}>
        {#each groups as group, g (group.title)}
          <div role="group" aria-label={group.title || t('palette.commands')}>
            {#if group.title}<div class="group-title" aria-hidden="true">{group.title}</div>{/if}
            {#each group.commands as command, c (command.id)}
              {@const index = starts[g] + c}
              <div
                id={`command-row-${index}`}
                class="row"
                role="option"
                tabindex="-1"
                aria-selected={index === highlighted}
                data-highlighted={index === highlighted ? '' : undefined}
                onpointermove={() => {
                  if (index !== highlighted) onMove(index - highlighted);
                }}
                onclick={() => onRun(command.id)}
                onkeydown={() => {}}
              >
                <span class="label"
                  >{#each markWords(command.label, query) as piece, at (at)}{#if piece.marked}<mark>{piece.text}</mark>{:else}{piece.text}{/if}{/each}</span
                >
                {#if command.path !== group.title}<span class="path">{command.path}</span>{/if}
                {#if command.keys}<span class="keys"><Keycaps keys={command.keys} /></span>{/if}
              </div>
            {/each}
          </div>
        {/each}
      </div>
    {:else}
      <p class="note" role="status">{t('palette.none')}</p>
    {/if}
  </div>
</Portal>

<style>
  .command-backdrop {
    position: fixed;
    inset: 0;
    z-index: var(--z-overlay);
    background: var(--color-backdrop);
  }

  .command-palette {
    position: fixed;
    top: var(--size-search-palette-top);
    left: 50%;
    z-index: var(--z-portal);
    display: flex;
    flex-direction: column;
    width: var(--size-command-palette);
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

  .rows {
    max-height: var(--size-search-results);
    overflow-y: auto;
    padding: var(--space-1);
  }

  .group-title {
    padding: var(--space-2) var(--space-2) var(--space-1);
    font-family: var(--font-label);
    font-size: var(--text-label);
    letter-spacing: var(--tracking-label);
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2);
    border-radius: var(--radius-md);
    color: var(--color-text-secondary);
    cursor: default;
  }

  .row[data-highlighted] {
    background: var(--color-selection);
    color: var(--color-text-primary);
  }

  .label {
    flex: none;
    max-width: 60%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--text-body);
  }

  .path {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--text-meta);
    color: var(--color-text-muted);
  }

  .keys {
    display: flex;
    flex: none;
    margin-inline-start: auto;
  }

  mark {
    padding: 0 var(--border-width);
    border-radius: var(--radius-sm);
    background: var(--color-find-match);
    color: inherit;
    font-weight: var(--weight-medium);
  }

  .note {
    margin: 0;
    padding: var(--space-3);
    font-size: var(--text-meta);
    color: var(--color-text-muted);
  }
</style>
