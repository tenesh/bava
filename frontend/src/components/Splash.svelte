<script lang="ts">
  /**
   * The launch splash: the mark, the wordmark, an indeterminate bar and what
   * is happening. It covers the window only while the app starts; the caller
   * decides when that is over.
   *
   * No version: nothing stamps one yet, and a made-up number is worse than none.
   */
  import Mark from './Mark.svelte';
  import Progress from './Progress.svelte';
  import { t } from '../i18n/t';

  type Props = {
    /** One short line under the bar. */
    status: string;
  };

  let { status }: Props = $props();
</script>

<!-- The labelled progress bar is what assistive tech announces; the visible
     status line repeats it, so it is hidden from them. -->
<div class="splash" data-part="splash" aria-busy="true" aria-label={t('launch.label')}>
  <div class="identity">
    <Mark size="splash" />
    <p class="wordmark">{t('brand.wordmark')}</p>
  </div>
  <div class="progress">
    <Progress label={status} value={null} />
    <p class="status" aria-hidden="true">{status}</p>
  </div>
  <p class="footer">{t('launch.footer')}</p>
</div>

<style>
  .splash {
    position: fixed;
    inset: 0;
    z-index: var(--z-overlay);
    background: var(--color-surface);
    color: var(--color-text-primary);
  }

  /* The identity sits at the window's centre; the bar and footer below it. */
  .identity {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-4);
  }

  .wordmark {
    margin: 0;
    font-size: var(--text-wordmark);
    font-weight: var(--weight-medium);
    letter-spacing: var(--tracking-wordmark);
    line-height: var(--leading-tight);
  }

  .progress {
    --progress-width: var(--size-progress-splash);
    position: absolute;
    inset-inline: 0;
    bottom: var(--space-8);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
  }

  .status,
  .footer {
    margin: 0;
    font-family: var(--font-mono);
    font-size: var(--text-mono-chip);
    color: var(--color-text-muted);
  }

  .footer {
    position: absolute;
    inset-inline: 0;
    bottom: var(--space-2);
    text-align: center;
    color: var(--color-text-faint);
  }
</style>
