<script lang="ts">
  /**
   * The emoji picker: a search, and every emoji under its group. A pick gives
   * the character; Escape, or a press outside it, closes it.
   *
   * Presentational: the caller supplies the emoji and their group names, and
   * puts the pick where it belongs.
   */
  import { Portal } from '@ark-ui/svelte';
  import { portalRoot } from './portal-root';
  import { t } from '../i18n/t';

  type Item = { emoji: string; name: string; group: string };

  type Props = {
    /** Where it opens from; it sits below that. */
    at: { left: number; top: number; bottom: number };
    /** Every emoji, in order; empty while they load. */
    emojis: Item[];
    groupLabel: (group: string) => string;
    onPick: (emoji: string) => void;
    onClose: () => void;
  };

  let { at, emojis, groupLabel, onPick, onClose }: Props = $props();

  let query = $state('');
  let search: HTMLInputElement | undefined = $state();
  let panel: HTMLDivElement | undefined = $state();

  const matches = $derived.by(() => {
    const q = query.trim().toLowerCase();
    return q === '' ? null : emojis.filter((e) => e.name.includes(q));
  });

  const groups = $derived.by(() => {
    const out: { group: string; items: Item[] }[] = [];
    for (const item of emojis) {
      const last = out.at(-1);
      if (last?.group === item.group) last.items.push(item);
      else out.push({ group: item.group, items: [item] });
    }
    return out;
  });

  $effect(() => {
    search?.focus();
  });

  // A press anywhere else closes it.
  $effect(() => {
    const away = (event: PointerEvent) => {
      if (panel && !panel.contains(event.target as Node)) onClose();
    };
    document.addEventListener('pointerdown', away, true);
    return () => document.removeEventListener('pointerdown', away, true);
  });

  function keydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  }
</script>

{#snippet grid(items: Item[])}
  <div class="grid">
    {#each items as item (item.emoji)}
      <button type="button" class="emoji" title={item.name} aria-label={item.name} onclick={() => onPick(item.emoji)}>{item.emoji}</button>
    {/each}
  </div>
{/snippet}

<Portal container={portalRoot()}>
  <div
    bind:this={panel}
    class="emoji-picker"
    role="dialog"
    aria-label={t('emoji.label')}
    tabindex="-1"
    style:left={`${at.left}px`}
    style:top={`calc(${at.bottom}px + var(--space-1))`}
    onkeydown={keydown}
  >
    <input bind:this={search} bind:value={query} class="bava-field search" type="search" placeholder={t('emoji.search')} aria-label={t('emoji.search')} />
    <div class="scroll">
      {#if matches}
        {#if matches.length === 0}
          <p class="none">{t('emoji.none')}</p>
        {:else}
          {@render grid(matches)}
        {/if}
      {:else}
        {#each groups as group (group.group)}
          <h3>{groupLabel(group.group)}</h3>
          {@render grid(group.items)}
        {/each}
      {/if}
    </div>
  </div>
</Portal>

<style>
  .emoji-picker {
    position: fixed;
    z-index: var(--z-portal);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    width: var(--size-emoji-picker);
    height: var(--size-emoji-picker-height);
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
    margin: var(--space-2) 0 var(--space-1);
    font-size: var(--text-meta);
    font-weight: var(--weight-semibold);
    color: var(--color-text-muted);
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, var(--size-emoji-cell));
  }

  .emoji {
    width: var(--size-emoji-cell);
    height: var(--size-emoji-cell);
    padding: 0;
    border: 0;
    border-radius: var(--radius-sm);
    background: none;
    font-size: var(--text-emoji);
    cursor: pointer;
  }

  .emoji:hover {
    background: var(--color-control-hover);
  }

  .emoji:focus-visible {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
    outline-offset: calc(var(--focus-halo-width) * -1);
  }

  .emoji:active {
    background: var(--color-control-active);
  }

  .none {
    margin: var(--space-2) 0;
    color: var(--color-text-muted);
  }
</style>
