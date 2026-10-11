<script lang="ts">
  /**
   * A PDF's settings, as both export dialogs offer them: Paper (and Custom's
   * size), Orientation, Margins (and Custom's four sides), the unit Custom
   * is written in, Theme and Page numbers.
   *
   * Presentational: it changes the settings it is bound to.
   */
  import NumberField from './NumberField.svelte';
  import Segments from './Segments.svelte';
  import Select from './Select.svelte';
  import Toggle from './Toggle.svelte';
  import { t } from '../i18n/t';
  import { PAPERS, UNIT_STEP, inUnit, type MarginName, type PdfSettings, type Unit } from '../files/export-pdf';

  type Props = { settings: PdfSettings };

  let { settings = $bindable() }: Props = $props();

  /** A unit chosen: Custom's sizes and margins are kept, written in it. */
  function setUnit(next: Unit) {
    const choices = settings.choices;
    if (next === choices.unit) return;
    const convert = (n: number) => Math.round(inUnit(n, choices.unit, next) * 100) / 100;
    choices.custom = { width: convert(choices.custom.width), height: convert(choices.custom.height) };
    const m = choices.customMargins;
    choices.customMargins = { top: convert(m.top), right: convert(m.right), bottom: convert(m.bottom), left: convert(m.left) };
    choices.unit = next;
  }

  const paperOptions = PAPERS.map((paper) => ({ value: paper, label: paper === 'Custom' ? t('export.pdf.custom') : paper }));
  const marginOptions = (['none', 'narrow', 'normal', 'wide', 'custom'] as MarginName[]).map((name) => ({ value: name, label: t(`export.pdf.margins.${name}`) }));
  const sides = ['top', 'right', 'bottom', 'left'] as const;
</script>

<div class="row">
  <span class="row-label">{t('export.pdf.paper')}</span>
  <Select label={t('export.pdf.paper')} value={settings.choices.paper} options={paperOptions} onValueChange={(next) => (settings.choices.paper = next)} />
</div>
{#if settings.choices.paper === 'Custom'}
  <div class="pair">
    <div class="field">
      <span class="caption" aria-hidden="true">{t('export.pdf.width')}</span>
      <NumberField label={t('export.pdf.width')} value={settings.choices.custom.width} onValueChange={(n) => (settings.choices.custom.width = n)} />
    </div>
    <div class="field">
      <span class="caption" aria-hidden="true">{t('export.pdf.height')}</span>
      <NumberField label={t('export.pdf.height')} value={settings.choices.custom.height} onValueChange={(n) => (settings.choices.custom.height = n)} />
    </div>
  </div>
{/if}
<div class="row">
  <span class="row-label">{t('export.pdf.orientation')}</span>
  <Segments
    label={t('export.pdf.orientation')}
    value={settings.choices.landscape ? 'landscape' : 'portrait'}
    options={[{ value: 'portrait', label: t('export.pdf.portrait') }, { value: 'landscape', label: t('export.pdf.landscape') }]}
    onValueChange={(next) => (settings.choices.landscape = next === 'landscape')}
  />
</div>
<div class="row">
  <span class="row-label">{t('export.pdf.margins')}</span>
  <Select label={t('export.pdf.margins')} value={settings.choices.margins} options={marginOptions} onValueChange={(next) => (settings.choices.margins = next)} />
</div>
{#if settings.choices.margins === 'custom'}
  <div class="pair">
    {#each sides as side (side)}
      <div class="field">
        <span class="caption" aria-hidden="true">{t(`export.pdf.${side}`)}</span>
        <NumberField label={t(`export.pdf.${side}`)} value={settings.choices.customMargins[side]} step={UNIT_STEP[settings.choices.unit]} onValueChange={(n) => (settings.choices.customMargins[side] = n)} />
      </div>
    {/each}
  </div>
{/if}
{#if settings.choices.paper === 'Custom' || settings.choices.margins === 'custom'}
  <div class="row">
    <span class="row-label">{t('export.pdf.unit')}</span>
    <Segments label={t('export.pdf.unit')} value={settings.choices.unit} options={(['mm', 'in'] as Unit[]).map((unit) => ({ value: unit, label: t(`export.pdf.${unit}`) }))} onValueChange={setUnit} />
  </div>
{/if}
<div class="row">
  <span class="row-label">{t('export.pdf.theme')}</span>
  <Segments
    label={t('export.pdf.theme')}
    value={settings.dark ? 'dark' : 'light'}
    options={[{ value: 'light', label: t('export.pdf.light') }, { value: 'dark', label: t('export.pdf.dark') }]}
    onValueChange={(next) => (settings.dark = next === 'dark')}
  />
</div>
<Toggle label={t('export.pdf.numbers')} checked={settings.numbers} variant="row" onChange={(next) => (settings.numbers = next)} />

<style>
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
</style>
