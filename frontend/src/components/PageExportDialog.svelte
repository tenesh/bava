<script lang="ts">
  /**
   * Export a page: as a PDF (the Document, the Canvas or both, at a paper,
   * orientation and margins, light or dark, with page numbers if asked) with
   * its first sheet previewed, or as a Markdown zip beside what it will hold.
   *
   * Presentational: it shows the page and the plan it is given, keeps the
   * choices while open, and reports the export asked for.
   */
  import Dialog from './Dialog.svelte';
  import PdfOptions from './PdfOptions.svelte';
  import PdfPreview from './PdfPreview.svelte';
  import Progress from './Progress.svelte';
  import Segments from './Segments.svelte';
  import ZipContents from './ZipContents.svelte';
  import { t } from '../i18n/t';
  import { zipSummary } from '../files/zip-preview';
  import { pageSetup, startingSettings, type Include, type PageSetup, type Paper, type PdfChoices, type PdfSettings } from '../files/export-pdf';
  import type { ZipFile } from '../files/space.svelte';

  type Format = 'pdf' | 'zip';
  export type PdfExport = { setup: PageSetup; include: Include; dark: boolean; numbers: boolean };

  type Props = {
    open: boolean;
    pageName: string;
    /** What the zip will hold, or null while it is read. */
    plan: { files: ZipFile[]; error: string } | null;
    onExport: () => void;
    /** The paper first offered: the region's. */
    paper?: Paper;
    /** The page for a PDF: what may be included, the page drawn for printing and its Canvas; null while it is drawn. */
    pdf?: {
      offered: Include[];
      include: Include;
      page: { html: string; css: string; widthPx: number } | null;
      canvas: { svg: string; width: number; height: number } | null;
    } | null;
    /** The formats offered, the first chosen to start: a page outside a Space has no zip. Zip alone by default. */
    formats?: Format[];
    /** Choices to start from, over the defaults. */
    initial?: Partial<PdfChoices>;
    onExportPdf?: (pdf: PdfExport) => void;
    /** Closed, by Cancel, Escape or the close button. */
    onClose?: () => void;
  };

  let { open = $bindable(), pageName, plan, onExport, paper = 'A4', pdf = null, formats = ['zip'], initial = {}, onExportPdf = () => {}, onClose = () => {} }: Props = $props();

  // The choices are kept while the dialog is open; a new export starts afresh.
  // svelte-ignore state_referenced_locally
  let format = $state<Format>(formats[0] ?? 'zip');
  // svelte-ignore state_referenced_locally
  let settings = $state<PdfSettings>(startingSettings(paper, initial));

  // Set from the page once it is drawn, unless chosen before.
  let chosenInclude = $state<Include | null>(null);
  const include = $derived(chosenInclude ?? pdf?.include ?? 'document');
  const made = $derived(pageSetup(settings.choices));
  const zipReady = $derived(plan !== null && !plan.error);

  function close() {
    open = false;
    onClose();
  }

</script>

{#snippet footer()}
  {#if format === 'zip'}
    <span class="summary">{zipReady && plan ? zipSummary(plan.files) : ''}</span>
  {:else}
    <span class="summary problem">{made.problem === '' ? '' : t(made.problem)}</span>
  {/if}
  <button type="button" class="bava-button" onclick={close}>{t('file.cancel')}</button>
  {#if format === 'zip'}
    <button type="button" class="bava-button primary" disabled={!zipReady} onclick={() => onExport()}>{t('export.zip')}</button>
  {:else}
    <button type="button" class="bava-button primary" disabled={made.problem !== '' || !pdf} onclick={() => onExportPdf({ setup: made.setup, include, dark: settings.dark, numbers: settings.numbers })}>{t('export.pdf')}</button>
  {/if}
{/snippet}

<Dialog bind:open title={t('export.page.title')} subtitle={pageName} size="export" {footer} onOpenChange={(next) => !next && onClose()}>
  <div class="bava-page-export">
    {#if format === 'pdf'}
      {#if pdf}
        <PdfPreview page={pdf.page} canvas={pdf.canvas} {include} setup={made.setup} dark={settings.dark} />
      {:else}
        <div class="drawing"><Progress value={null} label={t('export.pdf.drawing')} /></div>
      {/if}
    {:else}
      <ZipContents {plan} />
    {/if}
    <div class="settings">
      {#if formats.length > 1}
        <Segments label={t('export.format')} value={format} options={formats.map((f) => ({ value: f, label: t(`export.format.${f}`) }))} onValueChange={(next) => (format = next)} />
      {/if}
      {#if format === 'pdf'}
        {#if pdf && pdf.offered.length > 1}
          <div class="row">
            <span class="row-label">{t('export.pdf.include')}</span>
            <Segments label={t('export.pdf.include')} value={include} options={pdf.offered.map((part) => ({ value: part, label: t(`export.pdf.${part}`) }))} onValueChange={(next) => (chosenInclude = next)} />
          </div>
        {/if}
        <PdfOptions bind:settings />
      {:else}
        <p class="hint">{t('export.zipNote')}</p>
      {/if}
    </div>
  </div>
</Dialog>

<style>
  .bava-page-export {
    display: grid;
    grid-template-columns: minmax(0, 1fr) var(--size-export-settings);
    gap: var(--space-5);
  }

  .settings {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
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

  .drawing {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: var(--size-export-preview);
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

  .summary.problem {
    font-family: inherit;
    font-size: var(--text-note);
  }
</style>
