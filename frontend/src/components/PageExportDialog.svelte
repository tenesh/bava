<script lang="ts">
  /**
   * Export a page: what its Markdown zip will hold beside the export.
   *
   * Presentational: it shows the plan it is given and reports Export.
   */
  import Dialog from './Dialog.svelte';
  import ZipContents from './ZipContents.svelte';
  import { t } from '../i18n/t';
  import { zipSummary } from '../files/zip-preview';
  import type { ZipFile } from '../files/space.svelte';

  type Props = {
    open: boolean;
    pageName: string;
    /** What the zip will hold, or null while it is read. */
    plan: { files: ZipFile[]; error: string } | null;
    onExport: () => void;
    /** Closed, by Cancel, Escape or the close button. */
    onClose?: () => void;
  };

  let { open = $bindable(), pageName, plan, onExport, onClose = () => {} }: Props = $props();

  function close() {
    open = false;
    onClose();
  }

  const ready = $derived(plan !== null && !plan.error);
</script>

{#snippet footer()}
  <span class="summary">{ready && plan ? zipSummary(plan.files) : ''}</span>
  <button type="button" class="bava-button" onclick={close}>{t('file.cancel')}</button>
  <button type="button" class="bava-button primary" disabled={!ready} onclick={() => onExport()}>{t('export.zip')}</button>
{/snippet}

<Dialog bind:open title={t('export.page.title')} subtitle={pageName} size="export" {footer} onOpenChange={(next) => !next && onClose()}>
  <div class="bava-zip-export">
    <ZipContents {plan} />
    <div class="settings">
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
