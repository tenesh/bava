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
  import NumberField from './NumberField.svelte';
  import PdfPreview from './PdfPreview.svelte';
  import Progress from './Progress.svelte';
  import Segments from './Segments.svelte';
  import Select from './Select.svelte';
  import Toggle from './Toggle.svelte';
  import ZipContents from './ZipContents.svelte';
  import { t } from '../i18n/t';
  import { zipSummary } from '../files/zip-preview';
  import { A4_MM, MARGINS, PAPERS, UNIT_STEP, inUnit, pageSetup, type Include, type MarginName, type PageSetup, type Paper, type PdfChoices, type Unit } from '../files/export-pdf';
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
  let choices = $state<PdfChoices>({
    paper,
    custom: { width: A4_MM.width, height: A4_MM.height },
    unit: 'mm',
    landscape: false,
    margins: 'normal',
    customMargins: { top: MARGINS.normal, right: MARGINS.normal, bottom: MARGINS.normal, left: MARGINS.normal },
    ...initial,
  });

  /** A unit chosen: Custom's sizes and margins are kept, written in it. */
  function setUnit(next: Unit) {
    if (next === choices.unit) return;
    const convert = (n: number) => Math.round(inUnit(n, choices.unit, next) * 100) / 100;
    choices.custom = { width: convert(choices.custom.width), height: convert(choices.custom.height) };
    const m = choices.customMargins;
    choices.customMargins = { top: convert(m.top), right: convert(m.right), bottom: convert(m.bottom), left: convert(m.left) };
    choices.unit = next;
  }
  // Set from the page once it is drawn, unless chosen before.
  let chosenInclude = $state<Include | null>(null);
  const include = $derived(chosenInclude ?? pdf?.include ?? 'document');
  let dark = $state(false);
  let numbers = $state(false);

  const made = $derived(pageSetup(choices));
  const zipReady = $derived(plan !== null && !plan.error);

  function close() {
    open = false;
    onClose();
  }

  const paperOptions = PAPERS.map((paper) => ({ value: paper, label: paper === 'Custom' ? t('export.pdf.custom') : paper }));
  const marginOptions = (['none', 'narrow', 'normal', 'wide', 'custom'] as MarginName[]).map((name) => ({ value: name, label: t(`export.pdf.margins.${name}`) }));
  const sides = ['top', 'right', 'bottom', 'left'] as const;
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
    <button type="button" class="bava-button primary" disabled={made.problem !== '' || !pdf} onclick={() => onExportPdf({ setup: made.setup, include, dark, numbers })}>{t('export.pdf')}</button>
  {/if}
{/snippet}

<Dialog bind:open title={t('export.page.title')} subtitle={pageName} size="export" {footer} onOpenChange={(next) => !next && onClose()}>
  <div class="bava-page-export">
    {#if format === 'pdf'}
      {#if pdf}
        <PdfPreview page={pdf.page} canvas={pdf.canvas} {include} setup={made.setup} {dark} />
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
        <div class="row">
          <span class="row-label">{t('export.pdf.paper')}</span>
          <Select label={t('export.pdf.paper')} value={choices.paper} options={paperOptions} onValueChange={(next) => (choices.paper = next)} />
        </div>
        {#if choices.paper === 'Custom'}
          <div class="pair">
            <div class="field">
              <span class="caption" aria-hidden="true">{t('export.pdf.width')}</span>
              <NumberField label={t('export.pdf.width')} value={choices.custom.width} onValueChange={(n) => (choices.custom.width = n)} />
            </div>
            <div class="field">
              <span class="caption" aria-hidden="true">{t('export.pdf.height')}</span>
              <NumberField label={t('export.pdf.height')} value={choices.custom.height} onValueChange={(n) => (choices.custom.height = n)} />
            </div>
          </div>
        {/if}
        <div class="row">
          <span class="row-label">{t('export.pdf.orientation')}</span>
          <Segments
            label={t('export.pdf.orientation')}
            value={choices.landscape ? 'landscape' : 'portrait'}
            options={[{ value: 'portrait', label: t('export.pdf.portrait') }, { value: 'landscape', label: t('export.pdf.landscape') }]}
            onValueChange={(next) => (choices.landscape = next === 'landscape')}
          />
        </div>
        <div class="row">
          <span class="row-label">{t('export.pdf.margins')}</span>
          <Select label={t('export.pdf.margins')} value={choices.margins} options={marginOptions} onValueChange={(next) => (choices.margins = next)} />
        </div>
        {#if choices.margins === 'custom'}
          <div class="pair">
            {#each sides as side (side)}
              <div class="field">
                <span class="caption" aria-hidden="true">{t(`export.pdf.${side}`)}</span>
                <NumberField label={t(`export.pdf.${side}`)} value={choices.customMargins[side]} step={UNIT_STEP[choices.unit]} onValueChange={(n) => (choices.customMargins[side] = n)} />
              </div>
            {/each}
          </div>
        {/if}
        {#if choices.paper === 'Custom' || choices.margins === 'custom'}
          <div class="row">
            <span class="row-label">{t('export.pdf.unit')}</span>
            <Segments
              label={t('export.pdf.unit')}
              value={choices.unit}
              options={(['mm', 'in'] as Unit[]).map((unit) => ({ value: unit, label: t(`export.pdf.${unit}`) }))}
              onValueChange={setUnit}
            />
          </div>
        {/if}
        <div class="row">
          <span class="row-label">{t('export.pdf.theme')}</span>
          <Segments
            label={t('export.pdf.theme')}
            value={dark ? 'dark' : 'light'}
            options={[{ value: 'light', label: t('export.pdf.light') }, { value: 'dark', label: t('export.pdf.dark') }]}
            onValueChange={(next) => (dark = next === 'dark')}
          />
        </div>
        <Toggle label={t('export.pdf.numbers')} checked={numbers} variant="row" onChange={(next) => (numbers = next)} />
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

  .pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-2);
  }

  .drawing {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: var(--size-export-preview);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    min-width: 0;
  }

  .caption {
    font-size: var(--text-note);
    color: var(--color-text-muted);
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
