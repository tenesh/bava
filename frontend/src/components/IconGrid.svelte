<script lang="ts">
  /**
   * The icon picker's grid: each icon drawn as it will be placed, named under
   * it, a page at a time; scrolled to its end, it asks for the next page.
   *
   * Presentational over the picker state it is handed. A bundled icon is
   * drawn in the text colour here; a custom one in its own colours.
   */
  import { GRID_COLUMNS } from '../shell/insert.svelte';
  import type { IconPickerState } from '../shell/icon-picker.svelte';
  import { ICON_GRID, ICON_STROKE, iconPictureAddress } from '../canvas/icons/sets';
  import { iconParts } from '../canvas/icons/icon-look';
  import { t } from '../i18n/t';

  type Props = {
    icons: IconPickerState;
    /** The id each tile's option takes, for the search's active descendant. */
    optionId: (index: number) => string;
    listId: string;
    onPick: (index: number) => void;
    /** A custom icon's menu asked for, at a point in the window. */
    onMenu?: (index: number, at: { x: number; y: number }) => void;
    /** The custom icon being renamed, typed in place of its name. */
    renaming?: string | null;
    onRename?: (from: string, to: string) => void;
    onCancelRename?: () => void;
    /** Whether the app is dark: a custom icon shows its dark copy. */
    dark?: boolean;
  };

  let { icons, optionId, listId, onPick, onMenu, renaming = null, onRename, onCancelRename, dark = false }: Props = $props();

  /** Answered by Enter or Escape: the blur as the field goes is no second answer. */
  let settled = false;

  /** Focus and select the name as the field opens, as a file's name is renamed. */
  function selected(field: HTMLInputElement) {
    settled = false;
    field.focus();
    field.select();
  }

  let grid: HTMLDivElement;

  // The highlighted tile stays in view as the arrow keys move it.
  $effect(() => {
    const id = optionId(icons.highlighted);
    grid?.querySelector(`#${id}`)?.scrollIntoView?.({ block: 'nearest' });
  });

  function onScroll() {
    if (grid.scrollTop + grid.clientHeight >= grid.scrollHeight - grid.clientHeight / 2) icons.more();
  }
</script>

<div
  bind:this={grid}
  id={listId}
  class="icon-grid"
  style:--columns={GRID_COLUMNS}
  role="listbox"
  aria-label={t('insert.iconSearch')}
  aria-busy={icons.status === 'loading'}
  onscroll={onScroll}
>
  {#if icons.status === 'failed'}
    <p class="empty">{t('insert.iconsFailed')}</p>
  {:else if icons.status === 'loading'}
    <!-- A row of empty tiles while the set loads, so the panel does not jump. -->
    {#each Array.from({ length: GRID_COLUMNS }, (_, n) => n) as n (n)}
      <div class="tile" aria-hidden="true"><span class="tile-icon"></span></div>
    {/each}
  {:else}
    {#each icons.results as icon, index (`${icon.set}/${icon.name}`)}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <div
        id={optionId(index)}
        class="tile"
        role="option"
        aria-selected={index === icons.highlighted}
        tabindex="-1"
        title={icon.title}
        onpointermove={() => icons.highlight(index)}
        onclick={() => renaming !== icon.name && onPick(index)}
        oncontextmenu={(event) => {
          if (icon.set !== 'custom' || !onMenu) return;
          event.preventDefault();
          onMenu(index, { x: event.clientX, y: event.clientY });
        }}
      >
        <span class="tile-icon">
          {#if icon.set === 'custom'}
            <!-- A custom icon as a picture, in its own colours: a picture runs nothing. -->
            <img alt="" src={iconPictureAddress((dark && icon.darkSvg) || icon.svg || '')} />
          {:else}
            <svg viewBox={`0 0 ${ICON_GRID} ${ICON_GRID}`} aria-hidden="true">
              {#each iconParts(icon) as part, n (n)}
                <path
                  d={part.d}
                  fill={part.fill ? 'currentColor' : 'none'}
                  stroke={part.stroke ? 'currentColor' : 'none'}
                  stroke-width={part.stroke ? ICON_STROKE : undefined}
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  opacity={part.opacity === 1 ? undefined : part.opacity}
                />
              {/each}
            </svg>
          {/if}
        </span>
        {#if icon.set === 'custom' && renaming === icon.name}
          <input
            class="bava-field rename"
            value={icon.name}
            aria-label={t('insert.iconRename')}
            spellcheck="false"
            autocomplete="off"
            use:selected
            onkeydown={(event) => {
              if (event.key !== 'Enter' && event.key !== 'Escape') return;
              event.preventDefault();
              event.stopPropagation();
              if (settled) return;
              settled = true;
              if (event.key === 'Enter') onRename?.(icon.name, event.currentTarget.value);
              else onCancelRename?.();
            }}
            onblur={(event) => {
              if (settled) return;
              settled = true;
              onRename?.(icon.name, event.currentTarget.value);
            }}
          />
        {:else}
          <span class="tile-label">{icon.title}</span>
        {/if}
      </div>
    {:else}
      <p class="empty">{t('insert.empty')}</p>
    {/each}
  {/if}
</div>

<style>
  .icon-grid {
    display: grid;
    grid-template-columns: repeat(var(--columns), 1fr);
    align-content: start;
    gap: var(--space-2);
    max-height: var(--size-icon-grid-height);
    overflow-y: auto;
    padding: 0 var(--space-3) var(--space-3);
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

  .tile-icon svg,
  .tile-icon img {
    width: var(--space-7);
    height: var(--space-7);
  }

  .tile[aria-selected='true'] .tile-icon {
    background: var(--color-accent-subtle);
    border-color: var(--color-accent);
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
    outline-offset: calc(var(--focus-halo-width) * -1);
  }

  .tile-label {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--text-meta);
    color: var(--color-text-muted);
  }

  .rename {
    width: 100%;
    min-width: 0;
    font-size: var(--text-meta);
  }

  /* The shared field's ring, stated here as every component states its own. */
  .rename:focus-visible {
    outline: none;
    border-color: var(--color-focus-ring);
    box-shadow: 0 0 0 var(--focus-halo-width) var(--color-focus-halo);
  }

  .empty {
    grid-column: 1 / -1;
    margin: 0;
    padding: var(--space-3) 0;
    font-size: var(--text-meta);
    color: var(--color-text-muted);
  }
</style>
