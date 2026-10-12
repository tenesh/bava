<script lang="ts">
  /**
   * Export the Space, or one of its folders: What (the whole Space or a
   * folder), then as one PDF (its settings beside the first page's first
   * sheet) or as a Markdown zip (beside what it will hold).
   *
   * Presentational: it shows the plan and the page it is given, how far the
   * drawing has gone, and reports the folder chosen ('' for the whole
   * Space) and the export asked for.
   */
  import Dialog from './Dialog.svelte';
  import PdfOptions from './PdfOptions.svelte';
  import PdfPreview from './PdfPreview.svelte';
  import Progress from './Progress.svelte';
  import Segments from './Segments.svelte';
  import Select from './Select.svelte';
  import ZipContents from './ZipContents.svelte';
  import { t } from '../i18n/t';
  import { zipSummary } from '../files/zip-preview';
  import { pageSetup, startingSettings, type PageSetup, type Paper, type PdfSettings } from '../files/export-pdf';
  import type { ZipFile } from '../files/space.svelte';

  type Format = 'pdf' | 'zip';
  export type SpacePdfExport = { setup: PageSetup; dark: boolean; numbers: boolean };

  type Props = {
    open: boolean;
    spaceName: string;
    /** The Space's folders, by path, to choose from. */
    folders: string[];
    /** The folder exported, or '' for the whole Space. */
    target: string;
    plan: { files: ZipFile[]; error: string } | null;
    onTarget: (folder: string) => void;
    onExport: () => void;
    /** The formats offered, the first chosen to start. Zip alone by default. */
    formats?: Format[];
    /** The paper first offered: the region's. */
    paper?: Paper;
    /** The first page drawn for printing, for the preview; null while it is drawn or when there is none. */
    pdf?: { page: { html: string; css: string; widthPx: number } | null; canvas: null } | null;
    /** How far the pages are drawn for the PDF, or null before Export. */
    drawing?: { done: number; total: number } | null;
    /** How far the zip is written, or null before Export zip. */
    writing?: { done: number; total: number } | null;
    /** The pages being printed into the PDF, once drawn; null before. */
    printing?: number | null;
    /** Cancel while the zip is written or the PDF printed: stops it, leaving no file. */
    onCancel?: () => void;
    onExportPdf?: (pdf: SpacePdfExport) => void;
    /** Closed, by Cancel, Escape or the close button. */
    onClose?: () => void;
  };

  let {
    open = $bindable(),
    spaceName,
    folders,
    target,
    plan,
    onTarget,
    onExport,
    formats = ['zip'],
    paper = 'A4',
    pdf = null,
    drawing = null,
    writing = null,
    printing = null,
    onCancel = () => {},
    onExportPdf = () => {},
    onClose = () => {},
  }: Props = $props();

  // The choices are kept while the dialog is open; a new export starts afresh.
  // svelte-ignore state_referenced_locally
  let format = $state<Format>(formats[0] ?? 'zip');
  // svelte-ignore state_referenced_locally
  let settings = $state<PdfSettings>(startingSettings(paper));
  const made = $derived(pageSetup(settings.choices));
  const drawingSaid = $derived(drawing ? t('export.pdf.drawingPages').replace('{done}', String(drawing.done)).replace('{total}', String(drawing.total)) : '');

  const busy = $derived(writing !== null || printing !== null);
  const writingSaid = $derived(writing ? t('export.zip.writing').replace('{done}', String(writing.done)).replace('{total}', String(writing.total)) : '');
  const printingSaid = $derived(printing !== null ? t('export.pdf.printingPages').replace('{n}', String(printing)) : '');

  function close() {
    // Cancel while a file is made stops it; the caller closes when it has.
    if (busy) {
      onCancel();
      return;
    }
    open = false;
    onClose();
  }

  const ready = $derived(plan !== null && !plan.error);
  const options = $derived([{ value: '', label: t('export.wholeSpace') }, ...folders.map((folder) => ({ value: folder, label: folder }))]);
</script>

{#snippet footer()}
  {#if format === 'zip' && writing}
    <span class="summary progress">
      <Progress value={writing.total ? (writing.done / writing.total) * 100 : null} label={writingSaid} />
      {writingSaid}
    </span>
  {:else if format === 'pdf' && printing !== null}
    <span class="summary progress">
      <Progress value={null} label={printingSaid} />
      {printingSaid}
    </span>
  {:else if format === 'zip'}
    <span class="summary">{ready && plan ? zipSummary(plan.files) : ''}</span>
  {:else if drawing}
    <span class="summary progress">
      <Progress value={drawing.total ? (drawing.done / drawing.total) * 100 : null} label={drawingSaid} />
      {drawingSaid}
    </span>
  {:else}
    <span class="summary problem">{made.problem === '' ? '' : t(made.problem)}</span>
  {/if}
  <button type="button" class="bava-button" onclick={close}>{t('file.cancel')}</button>
  {#if format === 'zip'}
    <button type="button" class="bava-button primary" disabled={!ready || busy} onclick={() => onExport()}>{t('export.zip')}</button>
  {:else}
    <button
      type="button"
      class="bava-button primary"
      disabled={made.problem !== '' || drawing !== null || busy}
      onclick={() => onExportPdf({ setup: made.setup, dark: settings.dark, numbers: settings.numbers })}>{t('export.pdf')}</button
    >
  {/if}
{/snippet}

<Dialog
  bind:open
  title={t('export.space.title')}
  subtitle={spaceName}
  size="export"
  {footer}
  dismissible={!busy}
  onEscape={() => {
    if (busy) onCancel();
  }}
  onOpenChange={(next) => {
    if (!next) onClose();
  }}
>
  <div class="bava-zip-export">
    {#if format === 'pdf'}
      {#if pdf}
        <PdfPreview page={pdf.page} canvas={null} include="document" setup={made.setup} dark={settings.dark} />
      {:else}
        <div class="waiting"><Progress value={null} label={t('export.pdf.drawing')} /></div>
      {/if}
    {:else}
      <ZipContents {plan} />
    {/if}
    <!-- Nothing it writes changes while it writes: every control inside is off. -->
    <fieldset class="settings" disabled={busy}>
      {#if formats.length > 1}
        <Segments label={t('export.format')} value={format} options={formats.map((f) => ({ value: f, label: t(`export.format.${f}`) }))} onValueChange={(next) => (format = next)} />
      {/if}
      <div class="row">
        <span class="row-label">{t('export.what')}</span>
        <Select label={t('export.what')} value={target} {options} onValueChange={onTarget} />
      </div>
      {#if format === 'pdf'}
        <PdfOptions bind:settings />
      {:else}
        <p class="hint">{t('export.zipNote')}</p>
      {/if}
    </fieldset>
  </div>
</Dialog>

<style>
  .bava-zip-export {
    display: grid;
    grid-template-columns: minmax(0, 1fr) var(--size-export-settings);
    gap: var(--space-5);
  }

  .settings {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .row-label {
    font-size: var(--text-control);
    color: var(--color-text-secondary);
  }

  .waiting {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: var(--size-export-preview);
  }

  .summary.progress :global(.bava-progress) {
    flex: none;
  }

  .summary.progress {
    --progress-width: var(--size-progress-inline);
    display: flex;
    align-items: center;
    gap: var(--space-2);
    white-space: nowrap;
  }

  .summary.problem {
    font-family: inherit;
    font-size: var(--text-note);
  }

  .hint {
    margin: 0;
    font-size: var(--text-note);
    color: var(--color-text-muted);
  }

  .summary {
    margin-inline-end: auto;
    font-family: var(--font-data);
    font-size: var(--text-mono-status);
    color: var(--color-text-muted);
  }
</style>
