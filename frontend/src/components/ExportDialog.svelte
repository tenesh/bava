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
  import { withoutRemoteRefs } from '../canvas/import/safe-svg';

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

  /** The scales offered. PNG only: an SVG has no pixels to multiply. */
  const SCALES = ['1', '2', '3'];
</script>

{#snippet footer()}
  <button type="button" class="bava-button" onclick={() => onCopy()}>{t('export.copy')}</button>
  <button type="button" class="bava-button" onclick={() => onExport('svg')}>{t('export.svg')}</button>
  <button type="button" class="bava-button primary" onclick={() => onExport('png')}>{t('export.png')}</button>
{/snippet}

<Dialog bind:open title={t('export.title')} subtitle={t('export.subtitle')} size="export" {footer}>
  <div class="bava-export">
    <div class="preview-frame">
      <!-- The caller draws this with the same writer that exports the file, so
           the preview is the export rather than an impression of it. Remote
           references are taken out: a preview makes no network call. -->
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      <div class="bava-export-preview">{@html withoutRemoteRefs(preview)}</div>
    </div>

    <div class="settings">
      <Toggle
        variant="row"
        label={t('export.onlySelected')}
        checked={settings.onlySelected && hasSelection}
        disabled={!hasSelection}
        onChange={(onlySelected) => onSettings({ onlySelected })}
      />
      <Toggle
        variant="row"
        label={t('export.background')}
        checked={settings.background}
        onChange={(background) => onSettings({ background })}
      />
      <Toggle variant="row" label={t('export.dark')} checked={settings.dark} onChange={(dark) => onSettings({ dark })} />
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
  </div>
</Dialog>

<style>
  .bava-export {
    display: flex;
    gap: var(--space-5);
  }

  .preview-frame {
    display: flex;
    flex: 1 1 0;
    align-items: center;
    justify-content: center;
    min-width: 0;
    height: var(--size-export-preview);
    padding: var(--space-2);
    box-sizing: border-box;
    border: var(--border-width) solid var(--color-border-subtle);
    border-radius: var(--radius-lg);
    /* A checkerboard, so a transparent background reads as one. */
    background: repeating-conic-gradient(var(--color-surface-sunken) 0 25%, var(--color-surface-raised) 0 50%) 0 0 /
      var(--size-export-checker) var(--size-export-checker);
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
    flex: none;
    flex-direction: column;
    gap: var(--space-1);
    width: var(--size-export-settings);
  }

  .scale {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    min-height: var(--size-row-xl);
  }

  .scale-label {
    font-size: var(--text-control);
    color: var(--color-text-secondary);
  }
</style>
