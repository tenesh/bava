<script lang="ts">
  /**
   * Export the Space, or one of its folders: What (the whole Space or a
   * folder), and what the Markdown zip will hold beside it.
   *
   * Presentational: it shows the plan it is given and reports the folder
   * chosen ('' for the whole Space) and Export.
   */
  import Dialog from './Dialog.svelte';
  import Select from './Select.svelte';
  import ZipContents from './ZipContents.svelte';
  import { t } from '../i18n/t';
  import { zipSummary } from '../files/zip-preview';
  import type { ZipFile } from '../files/space.svelte';

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
    /** Closed, by Cancel, Escape or the close button. */
    onClose?: () => void;
  };

  let { open = $bindable(), spaceName, folders, target, plan, onTarget, onExport, onClose = () => {} }: Props = $props();

  function close() {
    open = false;
    onClose();
  }

  const ready = $derived(plan !== null && !plan.error);
  const options = $derived([{ value: '', label: t('export.wholeSpace') }, ...folders.map((folder) => ({ value: folder, label: folder }))]);
</script>

{#snippet footer()}
  <span class="summary">{ready && plan ? zipSummary(plan.files) : ''}</span>
  <button type="button" class="bava-button" onclick={close}>{t('file.cancel')}</button>
  <button type="button" class="bava-button primary" disabled={!ready} onclick={() => onExport()}>{t('export.zip')}</button>
{/snippet}

<Dialog bind:open title={t('export.space.title')} subtitle={spaceName} size="export" {footer} onOpenChange={(next) => !next && onClose()}>
  <div class="bava-zip-export">
    <ZipContents {plan} />
    <div class="settings">
      <div class="row">
        <span class="row-label">{t('export.what')}</span>
        <Select label={t('export.what')} value={target} {options} onValueChange={onTarget} />
      </div>
      <p class="hint">{t('export.zipNote')}</p>
    </div>
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

  .summary {
    margin-inline-end: auto;
    font-family: var(--font-data);
    font-size: var(--text-mono-status);
    color: var(--color-text-muted);
  }
</style>
