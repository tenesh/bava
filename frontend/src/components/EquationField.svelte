<script lang="ts">
  /**
   * The field over an equation: its TeX, with the equation drawn live below.
   * Enter saves, Shift+Enter starts a new line in a block equation, Escape
   * leaves it as it was.
   *
   * Presentational: the caller draws the TeX (`render`) and applies what is
   * saved.
   */
  import { Portal } from '@ark-ui/svelte';
  import { portalRoot } from './portal-root';
  import { t } from '../i18n/t';

  type Props = {
    /** The equation on screen; the field opens under it. */
    at: { left: number; top: number; bottom: number };
    value: string;
    /** A block equation, drawn on a line of its own. */
    display: boolean;
    render: (tex: string, into: HTMLElement, display: boolean) => void;
    onSave: (tex: string) => void;
    onCancel: () => void;
  };

  let { at, value, display, render, onSave, onCancel }: Props = $props();

  // Seeded once from the equation; the field then owns it.
  // svelte-ignore state_referenced_locally
  let tex = $state(value);
  let field: HTMLTextAreaElement | undefined = $state();
  let preview: HTMLDivElement | undefined = $state();

  $effect(() => {
    if (!field) return;
    field.focus();
    field.select();
  });

  $effect(() => {
    if (preview) render(tex, preview, display);
  });

  function keydown(event: KeyboardEvent) {
    // An equation in a line is one line: Shift+Enter saves it too.
    if (event.key === 'Enter' && (!event.shiftKey || !display)) {
      event.preventDefault();
      onSave(tex);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
    }
  }
</script>

<Portal container={portalRoot()}>
  <div class="equation-field" style:left={`${at.left}px`} style:top={`calc(${at.bottom}px + var(--space-2))`}>
    <textarea
      bind:this={field}
      bind:value={tex}
      class="bava-field source"
      rows={display ? 3 : 1}
      spellcheck="false"
      placeholder={t('equation.placeholder')}
      aria-label={t('equation.label')}
      onkeydown={keydown}
    ></textarea>
    <div bind:this={preview} class="equation-preview" aria-hidden="true"></div>
    <p class="hint">{t(display ? 'equation.hint' : 'equation.hintInline')}</p>
  </div>
</Portal>

<style>
  .equation-field {
    position: fixed;
    z-index: var(--z-portal);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    width: var(--size-equation-field);
    padding: var(--space-2);
    background: var(--color-surface-overlay);
    border: var(--border-width) solid var(--color-border-subtle);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-floating);
  }

  .source {
    width: 100%;
    height: auto;
    padding: var(--space-1) var(--size-field-padding);
    font-family: var(--font-mono);
    resize: vertical;
  }

  .equation-preview {
    min-height: var(--size-row-lg);
    overflow-x: auto;
    color: var(--color-text-primary);
  }

  .hint {
    margin: 0;
    font-size: var(--text-meta);
    color: var(--color-text-muted);
  }
</style>
