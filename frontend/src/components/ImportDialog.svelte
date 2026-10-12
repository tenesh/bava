<script lang="ts">
  /**
   * Import pages, a folder or a Bava zip into the Space: what comes in, as it
   * will land, beside the folder it goes into and what was renamed to keep
   * both; then, while importing, how far it has got.
   *
   * Presentational: it shows the plan and progress it is given, and reports
   * the folder chosen ('' for the top of the Space), Import, and Cancel
   * while importing.
   */
  import Dialog from './Dialog.svelte';
  import Progress from './Progress.svelte';
  import Select from './Select.svelte';
  import ZipContents from './ZipContents.svelte';
  import { t } from '../i18n/t';
  import { importPreview, importSummary } from '../files/import-preview';
  import type { ImportPlan } from '../files/space.svelte';

  type Props = {
    open: boolean;
    /** What was picked, as its subtitle says it: a folder's or file's name, or "3 files". */
    source: string;
    /** The Space's folders, by path, to choose from. */
    folders: string[];
    /** The folder imported into, or '' for the top of the Space. */
    into: string;
    /** The plan for the folder chosen; null while it is read. */
    plan: { plan: ImportPlan | null; error: string } | null;
    /** How far the import has got, or null before Import. */
    progress?: { done: number; total: number } | null;
    onInto: (folder: string) => void;
    onImport: () => void;
    /** Cancel while importing: stops it, and what it added goes again. */
    onCancel?: () => void;
    /** Closed, by Cancel, Escape or the close button, before importing. */
    onClose?: () => void;
  };

  let { open = $bindable(), source, folders, into, plan, progress = null, onInto, onImport, onCancel = () => {}, onClose = () => {} }: Props = $props();

  const ready = $derived(plan !== null && plan.plan !== null && !plan.error);
  const contents = $derived(plan === null ? null : { files: plan.plan ? importPreview(plan.plan) : [], error: plan.error });
  // Everything is in and its links are being written: nothing is left to stop.
  const settled = $derived(progress !== null && progress.total > 0 && progress.done >= progress.total);
  const said = $derived(progress ? t('import.importing').replace('{done}', String(progress.done)).replace('{total}', String(progress.total)) : '');
  const options = $derived([{ value: '', label: t('import.top') }, ...folders.map((folder) => ({ value: folder, label: folder }))]);

  function cancel() {
    if (progress) {
      onCancel();
      return;
    }
    open = false;
    onClose();
  }
</script>

{#snippet footer()}
  {#if progress}
    <span class="summary progress">
      <Progress value={progress.total ? (progress.done / progress.total) * 100 : null} label={said} />
      {said}
    </span>
  {:else}
    <span class="summary">{ready && plan?.plan ? importSummary(plan.plan) : ''}</span>
  {/if}
  <button type="button" class="bava-button" disabled={settled} onclick={cancel}>{t('file.cancel')}</button>
  <button type="button" class="bava-button primary" disabled={!ready || progress !== null} onclick={() => onImport()}>{t('import.import')}</button>
{/snippet}

<Dialog
  bind:open
  title={t('import.title')}
  subtitle={t('import.from').replace('{name}', source)}
  size="export"
  {footer}
  dismissible={progress === null}
  onEscape={() => {
    if (progress !== null) onCancel();
  }}
  onOpenChange={(next) => {
    if (!next) onClose();
  }}
>
  <div class="bava-import">
    <ZipContents plan={contents} />
    <div class="settings">
      <div class="row">
        <span class="row-label">{t('import.into')}</span>
        <!-- Not while the plan is read: a plan landing on an open list loses the pick. -->
        <Select label={t('import.into')} value={into} {options} onValueChange={onInto} disabled={plan === null || progress !== null} />
      </div>
      <p class="hint">{t('import.note')}</p>
      {#if plan?.plan && plan.plan.renames.length > 0}
        <section class="renamed" aria-label={t('import.renamed')}>
          <span class="label">{t('import.renamed')}</span>
          {#each plan.plan.renames as rename, index (index)}
            <div class="rename"><span>{rename.from}</span><span class="arrow" aria-hidden="true">→</span><span class="to">{rename.to}</span></div>
          {/each}
        </section>
      {/if}
    </div>
  </div>
</Dialog>

<style>
  .bava-import {
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

  .hint {
    margin: 0;
    font-size: var(--text-note);
    color: var(--color-text-muted);
  }

  .renamed {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .label {
    font-family: var(--font-label);
    font-size: var(--text-label);
    letter-spacing: var(--tracking-label);
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .rename {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-width: 0;
    font-size: var(--text-body);
    color: var(--color-text-secondary);
  }

  .arrow {
    color: var(--color-text-faint);
  }

  .to {
    color: var(--color-text-primary);
  }

  .summary {
    margin-inline-end: auto;
    font-family: var(--font-data);
    font-size: var(--text-mono-status);
    color: var(--color-text-muted);
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
</style>
