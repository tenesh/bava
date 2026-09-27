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
    <div class="progress">
      <Progress label={status} value={null} />
      <p class="status" aria-hidden="true">{status}</p>
    </div>
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

  /* One column at the window's centre: mark, wordmark, then the bar. */
  .identity {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--space-6);
  }

  .wordmark {
    margin: 0;
    font-size: var(--text-wordmark);
    font-weight: var(--weight-semibold);
    letter-spacing: var(--tracking-wordmark);
    line-height: var(--leading-tight);
  }

  .progress {
    --progress-width: var(--size-progress-splash);
    --progress-thickness: var(--size-progress-splash-thickness);
    --progress-track: var(--color-surface-sunken);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-2);
  }

  .status {
    margin: 0;
    font-size: var(--text-note);
    color: var(--color-text-muted);
  }

  .footer {
    position: absolute;
    inset-inline: 0;
    bottom: var(--space-6);
    margin: 0;
    text-align: center;
    font-size: var(--text-meta);
    color: var(--color-text-muted);
  }
</style>
