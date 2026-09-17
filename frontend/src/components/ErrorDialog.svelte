<script lang="ts">
  /**
   * An unexpected failure: one plain sentence, details for whoever asks, and
   * ways to hand the problem over — copy the details, open the logs folder.
   *
   * Presentational. What happened, and what the buttons do, is the caller's.
   * Never shows a stack: details carry an error id that finds it in the log.
   */
  import Dialog from './Dialog.svelte';
  import Disclosure from './Disclosure.svelte';
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
  onOpenChange={(next) => {
    if (!next) onClose();
  }}
>
  <div class="error-dialog">
    <p class="body">{body}</p>
    {#if details}
      <Disclosure label={t('error.details')}>
        <pre class="details">{details}</pre>
      </Disclosure>
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
  .error-dialog {
    max-width: 52ch;
  }

  .body {
    margin: 0 0 var(--space-3);
    font-size: var(--text-control);
    color: var(--color-text-secondary);
  }

  .details {
    margin: 0;
    padding: var(--space-2);
    max-height: var(--size-dialog-body-max);
    overflow: auto;
    white-space: pre-wrap;
    font-family: var(--font-mono);
    font-size: var(--text-mono-status);
    color: var(--color-text-primary);
    background: var(--color-surface-sunken);
    border-radius: var(--radius-sm);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    margin-top: var(--space-4);
  }

  .action {
    height: var(--size-row-lg);
    padding: 0 var(--space-3);
    border: var(--border-width) solid var(--color-border-subtle);
    border-radius: var(--radius-sm);
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
