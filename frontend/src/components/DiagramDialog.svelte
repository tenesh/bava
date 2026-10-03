<script lang="ts">
  /**
   * Write D2, see it, and put it on the canvas.
   *
   * Presentational: it shows the preview and the diagnostics it is handed, and
   * reports the source as it changes and the insert when it is asked for.
   * Rendering, debouncing and conversion all belong to the caller, which owns
   * the one render path.
   *
   * The editor is CodeMirror, mounted imperatively and destroyed in the
   * cleanup: it is never handed reactive props (`.ai/rules/editors.md`).
   */
  import Dialog from './Dialog.svelte';
  import LayoutEnginePicker from './LayoutEnginePicker.svelte';
  import { diagramStatus } from './diagram-status';
  import type { Direction, LayoutEngine } from '../settings/layout-engine';
  import { SourcePane } from '../editor/source-pane';
  import type { KeyBinding } from '@codemirror/view';
  import { withoutRemoteRefs } from '../canvas/import/safe-svg';
  import { t } from '../i18n/t';
  import type { Diagnostic } from '../../bindings/github.com/tenesh/bava/internal/render/models';

  type Props = {
    open: boolean;
    /** The source to start from; later changes come back through `onSource`. */
    source: string;
    /** The rendered SVG of the last good compile. */
    preview: string;
    errors: Diagnostic[];
    /** Whether a render is still coming: the preview is the previous source. */
    pending: boolean;
    /** How many shapes the last good layout holds. Nothing to insert at zero. */
    shapes: number;
    /** The layout the preview is drawn with, and the insert will use. */
    engine: LayoutEngine;
    direction: Direction;
    onEngine: (engine: LayoutEngine) => void;
    onDirection: (direction: Direction) => void;
    /** Keys the native menu owns, which the editor drops, as the document pane does. */
    isReserved?: (binding: KeyBinding) => boolean;
    onSource: (source: string) => void;
    onInsert: () => void;
    onOpenChange: (open: boolean) => void;
  };

  let {
    open = $bindable(),
    source,
    preview,
    errors,
    pending,
    shapes,
    engine,
    direction,
    onEngine,
    onDirection,
    isReserved,
    onSource,
    onInsert,
    onOpenChange,
  }: Props = $props();

  let host: HTMLDivElement | undefined = $state();
  // State, so the diagnostics effect below runs again once the editor exists:
  // the host is portalled and appears after the first errors are handed in.
  let pane: SourcePane | undefined = $state.raw();
  // What is in the editor, tracked here because the editor is not reactive.
  // Seeded when it is created, from the source it was opened with.
  let typed = $state('');

  // Everything that would make Insert do the wrong thing, or nothing at all:
  // a diagram that does not compile, one still being rendered, and one that
  // compiled to no shapes (a file of comments still renders an empty SVG).
  const canInsert = $derived(errors.length === 0 && !pending && typed.trim().length > 0 && shapes > 0);
  const status = $derived(diagramStatus(engine, shapes));

  // The dialog's content is portalled, so its host does not exist at mount:
  // the editor is created when the element appears and destroyed with it.
  $effect(() => {
    const element = host;
    if (!element) return;
    const editor = new SourcePane();
    typed = source;
    editor.mount(element, {
      doc: source,
      isReserved,
      onChange: (next) => {
        typed = next;
        onSource(next);
      },
    });
    pane = editor;
    return () => {
      editor.destroy();
      pane = undefined;
    };
  });

  // Diagnostics reach the editor's gutter, which is imperative: pushing them
  // in an effect is the seam between the reactive shell and the editor.
  $effect(() => {
    const list = errors;
    pane?.setDiagnostics(list);
  });
</script>

{#snippet footer()}
  <div class="footer">
    <LayoutEnginePicker {engine} {direction} directionHint={t('diagram.directionHint')} {onEngine} {onDirection} />
    <span class="buttons">
      <button type="button" class="bava-button" onclick={() => onOpenChange(false)}>{t('diagram.cancel')}</button>
      <button type="button" class="bava-button primary" disabled={!canInsert} onclick={() => onInsert()}>
        {t('diagram.insert')}
      </button>
    </span>
  </div>
{/snippet}

<!-- The editor is built when the content appears and destroyed with it, so a
     reopen starts from the source the caller gives it, not the last one. -->
<Dialog
  bind:open
  unmountWhenClosed
  size="diagram"
  flush
  title={t('diagram.title')}
  subtitle={t('diagram.hint')}
  {footer}
  onOpenChange={(next) => onOpenChange(next)}
>
  <div class="bava-diagram">
    <div class="panes">
      <div class="editor" bind:this={host}></div>
      <div class="preview-frame">
        <!-- The SVG the caller rendered, through the one render path, with any
             reference that would reach outside the app taken out first. -->
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        <div class="bava-diagram-preview">{@html withoutRemoteRefs(preview)}</div>
        {#if status}<span class="bava-diagram-status">{status}</span>{/if}
      </div>
    </div>

    {#if errors.length > 0}
      <ul class="errors">
        {#each errors as error, i (i)}
          <li>{error.line > 0 ? `${error.line}: ` : ''}{error.message}</li>
        {/each}
      </ul>
    {/if}
  </div>
</Dialog>

<style>
  .bava-diagram {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  .panes {
    display: grid;
    flex: 1 1 auto;
    grid-template-columns: 1fr 1fr;
    min-height: 0;
  }

  .editor {
    min-width: 0;
    padding: var(--space-3) 0;
    overflow: auto;
    border-right: var(--border-width) solid var(--color-border-subtle);
    background: var(--color-surface-raised);
  }

  /* Focus shows as a text field's does: the ring inside the pane's edge. */
  .editor:focus-within {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
    outline-offset: calc(var(--focus-ring-width) * -1);
  }

  .editor :global(.cm-gutters) {
    border: 0;
    background: transparent;
  }

  .preview-frame {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    padding: var(--space-5);
    overflow: auto;
    background-color: var(--color-canvas-bg);
    background-image: radial-gradient(var(--color-canvas-dot) var(--size-canvas-dot), transparent var(--size-canvas-dot));
    background-size: var(--size-canvas-grid) var(--size-canvas-grid);
  }

  .bava-diagram-preview {
    display: flex;
    max-width: 100%;
    max-height: 100%;
  }

  .bava-diagram-preview :global(svg) {
    max-width: 100%;
    max-height: 100%;
  }

  .bava-diagram-status {
    position: absolute;
    bottom: var(--space-3);
    left: var(--space-3);
    font-family: var(--font-mono);
    font-size: var(--text-mono-status);
    color: var(--color-text-muted);
  }

  .errors {
    flex: none;
    max-height: var(--size-diagram-errors);
    margin: 0;
    padding: var(--space-2) var(--space-5);
    overflow: auto;
    list-style: none;
    border-top: var(--border-width) solid var(--color-border-subtle);
    background: var(--color-danger-subtle);
    font-family: var(--font-mono);
    font-size: var(--text-mono-chip);
    color: var(--color-text-primary);
  }

  .footer {
    display: flex;
    flex: 1 1 auto;
    align-items: center;
    gap: var(--space-4);
  }

  .buttons {
    display: flex;
    gap: var(--space-2);
    margin-inline-start: auto;
  }
</style>
