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
    <button type="button" class="bava-button close" onclick={() => onOpenChange(false)}>{t('about.close')}</button>
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
  }
</style>
