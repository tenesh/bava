<script lang="ts">
  /**
   * About Bava: the mark, what it is and its licence.
   *
   * No version, commit or licences view yet. Nothing stamps a version yet,
   * and showing a made-up number is worse than none.
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

<Dialog bind:open title={t('about.title')} variant="alert" align="center" size="about" {onOpenChange}>
  {#snippet leading()}
    <Mark size="about" />
  {/snippet}
  <div class="about">
    <p class="tagline">{t('about.tagline')}</p>
    <p class="licence">{t('about.licence')}</p>
    <button type="button" class="close" onclick={() => onOpenChange(false)}>{t('about.close')}</button>
  </div>
</Dialog>

<style>
  .about {
    display: contents;
  }

  .tagline,
  .licence {
    margin: 0;
    text-align: center;
  }

  .tagline {
    font-size: var(--text-body);
    color: var(--color-text-secondary);
  }

  .licence {
    font-size: var(--text-note);
    color: var(--color-text-muted);
  }

  .close {
    align-self: center;
    margin-top: var(--space-2);
    height: var(--size-row-lg);
    padding: 0 var(--space-3);
    border: var(--border-width) solid var(--color-border-subtle);
    border-radius: var(--radius-md);
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
