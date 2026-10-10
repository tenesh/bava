<script lang="ts">
  /**
   * The layout engine a diagram is laid out with, and its direction.
   *
   * TALA is the default; dagre and elk are alternatives the user picks, not
   * fallbacks. TALA ignores `direction`, so the direction control is not shown
   * while it is chosen (CLAUDE.md, "D2 usage"); a line saying so stands in for
   * it. Each control carries an uppercase name before it. Presentational: it
   * reports choices and renders nothing itself.
   */
  import Segments from './Segments.svelte';
  import { t } from '../i18n/t';

  import { ENGINE_NAMES, type Direction, type LayoutEngine } from '../settings/layout-engine';

  type Props = {
    engine: LayoutEngine;
    direction: Direction;
    /** Shown beside the direction control, while there is one. */
    directionHint?: string;
    onEngine: (engine: LayoutEngine) => void;
    onDirection: (direction: Direction) => void;
  };

  let { engine, direction, directionHint, onEngine, onDirection }: Props = $props();

  const engines: { value: LayoutEngine; label: string }[] = (Object.keys(ENGINE_NAMES) as LayoutEngine[]).map(
    (value) => ({ value, label: ENGINE_NAMES[value] }),
  );
  const directions: { value: Direction; label: string }[] = [
    { value: 'down', label: t('layout.down') },
    { value: 'right', label: t('layout.right') },
    { value: 'up', label: t('layout.up') },
    { value: 'left', label: t('layout.left') },
  ];
</script>

<div class="picker">
  <span class="name" aria-hidden="true">{t('layout.engine')}</span>
  <Segments value={engine} options={engines} label={t('layout.engine')} onValueChange={onEngine} />
  {#if engine !== 'tala'}
    <span class="name" aria-hidden="true">{t('layout.direction')}</span>
    <Segments value={direction} options={directions} label={t('layout.direction')} onValueChange={onDirection} />
    {#if directionHint}
      <span class="hint">{directionHint}</span>
    {/if}
  {:else}
    <span class="hint">{t('layout.talaHint')}</span>
  {/if}
</div>

<style>
  .name {
    font-size: var(--text-label);
    font-weight: var(--weight-semibold);
    font-family: var(--font-label);
    letter-spacing: var(--tracking-label);
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .hint {
    color: var(--color-text-muted);
    font-size: var(--text-meta);
  }

  .picker {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3) var(--space-4);
    align-items: center;
  }
</style>
