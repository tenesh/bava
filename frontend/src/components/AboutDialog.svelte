<script lang="ts">
  /**
   * About Bava: the mark, the wordmark, what it is and its licence.
   *
   * No version, commit or licences view yet. There is no version stamping
   * until Milestone 16, and showing a made-up number is worse than none.
   */
  import Dialog from './Dialog.svelte';
  import Mark from './Mark.svelte';
  import { t } from '../i18n/t';

  type Props = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  };

  let { open = $bindable(), onOpenChange }: Props = $props();
</script>

<Dialog bind:open title={t('about.title')} {onOpenChange}>
  <div class="about">
    <Mark size="about" />
    <p class="wordmark">{t('brand.wordmark')}</p>
    <p class="tagline">{t('about.tagline')}</p>
    <p class="licence">{t('about.licence')}</p>
    <div class="actions">
      <button type="button" class="close" onclick={() => onOpenChange(false)}>{t('about.close')}</button>
    </div>
  </div>
</Dialog>

<style>
  .about {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
    text-align: center;
  }

  .wordmark {
    margin: var(--space-2) 0 0;
    font-size: var(--text-wordmark);
    font-weight: var(--weight-medium);
    letter-spacing: var(--tracking-wordmark);
    line-height: var(--leading-tight);
    color: var(--color-text-primary);
  }

  .tagline {
    margin: 0;
    font-size: var(--text-control);
    color: var(--color-text-secondary);
  }

  .licence {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-status);
    color: var(--color-text-muted);
  }

  .actions {
    align-self: stretch;
    display: flex;
    justify-content: flex-end;
    margin-top: var(--space-4);
  }

  .close {
    height: var(--size-row-lg);
    padding: 0 var(--space-3);
    border: var(--border-width) solid var(--color-border-subtle);
    border-radius: var(--radius-sm);
    background: var(--color-surface-raised);
    font: inherit;
    font-size: var(--text-control);
    color: var(--color-text-primary);
  }

  .close:focus-visible {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
    outline-offset: var(--focus-halo-width);
  }
</style>
