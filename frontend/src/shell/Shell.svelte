<script lang="ts">
  /**
   * The app shell: title bar, four regions, status bar.
   *
   * It owns layout and wiring only. The editor, canvas and AI pane are handed
   * in as snippets, so this file has no IPC and no D2 knowledge and the regions
   * can be built out milestone by milestone.
   */
  import type { Snippet } from 'svelte';
  import Pane from '../components/Pane.svelte';
  import EmptyState from '../components/EmptyState.svelte';
  import StatusBar from '../components/StatusBar.svelte';
  import ViewSwitcher from '../components/ViewSwitcher.svelte';
  import SettingsDialog from '../settings/SettingsDialog.svelte';
  import { t } from '../i18n/t';
  import { createViewState } from './view.svelte';
  import type { ThemeChoice } from '../styles/theme.svelte';

  type Props = {
    title: string;
    /** Shown beside the filename: saved, or unsaved changes. */
    dirty?: boolean;
    engine: string;
    nodes: number;
    errors: number;
    themeChoice: ThemeChoice;
    onChooseTheme: (choice: ThemeChoice) => void;
    document: Snippet;
    canvas: Snippet;
    /** The workspace listing, or the empty state when no folder is open. */
    files?: Snippet;
    /** Actions for the title bar: open, save. */
    actions?: Snippet;
  };

  let {
    title,
    dirty = false,
    engine,
    nodes,
    errors,
    themeChoice,
    onChooseTheme,
    document: documentPane,
    canvas: canvasPane,
    files: filesPane,
    actions,
  }: Props = $props();

  const view = createViewState();
  let settingsOpen = $state(false);
</script>

<div class="shell">
  <header class="titlebar">
    <span class="filename">
      {title}
      <span class="state" class:dirty>{dirty ? t('file.dirty') : t('file.saved')}</span>
    </span>
    <ViewSwitcher value={view.mode} onValueChange={(mode) => view.setMode(mode)} />
    <div class="actions">
      {#if actions}{@render actions()}{/if}
      <button type="button" class="action" onclick={() => view.toggleAI()} aria-pressed={view.showsAI}>
        {t('pane.ai')}
      </button>
      <button type="button" class="action" onclick={() => (settingsOpen = true)}>
        {t('settings.title')}
      </button>
    </div>
  </header>

  <div class="regions">
    {#if view.showsFiles}
      <div class="region region-files">
        <Pane title={t('pane.files')}>
          {#if filesPane}
            {@render filesPane()}
          {:else}
            <EmptyState title={t('empty.files.title')} body={t('empty.files.body')} />
          {/if}
        </Pane>
      </div>
    {/if}

    <!--
      Both regions are always rendered and hidden with CSS rather than removed
      from the tree. CodeMirror and the canvas own their own DOM and are
      mounted once; letting a view switch unmount them would destroy the
      editor and take its undo history and cursor with it.
    -->
    <div class="region region-main" class:hidden={!view.showsDocument}>
      <Pane title={t('pane.document')}>
        {@render documentPane()}
      </Pane>
    </div>

    <div class="region region-main" class:hidden={!view.showsCanvas}>
      <Pane title={t('pane.canvas')}>
        {@render canvasPane()}
      </Pane>
    </div>

    {#if view.showsAI}
      <div class="region region-ai">
        <Pane title={t('pane.ai')}>
          <EmptyState title={t('empty.canvas.title')} />
        </Pane>
      </div>
    {/if}
  </div>

  <StatusBar {engine} {nodes} {errors} />
</div>

<SettingsDialog
  bind:open={settingsOpen}
  choice={themeChoice}
  onChoose={onChooseTheme}
  onOpenChange={(open) => (settingsOpen = open)}
/>

<style>
  .shell {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--color-surface);
    color: var(--color-text-primary);
  }

  .titlebar {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: var(--space-3);
    height: var(--size-titlebar);
    padding: 0 var(--space-3);
    border-bottom: var(--border-width) solid var(--color-border-subtle);
    background: var(--color-surface-nav);
    flex: none;
  }

  .state {
    margin-inline-start: var(--space-2);
    font-family: var(--font-mono);
    font-size: var(--text-mono-chip);
    color: var(--color-text-faint);
  }

  .state.dirty {
    color: var(--color-accent);
  }

  .filename {
    font-size: var(--text-control);
    color: var(--color-text-secondary);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-1);
  }

  .action {
    height: var(--size-row);
    padding: 0 var(--space-3);
    border: var(--border-width) solid transparent;
    border-radius: var(--radius-sm);
    background: transparent;
    font: inherit;
    font-size: var(--text-control);
    color: var(--color-text-secondary);
  }

  .action[aria-pressed='true'] {
    background: var(--color-accent-subtle);
    color: var(--color-accent);
  }

  .action:focus-visible {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
  }

  .regions {
    flex: 1;
    min-height: 0;
    display: flex;
  }

  .region {
    min-width: 0;
    min-height: 0;
    border-inline-end: var(--border-width) solid var(--color-border-subtle);
  }

  .region:last-child {
    border-inline-end: 0;
  }

  .region-files {
    flex: 0 0 18%;
  }

  .region-main {
    flex: 1;
  }

  .region-ai {
    flex: 0 0 22%;
  }

  .hidden {
    display: none;
  }
</style>
