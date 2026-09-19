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
  import { SourcePane } from '../editor/source-pane';
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
    onSource: (source: string) => void;
    onInsert: () => void;
    onOpenChange: (open: boolean) => void;
  };

  let { open = $bindable(), source, preview, errors, pending, shapes, onSource, onInsert, onOpenChange }: Props =
    $props();

  let host: HTMLDivElement | undefined = $state();
  let pane: SourcePane | undefined;
  // What is in the editor, tracked here because the editor is not reactive.
  // Seeded when it is created, from the source it was opened with.
  let typed = $state('');

  // Everything that would make Insert do the wrong thing, or nothing at all:
  // a diagram that does not compile, one still being rendered, and one that
  // compiled to no shapes (a file of comments still renders an empty SVG).
  const canInsert = $derived(errors.length === 0 && !pending && typed.trim().length > 0 && shapes > 0);

  // The dialog's content is portalled, so its host does not exist at mount:
  // the editor is created when the element appears and destroyed with it.
  $effect(() => {
    const element = host;
    if (!element) return;
    const editor = new SourcePane();
    typed = source;
    editor.mount(element, {
      doc: source,
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
    pane?.setDiagnostics(errors);
  });
</script>

<!-- The editor is built when the content appears and destroyed with it, so a
     reopen starts from the source the caller gives it, not the last one. -->
<Dialog bind:open unmountWhenClosed title={t('diagram.title')} onOpenChange={(next) => onOpenChange(next)}>
  <div class="panes">
    <div class="editor" bind:this={host}></div>
    <div class="preview-frame">
      <!-- The SVG the caller rendered, through the one render path, with any
           reference that would reach outside the app taken out first. -->
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      <div class="bava-diagram-preview">{@html withoutRemoteRefs(preview)}</div>
    </div>
  </div>

  {#if errors.length > 0}
    <ul class="errors">
      {#each errors as error, i (i)}
        <li>{error.line > 0 ? `${error.line}: ` : ''}{error.message}</li>
      {/each}
    </ul>
  {/if}

  <div class="actions">
    <button type="button" class="action" onclick={() => onOpenChange(false)}>{t('diagram.cancel')}</button>
    <button type="button" class="action primary" disabled={!canInsert} onclick={() => onInsert()}>
      {t('diagram.insert')}
    </button>
  </div>
</Dialog>

<style>
  .panes {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-3);
    height: var(--size-diagram-dialog);
    margin-bottom: var(--space-3);
  }

  .editor,
  .preview-frame {
    overflow: auto;
    border: var(--border-width) solid var(--color-border-subtle);
    border-radius: var(--radius-md);
    background: var(--color-surface-sunken);
  }

  .preview-frame {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-2);
  }

  .bava-diagram-preview :global(svg) {
    max-width: 100%;
    max-height: 100%;
  }

  .errors {
    max-height: var(--size-diagram-errors);
    margin: 0 0 var(--space-3);
    padding: var(--space-2) var(--space-3);
    overflow: auto;
    list-style: none;
    border-radius: var(--radius-sm);
    background: var(--color-danger-subtle);
    font-family: var(--font-mono);
    font-size: var(--text-mono-chip);
    color: var(--color-text-primary);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }

  .action {
    height: var(--size-row-lg);
    padding: 0 var(--space-3);
    border: var(--border-width) solid var(--color-border-subtle);
    border-radius: var(--radius-sm);
    background: var(--color-surface-raised);
    font-size: var(--text-control);
    color: var(--color-text-primary);
  }

  .action:focus-visible {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
    outline-offset: var(--focus-halo-width);
  }

  .action.primary {
    border-color: var(--color-accent);
    background: var(--color-accent);
    color: var(--color-accent-contrast);
  }

  .action:disabled {
    opacity: var(--opacity-disabled);
  }
</style>
