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
  import { ICON_GRID, ICON_STROKE, iconSvg } from '../canvas/icons/sets';
  import { iconParts } from '../canvas/icons/icon-look';
  import { t } from '../i18n/t';

  type Props = {
    icons: IconPickerState;
    /** The id each tile's option takes, for the search's active descendant. */
    optionId: (index: number) => string;
    listId: string;
    onPick: (index: number) => void;
  };

  let { icons, optionId, listId, onPick }: Props = $props();

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
        onclick={() => onPick(index)}
      >
        <span class="tile-icon">
          {#if icon.set === 'custom'}
            <!-- A custom icon as a picture, in its own colours: a picture runs nothing. -->
            <img alt="" src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(iconSvg(icon, '', false))}`} />
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
        <span class="tile-label">{icon.title}</span>
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

  .empty {
    grid-column: 1 / -1;
    margin: 0;
    padding: var(--space-3) 0;
    font-size: var(--text-meta);
    color: var(--color-text-muted);
  }
</style>
