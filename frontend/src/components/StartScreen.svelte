<script lang="ts">
  /**
   * What Bava shows with no Space and no page open: the mark,
   * New Space, Open Space and Open file, and the recent Spaces, each with
   * a button that takes it off the list (its folder is never touched).
   *
   * Presentational: it reports what was chosen.
   */
  import Mark from './Mark.svelte';
  import ToolIcon from './ToolIcon.svelte';
  import { spaceInitial as initial, tileFill, tileText } from './space-tile';
  import { t } from '../i18n/t';

  type Recent = { path: string; name: string; when: string; missing?: boolean };

  type Props = {
    recents: Recent[];
    onNewSpace: () => void;
    onOpenSpace: () => void;
    onOpenFile: () => void;
    onOpenRecent: (path: string) => void;
    /** A recent Space taken off the list. */
    onRemoveRecent: (path: string) => void;
  };

  let { recents, onNewSpace, onOpenSpace, onOpenFile, onOpenRecent, onRemoveRecent }: Props = $props();
</script>

<main class="start">
  <div class="column">
    <header class="brand">
      <Mark size="start" label={t('brand.name')} />
      <div class="words">
        <h1>{t('brand.name')}</h1>
        <p>{t('start.tagline')}</p>
      </div>
    </header>

    <div class="actions">
      <button type="button" class="bava-button action primary" onclick={onNewSpace}><ToolIcon id="insert" size="sm" />{t('space.new')}</button>
      <button type="button" class="bava-button action" onclick={onOpenSpace}><ToolIcon id="folder" size="sm" />{t('space.open')}</button>
      <button type="button" class="bava-button action" onclick={onOpenFile}><ToolIcon id="page" size="sm" />{t('space.openFile')}</button>
    </div>

    {#if recents.length > 0}
      <section class="recents" aria-label={t('space.recent')}>
        <h2>{t('space.recent')}</h2>
        {#each recents as recent (recent.path)}
          <div class="entry" data-missing={recent.missing ? '' : undefined}>
            <button type="button" class="recent" disabled={recent.missing} onclick={() => onOpenRecent(recent.path)}>
              <span class="tile" style:background={tileFill(recent.name)} style:color={tileText(recent.name)} aria-hidden="true">{initial(recent.name)}</span>
              <span class="text">
                <span class="name">{recent.name}</span>
                <span class="path">{recent.missing ? t('start.missing') : recent.path}</span>
              </span>
              <span class="when">{recent.when}</span>
            </button>
            <button
              type="button"
              class="bava-icon-button remove"
              aria-label={t('start.remove').replace('{name}', recent.name)}
              title={t('start.remove').replace('{name}', recent.name)}
              onclick={() => onRemoveRecent(recent.path)}
            >
              <ToolIcon id="close" size="sm" />
            </button>
          </div>
        {/each}
      </section>
    {/if}

    <p class="note">{t('start.note')}</p>
  </div>
</main>

<style>
  .start {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: var(--space-8);
    box-sizing: border-box;
    overflow: auto;
  }

  .column {
    display: flex;
    flex-direction: column;
    gap: var(--space-7);
    width: min(100%, var(--size-start-width));
  }

  .brand {
    display: flex;
    align-items: center;
    gap: var(--space-4);
  }

  h1 {
    margin: 0;
    font-size: var(--text-wordmark);
    font-weight: var(--weight-semibold);
    color: var(--color-text-primary);
  }

  .words p {
    margin: 0;
    color: var(--color-text-secondary);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  /* The start screen's actions stand taller than a dialog's. */
  .action {
    height: var(--size-toolbar);
    padding: 0 var(--space-4);
  }

  .recent:focus-visible {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
    outline-offset: var(--focus-ring-width);
  }

  /*
   * Rows keep their inner padding for the hover fill, and the list sits out
   * by that much, so its heading, tiles and dates line up with the buttons.
   */
  .recents {
    margin-inline: calc(var(--space-3) * -1);
    display: flex;
    flex-direction: column;
    gap: var(--size-row-gap);
  }

  h2 {
    margin: 0;
    padding: 0 var(--space-3);
    font-size: var(--text-label);
    font-weight: var(--weight-semibold);
    letter-spacing: var(--tracking-label);
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  /* A row and its remove button, side by side. */
  .entry {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .recent {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-2) var(--space-3);
    border: 0;
    border-radius: var(--radius-lg);
    background: transparent;
    color: var(--color-text-primary);
    font: inherit;
    text-align: left;
  }

  .recent:hover:not(:disabled),
  .recent:focus-visible {
    background: var(--color-selection);
  }

  .recent:active:not(:disabled) {
    background: linear-gradient(var(--color-control-active), var(--color-control-active)), var(--color-selection);
  }

  .recent:disabled {
    opacity: var(--opacity-disabled);
  }

  /* Out of sight until its row is pointed at or reached by keys, but still
     in the tab order; always there on a row whose folder is gone. */
  .remove {
    flex: none;
    opacity: 0;
  }

  .entry:hover .remove,
  .entry:focus-within .remove,
  .entry[data-missing] .remove {
    opacity: 1;
  }

  .tile {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--size-toolbar);
    height: var(--size-toolbar);
    flex: none;
    border-radius: var(--radius-lg);
    font-size: var(--text-tile);
    font-weight: var(--weight-semibold);
  }

  .text {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }

  .name {
    font-weight: var(--weight-medium);
  }

  .path {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: var(--font-mono);
    font-size: var(--text-mono-status);
    color: var(--color-text-muted);
  }

  .when {
    font-size: var(--text-meta);
    color: var(--color-text-muted);
  }

  .note {
    margin: 0;
    font-size: var(--text-meta);
    color: var(--color-text-muted);
  }
</style>
