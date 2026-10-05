<script lang="ts">
  /**
   * The frame picker (`/` Embed frame): a search, and every frame by name
   * with its thumbnail, this page's first, then each other page's under its
   * name. A pick gives the frame and the page it is on; Escape, or a press
   * outside it, closes it.
   *
   * Presentational: the caller supplies the frames and their thumbnails, and
   * puts the pick where it belongs.
   */
  import Portal from './Portal.svelte';
  import { pressAway } from './press-away';
  import { t } from '../i18n/t';

  type Frame = { id: string; label: string; thumb: string | null };
  type Group = { page: string | null; title: string; frames: Frame[] };

  type Props = {
    /** Where it opens from; it sits below that. */
    at: { left: number; top: number; bottom: number };
    /** The frames by page: this page's (`page` null) first. */
    groups: Group[];
    onPick: (frame: string, page: string | null) => void;
    onClose: () => void;
  };

  let { at, groups, onPick, onClose }: Props = $props();

  let query = $state('');
  let highlighted = $state(0);
  let search: HTMLInputElement | undefined = $state();
  let panel: HTMLDivElement | undefined = $state();

  /** The groups with the frames whose names match, each frame's place in the whole list. */
  const shown = $derived.by(() => {
    const q = query.trim().toLowerCase();
    let index = 0;
    return groups
      .map((group) => ({ ...group, frames: group.frames.filter((frame) => q === '' || frame.label.toLowerCase().includes(q)).map((frame) => ({ ...frame, index: index++ })) }))
      .filter((group) => group.frames.length > 0);
  });
  const rows = $derived(shown.flatMap((group) => group.frames.map((frame) => ({ frame, page: group.page }))));
  const empty = $derived(groups.every((group) => group.frames.length === 0));

  $effect(() => {
    search?.focus();
  });

  // A new search starts from the first frame it shows.
  $effect(() => {
    void query;
    highlighted = 0;
  });

  // A press anywhere else closes it.
  $effect(() => pressAway(() => panel, onClose));

  function keydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (rows.length > 0) highlighted = (highlighted + (event.key === 'ArrowDown' ? 1 : rows.length - 1)) % rows.length;
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const row = rows[highlighted];
      if (row) onPick(row.frame.id, row.page);
    }
  }
</script>

<Portal>
  <div
    bind:this={panel}
    class="frame-picker"
    role="dialog"
    aria-label={t('frames.label')}
    tabindex="-1"
    style:left={`${at.left}px`}
    style:top={`calc(${at.bottom}px + var(--space-1))`}
    onkeydown={keydown}
  >
    <input bind:this={search} bind:value={query} class="bava-field search" type="search" placeholder={t('frames.search')} aria-label={t('frames.search')} />
    <div class="scroll" role="listbox" aria-label={t('frames.label')}>
      {#if empty}
        <p class="none">{t('frames.empty')}</p>
      {:else if rows.length === 0}
        <p class="none">{t('frames.none')}</p>
      {:else}
        {#each shown as group (group.page ?? '')}
          <h3>{group.title}</h3>
          {#each group.frames as frame (frame.id)}
            <button
              type="button"
              class="frame"
              role="option"
              aria-selected={frame.index === highlighted}
              data-highlighted={frame.index === highlighted ? '' : undefined}
              onpointermove={() => (highlighted = frame.index)}
              onclick={() => onPick(frame.id, group.page)}
            >
              <span class="thumb">{#if frame.thumb}<img src={frame.thumb} alt="" />{/if}</span>
              <span class="name">{frame.label}</span>
            </button>
          {/each}
        {/each}
      {/if}
    </div>
  </div>
</Portal>

<style>
  .frame-picker {
    position: fixed;
    z-index: var(--z-portal);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    width: var(--size-frame-picker);
    max-height: var(--size-frame-picker-height);
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

  h3 {
    margin: var(--space-2) var(--space-1) var(--space-1);
    font-size: var(--text-meta);
    font-weight: var(--weight-semibold);
    color: var(--color-text-muted);
  }

  .frame {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    padding: var(--space-1);
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    color: var(--color-text-primary);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .frame:hover {
    background: var(--color-control-hover);
  }

  .frame[data-highlighted] {
    background: var(--color-selection);
  }

  .frame:active {
    background: var(--color-control-active);
  }

  .frame:focus-visible {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
    outline-offset: calc(var(--focus-halo-width) * -1);
  }

  .thumb {
    flex: none;
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--size-frame-thumb-width);
    height: var(--size-frame-thumb-height);
    overflow: hidden;
    border: var(--border-width) solid var(--color-border-subtle);
    border-radius: var(--radius-sm);
    background: var(--color-canvas-bg);
  }

  .thumb img {
    max-width: 100%;
    max-height: 100%;
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .none {
    margin: var(--space-2) var(--space-1);
    color: var(--color-text-muted);
  }
</style>
