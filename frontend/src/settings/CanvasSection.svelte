<script lang="ts">
  /**
   * Settings ▸ Canvas: whether arrow ends attach to shapes, whether they
   * snap to a side's middle (Excalidraw's two toggles), and whether shapes
   * snap to other objects.
   *
   * Presentational. The caller holds the values and persists changes.
   */
  import Segments from '../components/Segments.svelte';
  import { t } from '../i18n/t';

  type Props = {
    arrowBinding: boolean;
    midpointSnap: boolean;
    objectSnap: boolean;
    onArrowBindingChange: (on: boolean) => void;
    onMidpointSnapChange: (on: boolean) => void;
    onObjectSnapChange: (on: boolean) => void;
  };

  let {
    arrowBinding,
    midpointSnap,
    objectSnap,
    onArrowBindingChange,
    onMidpointSnapChange,
    onObjectSnapChange,
  }: Props = $props();

  const options: { value: 'off' | 'on'; label: string }[] = [
    { value: 'off', label: t('settings.off') },
    { value: 'on', label: t('settings.on') },
  ];
</script>

<section class="section">
  <h3 class="heading">{t('settings.canvas.group')}</h3>
  <div class="row">
    <span class="label">{t('settings.arrowBinding')}</span>
    <Segments
      value={arrowBinding ? 'on' : 'off'}
      {options}
      label={t('settings.arrowBinding')}
      onValueChange={(value) => onArrowBindingChange(value === 'on')}
    />
  </div>
  <p class="hint">{t('settings.arrowBinding.hint')}</p>
  <div class="row">
    <span class="label">{t('settings.midpointSnap')}</span>
    <Segments
      value={midpointSnap ? 'on' : 'off'}
      {options}
      label={t('settings.midpointSnap')}
      onValueChange={(value) => onMidpointSnapChange(value === 'on')}
    />
  </div>
  <div class="row">
    <span class="label">{t('settings.objectSnap')}</span>
    <Segments
      value={objectSnap ? 'on' : 'off'}
      {options}
      label={t('settings.objectSnap')}
      onValueChange={(value) => onObjectSnapChange(value === 'on')}
    />
  </div>
  <p class="hint">{t('settings.objectSnap.hint')}</p>
</section>

<style>
  .section {
    min-width: 0;
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
