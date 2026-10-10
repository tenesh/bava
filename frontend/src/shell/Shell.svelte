<script lang="ts">
  /**
   * The app shell: title bar, four regions, status bar.
   *
   * It owns layout and wiring only. The editor, canvas and AI pane are handed
   * in as snippets, so this file has no IPC and no D2 knowledge.
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
  import type { Section } from '../components/SectionTabs.svelte';
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
    /** The canvas's engine and node count, while the canvas is being worked on. */
    engine?: string;
    nodes?: number;
    /** The document's counts, while it is being worked on. */
    words?: number;
    characters?: number;
    /** A message for the status bar, when something needs noticing. */
    status?: string;
    themeChoice: ThemeChoice;
    onChooseTheme: (choice: ThemeChoice) => void;
    pageWidth: 'narrow' | 'wide' | 'full';
    onPageWidth: (width: 'narrow' | 'wide' | 'full') => void;
    document: Snippet;
    canvas: Snippet;
    /** The workspace listing, or the empty state when no folder is open. */
    files?: Snippet;
    view: ViewState;
    settingsOpen?: boolean;
    /** Sections for the settings dialog, after Appearance. */
    settings?: Section[];
    /** What shows with nothing open: the start screen. */
    start?: Snippet;
    /** Whether a page is open. A Space with none shows its tree and a hint. */
    pageOpen?: boolean;
    /** The Space's name and the page's path, for the status bar. */
    space?: string;
    path?: string;
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
    words,
    characters,
    status,
    themeChoice,
    onChooseTheme,
    pageWidth,
    onPageWidth,
    document: documentPane,
    canvas: canvasPane,
    files: filesPane,
    view,
    settingsOpen = $bindable(false),
    settings = [],
    start,
    pageOpen = true,
    space,
    path,
    onPanelError = () => {},
  }: Props = $props();
</script>

<div class="shell">
  <header class="titlebar">
    <div class="identity">
      <Mark size="chrome" label={t('brand.name')} />
      <span class="filename">
        {#if pageOpen}
          {title}
          <span class="state" data-state={dirty ? 'dirty' : 'saved'}><span class="dot" aria-hidden="true"></span>{dirty ? t('file.dirty') : t('file.saved')}</span>
        {:else if open}
          {t('empty.noPage.title')}
        {:else}
          {t('empty.noFile.title')}
        {/if}
      </span>
    </div>
    {#if open}
      <ViewSwitcher value={view.mode} onValueChange={(mode) => view.setMode(mode)} />
      <div class="actions">
        <button type="button" class="bava-button ai-toggle" onclick={() => view.toggleAI()} aria-pressed={view.showsAI}>
          <ToolIcon id="ai" size="sm" />
          {t('pane.ai')}
        </button>
      </div>
    {/if}
  </header>

  {#if !open}
    <main class="no-file">
      {#if start}
        {@render start()}
      {:else}
        <EmptyState title={t('empty.noFile.title')} mark {hints} />
      {/if}
    </main>
  {/if}

  <div class="regions" class:hidden={!open}>
    {#if view.showsFiles}
      <!-- No titled pane: the Space switcher heads it. -->
      <div class="region region-files side" role="region" aria-label={t('pane.files')}>
        <PanelBoundary name={t('pane.files')} onError={(error) => onPanelError('files', error)}>
          {#if filesPane}
            {@render filesPane()}
          {:else}
            <EmptyState title={t('empty.files.title')} body={t('empty.files.body')} />
          {/if}
        </PanelBoundary>
      </div>
    {/if}

    <!--
      Both regions are always rendered and hidden with CSS rather than removed
      from the tree. CodeMirror and the canvas own their own DOM and are
      mounted once; letting a view switch unmount them would destroy the
      editor and take its undo history and cursor with it.
    -->
    {#if !pageOpen}
      <main class="region region-main no-page">
        <EmptyState title={t('empty.noPage.title')} body={t('empty.noPage.body')} {hints} />
      </main>
    {/if}

    <div class="region region-main" data-side="document" class:hidden={!pageOpen || !view.showsDocument}>
      <Pane title={t('pane.document')} variant="bare">
        <PanelBoundary name={t('pane.document')} onError={(error) => onPanelError('document', error)}>
          {@render documentPane()}
        </PanelBoundary>
      </Pane>
    </div>

    <div class="region region-main" data-side="canvas" class:hidden={!pageOpen || !view.showsCanvas}>
      <Pane title={t('pane.canvas')} variant="bare">
        <PanelBoundary name={t('pane.canvas')} onError={(error) => onPanelError('canvas', error)}>
          {@render canvasPane()}
        </PanelBoundary>
      </Pane>
    </div>

    {#if view.showsAI}
      <div class="region region-ai">
        <Pane title={t('pane.ai')}>
          <PanelBoundary name={t('pane.ai')} onError={(error) => onPanelError('ai', error)}>
            <EmptyState title={t('empty.ai.title')} body={t('empty.ai.body')} />
          </PanelBoundary>
        </Pane>
      </div>
    {/if}
  </div>

  <StatusBar {engine} {nodes} {words} {characters} {space} {path} message={status} />
</div>

<SettingsDialog
  bind:open={settingsOpen}
  choice={themeChoice}
  onChoose={onChooseTheme}
  {pageWidth}
  {onPageWidth}
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
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    margin-inline-start: var(--space-2);
    font-family: var(--font-data);
    font-size: var(--text-mono-status);
    font-weight: var(--weight-regular);
    color: var(--color-text-muted);
  }

  .state .dot {
    width: var(--size-unsaved-dot);
    height: var(--size-unsaved-dot);
    border-radius: var(--radius-full);
    background: var(--color-ok);
  }

  .state[data-state='dirty'] .dot {
    background: var(--color-pending);
  }

  .identity {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
  }

  .filename {
    font-size: var(--text-body);
    font-weight: var(--weight-medium);
    color: var(--color-text-primary);
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

  /* The titlebar's AI toggle: a shorter button, accented while the pane shows. */
  .ai-toggle {
    height: var(--size-row);
    gap: var(--space-1);
  }

  .ai-toggle[aria-pressed='true'],
  .ai-toggle[aria-pressed='true']:hover:not(:disabled) {
    background: var(--color-accent-subtle);
    border-color: var(--color-accent);
    color: var(--color-accent);
  }

  .ai-toggle[aria-pressed='true']:active:not(:disabled) {
    background: linear-gradient(var(--color-control-active), var(--color-control-active)), var(--color-accent-subtle);
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
    flex: 0 0 var(--size-side-pane);
  }

  /* The side pane: the Space switcher, then Files; it scrolls on its own. */
  .side {
    display: flex;
    flex-direction: column;
    background: var(--color-surface-nav);
    overflow: auto;
  }

  .no-page {
    display: flex;
    align-items: center;
    justify-content: center;
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
