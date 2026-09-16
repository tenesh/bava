<script lang="ts">
  /**
   * Settings ▸ Files: autosave mode and delay.
   *
   * Presentational. The caller holds the values and persists changes.
   */
  import Segments from '../components/Segments.svelte';
  import { t } from '../i18n/t';
  import type { AutosaveMode } from '../files/autosave.svelte';
  import { AUTOSAVE_DELAY_LIMITS } from './limits';

  type Props = {
    mode: AutosaveMode;
    delayMs: number;
    onModeChange: (mode: AutosaveMode) => void;
    onDelayChange: (ms: number) => void;
  };

  let { mode, delayMs, onModeChange, onDelayChange }: Props = $props();

  const { min: MIN_DELAY_MS, max: MAX_DELAY_MS } = AUTOSAVE_DELAY_LIMITS;

  const modes: { value: AutosaveMode; label: string }[] = [
    { value: 'off', label: t('settings.autosave.off') },
    { value: 'afterDelay', label: t('settings.autosave.afterDelay') },
    { value: 'onFocusChange', label: t('settings.autosave.onFocusChange') },
  ];
</script>

<section class="section">
  <h3 class="heading">{t('settings.files')}</h3>
  <div class="row">
    <span class="label">{t('settings.autosave')}</span>
    <Segments value={mode} options={modes} label={t('settings.autosave')} onValueChange={onModeChange} />
  </div>
  {#if mode === 'afterDelay'}
    <label class="row">
      <span class="label">{t('settings.autosaveDelay')}</span>
      <input
        class="delay"
        type="number"
        min={MIN_DELAY_MS}
        max={MAX_DELAY_MS}
        step="100"
        value={delayMs}
        onchange={(event) => {
          const value = Number(event.currentTarget.value);
          if (Number.isFinite(value)) {
            onDelayChange(Math.min(MAX_DELAY_MS, Math.max(MIN_DELAY_MS, Math.round(value))));
          }
        }}
      />
    </label>
  {/if}
</section>

<style>
  .section {
    min-width: 0;
    margin-top: var(--space-6);
  }

  .heading {
    margin: 0 0 var(--space-3);
    font-size: var(--text-label);
    font-weight: var(--weight-semibold);
    letter-spacing: var(--tracking-label);
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-6);
    min-height: var(--size-row-lg);
  }

  .label {
    font-size: var(--text-control);
    color: var(--color-text-secondary);
  }

  .delay:focus-visible {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
    outline-offset: calc(var(--focus-halo-width) * -1);
  }

  .delay {
    width: var(--size-field-number);
    height: var(--size-row);
    padding: 0 var(--space-2);
    border: var(--border-width) solid var(--color-border-subtle);
    border-radius: var(--radius-sm);
    background: var(--color-surface-raised);
    font: inherit;
    font-size: var(--text-control);
    color: var(--color-text-primary);
  }
</style>
