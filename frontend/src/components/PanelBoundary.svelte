<script lang="ts">
  /**
   * Keeps a crash inside one panel. Wraps Svelte's `<svelte:boundary>`: when
   * anything inside throws while rendering, the panel shows a short message
   * and a way to try again, and the rest of the window keeps working.
   *
   * Presentational: the caller decides where the error is reported.
   */
  import type { Snippet } from 'svelte';
  import { t } from '../i18n/t';

  type Props = {
    /** The panel's name, for the message. */
    name: string;
    onError: (error: unknown) => void;
    children: Snippet;
  };

  let { name, onError, children }: Props = $props();
</script>

<svelte:boundary onerror={(error) => onError(error)}>
  {@render children()}

  {#snippet failed(_error, reset)}
    <div class="failed" role="alert">
      <p class="title">{t('panel.failed.title')}</p>
      <p class="body">{t('panel.failed.body').replace('{panel}', name)}</p>
      <button type="button" class="reload" onclick={reset}>{t('panel.failed.reload')}</button>
    </div>
  {/snippet}
</svelte:boundary>

<style>
  .failed {
    height: 100%;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: var(--space-2);
    padding: var(--space-6);
    text-align: center;
  }

  .title {
    margin: 0;
    font-size: var(--text-control);
    color: var(--color-text-primary);
  }

  .body {
    margin: 0;
    max-width: 40ch;
    font-size: var(--text-meta);
    color: var(--color-text-muted);
  }

  .reload {
    height: var(--size-row-lg);
    padding: 0 var(--space-3);
    border: var(--border-width) solid var(--color-border-subtle);
    border-radius: var(--radius-sm);
    background: var(--color-surface-raised);
    font: inherit;
    font-size: var(--text-control);
    color: var(--color-text-primary);
  }

  .reload:focus-visible {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
    outline-offset: var(--focus-halo-width);
  }
</style>
