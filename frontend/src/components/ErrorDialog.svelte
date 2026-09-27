<script lang="ts">
  /**
   * An unexpected failure: one plain sentence, details for whoever asks, and
   * ways to hand the problem over: copy the details, open the logs folder.
   *
   * Presentational. What happened, and what the buttons do, is the caller's.
   * Never shows a stack: details carry an error id that finds it in the log.
   */
  import Dialog from './Dialog.svelte';
  import { detailRows } from './detail-rows';
  import { t } from '../i18n/t';

  type Props = {
    open: boolean;
    title: string;
    body: string;
    details: string;
    onCopyDetails: (details: string) => void;
    onOpenLogs: () => void;
    onClose: () => void;
  };

  let { open = $bindable(), title, body, details, onCopyDetails, onOpenLogs, onClose }: Props = $props();
</script>

<Dialog
  bind:open
  {title}
  variant="alert"
  onOpenChange={(next) => {
    if (!next) onClose();
  }}
>
  <div class="error-dialog">
    <p class="body">{body}</p>
    {#if details}
      <dl class="details" aria-label={t('error.details')}>
        {#each detailRows(details) as row, index (index)}
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        {/each}
      </dl>
    {/if}
    <div class="actions">
      {#if details}
        <button type="button" class="action" onclick={() => onCopyDetails(details)}>{t('error.copyDetails')}</button>
      {/if}
      <button type="button" class="action" onclick={onOpenLogs}>{t('error.openLogs')}</button>
      <button type="button" class="action primary" onclick={onClose}>{t('error.close')}</button>
    </div>
  </div>
</Dialog>

<style>
  /* The same rhythm as the alert frame keeps with the title above. */
  .error-dialog {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    max-width: 52ch;
  }

  .body {
    margin: 0;
    font-size: var(--text-body);
    color: var(--color-text-secondary);
  }

  /* Labels in a narrow muted column, values in mono beside them. */
  .details {
    display: grid;
    grid-template-columns: var(--size-error-detail-label) 1fr;
    gap: var(--space-1) var(--space-3);
    margin: 0;
    padding: var(--size-field-padding) var(--space-3);
    max-height: var(--size-dialog-body-max);
    overflow: auto;
    font-size: var(--text-note);
    background: var(--color-surface-sunken);
    border-radius: var(--radius-md);
  }

  .details dt {
    color: var(--color-text-muted);
  }

  .details dd {
    margin: 0;
    font-family: var(--font-mono);
    color: var(--color-text-primary);
    overflow-wrap: anywhere;
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
    border-radius: var(--radius-md);
    background: var(--color-surface-raised);
    font: inherit;
    font-size: var(--text-control);
    color: var(--color-text-primary);
  }

  .action.primary {
    background: var(--color-accent);
    border-color: var(--color-accent);
    color: var(--color-accent-contrast);
  }

  .action:focus-visible {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
    outline-offset: var(--focus-halo-width);
  }
</style>
