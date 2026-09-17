<script lang="ts">
  /**
   * The app shell: title bar, four regions, status bar.
   *
   * It owns layout and wiring only. The editor, canvas and AI pane are handed
   * in as snippets, so this file has no IPC and no D2 knowledge and the regions
   * can be built out milestone by milestone.
   *
   * View state and the settings dialog's open flag are handed in too: the
   * native menu changes both, and it reaches them through App's commands.
   * File actions and Settings live in that menu, not in the title bar.
   *
   * With no file open the regions are hidden, never unmounted, and the main
   * area shows how to open or start one.
   */
  import type { Snippet } from 'svelte';
  import Mark from '../components/Mark.svelte';
  import ToolIcon from '../components/ToolIcon.svelte';
  import Pane from '../components/Pane.svelte';
  import PanelBoundary from '../components/PanelBoundary.svelte';
  import EmptyState from '../components/EmptyState.svelte';
  import StatusBar from '../components/StatusBar.svelte';
  import ViewSwitcher from '../components/ViewSwitcher.svelte';
  import SettingsDialog from '../settings/SettingsDialog.svelte';
  import { t } from '../i18n/t';
  import type { ViewState } from './view.svelte';
  import type { ThemeChoice } from '../styles/theme.svelte';

  type Props = {
    /** Whether a document is open. When not, the shell shows the no-file state. */
    open: boolean;
    /** Keys and actions for the no-file state. */
    hints?: { keys: string; label: string }[];
    title: string;
    /** Shown beside the filename: saved, or unsaved changes. */
    dirty?: boolean;
    /** Engine and node count describe a document; omitted when none is open. */
    engine?: string;
    nodes?: number;
    errors: number;
    /** A message for the status bar, when something needs noticing. */
    status?: string;
    themeChoice: ThemeChoice;
    onChooseTheme: (choice: ThemeChoice) => void;
    document: Snippet;
    canvas: Snippet;
    /** The workspace listing, or the empty state when no folder is open. */
    files?: Snippet;
    view: ViewState;
    settingsOpen?: boolean;
    /** Extra sections for the settings dialog, after Appearance. */
    settings?: Snippet;
    /** A panel crashed while rendering. The shell keeps it contained. */
    onPanelError?: (panel: string, error: unknown) => void;
  };

  let {
    open,
    hints = [],
    title,
    dirty = false,
    engine,
    nodes,
    errors,
    status,
    themeChoice,
    onChooseTheme,
    document: documentPane,
    canvas: canvasPane,
    files: filesPane,
    view,
    settingsOpen = $bindable(false),
    settings,
    onPanelError = () => {},
  }: Props = $props();
</script>

<div class="shell">
  <header class="titlebar">
    <div class="identity">
      <Mark size="chrome" label={t('brand.name')} />
      <span class="filename">
        {#if open}
          {title}
          <span class="state" class:dirty>{dirty ? t('file.dirty') : t('file.saved')}</span>
        {:else}
          {t('empty.noFile.title')}
        {/if}
      </span>
    </div>
    {#if open}
      <ViewSwitcher value={view.mode} onValueChange={(mode) => view.setMode(mode)} />
      <div class="actions">
        <button type="button" class="action bordered" onclick={() => view.toggleAI()} aria-pressed={view.showsAI}>
          <ToolIcon id="ai" size="sm" />
          {t('pane.ai')}
        </button>
      </div>
    {/if}
  </header>

  {#if !open}
    <main class="no-file">
      <EmptyState title={t('empty.noFile.title')} mark {hints} />
    </main>
  {/if}

  <div class="regions" class:hidden={!open}>
    {#if view.showsFiles}
      <div class="region region-files">
        <Pane title={t('pane.files')}>
          <PanelBoundary name={t('pane.files')} onError={(error) => onPanelError('files', error)}>
            {#if filesPane}
              {@render filesPane()}
            {:else}
              <EmptyState title={t('empty.files.title')} body={t('empty.files.body')} />
            {/if}
          </PanelBoundary>
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
        <PanelBoundary name={t('pane.document')} onError={(error) => onPanelError('document', error)}>
          {@render documentPane()}
        </PanelBoundary>
      </Pane>
    </div>

    <div class="region region-main" class:hidden={!view.showsCanvas}>
      <Pane title={t('pane.canvas')}>
        <PanelBoundary name={t('pane.canvas')} onError={(error) => onPanelError('canvas', error)}>
          {@render canvasPane()}
        </PanelBoundary>
      </Pane>
    </div>

    {#if view.showsAI}
      <div class="region region-ai">
        <Pane title={t('pane.ai')}>
          <PanelBoundary name={t('pane.ai')} onError={(error) => onPanelError('ai', error)}>
            <EmptyState title={t('empty.canvas.title')} />
          </PanelBoundary>
        </Pane>
      </div>
    {/if}
  </div>

  <StatusBar {engine} {nodes} {errors} message={status} />
</div>

<SettingsDialog
  bind:open={settingsOpen}
  choice={themeChoice}
  onChoose={onChooseTheme}
  onOpenChange={(open) => (settingsOpen = open)}
  sections={settings}
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
    padding-inline-start: calc(var(--space-3) + var(--size-titlebar-inset-start));
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

  .identity {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
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

  .action.bordered {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    border-color: var(--color-border-strong);
  }

  .action[aria-pressed='true'] {
    background: var(--color-accent-subtle);
    border-color: var(--color-accent);
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

  .no-file {
    flex: 1;
    min-height: 0;
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
