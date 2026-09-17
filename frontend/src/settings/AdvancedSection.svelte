<script lang="ts">
  /**
   * Settings ▸ Advanced: verbose logging.
   *
   * Presentational. The caller holds the value and applies changes.
   */
  import Segments from '../components/Segments.svelte';
  import { t } from '../i18n/t';

  type Props = {
    verbose: boolean;
    onVerboseChange: (on: boolean) => void;
  };

  let { verbose, onVerboseChange }: Props = $props();

  const options: { value: 'off' | 'on'; label: string }[] = [
    { value: 'off', label: t('settings.verboseLogging.off') },
    { value: 'on', label: t('settings.verboseLogging.on') },
  ];
</script>

<section class="section">
  <h3 class="heading">{t('settings.advanced')}</h3>
  <div class="row">
    <span class="label">{t('settings.verboseLogging')}</span>
    <Segments
      value={verbose ? 'on' : 'off'}
      {options}
      label={t('settings.verboseLogging')}
      onValueChange={(value) => onVerboseChange(value === 'on')}
    />
  </div>
  <p class="hint">{t('settings.verboseLogging.hint')}</p>
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

  .hint {
    margin: var(--space-1) 0 0;
    max-width: 52ch;
    font-size: var(--text-meta);
    color: var(--color-text-muted);
  }
</style>
