<script lang="ts">
  /**
   * Export settings, with a live preview of what will be written.
   *
   * Presentational: it shows the settings and the preview it is handed, and
   * reports what the user asked for. Drawing the preview, encoding a picture
   * and writing a file all belong to the caller.
   */
  import Dialog from './Dialog.svelte';
  import Segments from './Segments.svelte';
  import Toggle from './Toggle.svelte';
  import { t } from '../i18n/t';

  export type ExportFormat = 'png' | 'svg';
  export type ExportSettings = {
    onlySelected: boolean;
    background: boolean;
    dark: boolean;
    scale: number;
  };

  type Props = {
    open: boolean;
    /** Whether anything is selected, which is what Only selected needs. */
    hasSelection: boolean;
    settings: ExportSettings;
    /** The SVG to show as the preview, drawn by the caller. */
    preview: string;
    onSettings: (change: Partial<ExportSettings>) => void;
    onExport: (format: ExportFormat) => void;
    onCopy: () => void;
  };

  let { open = $bindable(), hasSelection, settings, preview, onSettings, onExport, onCopy }: Props = $props();

  /** The scales the spec offers. PNG only: an SVG has no pixels to multiply. */
  const SCALES = ['1', '2', '3'];
</script>

<Dialog bind:open title={t('export.title')}>
  <div class="preview-frame">
    <!-- The caller draws this with the same writer that exports the file, so
         the preview is the export rather than an impression of it. -->
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    <div class="bava-export-preview">{@html preview}</div>
  </div>

  <div class="settings">
    <Toggle
      label={t('export.onlySelected')}
      checked={settings.onlySelected && hasSelection}
      disabled={!hasSelection}
      onChange={(onlySelected) => onSettings({ onlySelected })}
    />
    <Toggle
      label={t('export.background')}
      checked={settings.background}
      onChange={(background) => onSettings({ background })}
    />
    <Toggle label={t('export.dark')} checked={settings.dark} onChange={(dark) => onSettings({ dark })} />
    <div class="scale">
      <span class="scale-label">{t('export.scalePng')}</span>
      <Segments
        label={t('export.scale')}
        value={String(settings.scale)}
        options={SCALES.map((value) => ({ value, label: `${value}×` }))}
        onValueChange={(value) => onSettings({ scale: Number(value) })}
      />
    </div>
  </div>

  <div class="actions">
    <button type="button" class="action" onclick={() => onCopy()}>{t('export.copy')}</button>
    <button type="button" class="action" onclick={() => onExport('svg')}>{t('export.svg')}</button>
    <button type="button" class="action primary" onclick={() => onExport('png')}>{t('export.png')}</button>
  </div>
</Dialog>

<style>
  .preview-frame {
    display: flex;
    align-items: center;
    justify-content: center;
    height: var(--size-export-preview);
    margin-bottom: var(--space-4);
    padding: var(--space-2);
    border: var(--border-width) solid var(--color-border-subtle);
    border-radius: var(--radius-md);
    background: var(--color-surface-sunken);
    overflow: hidden;
  }

  .bava-export-preview {
    display: flex;
    max-width: 100%;
    max-height: 100%;
  }

  .bava-export-preview :global(svg) {
    max-width: 100%;
    max-height: 100%;
  }

  .settings {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    margin-bottom: var(--space-5);
  }

  .scale {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .scale-label {
    font-size: var(--text-control);
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
</style>
