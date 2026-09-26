<script lang="ts">
  /**
   * The layout engine a diagram is laid out with, and its direction.
   *
   * TALA is the default; dagre and elk are alternatives the user picks, not
   * fallbacks. TALA ignores `direction`, so the direction control is not shown
   * while it is chosen (CLAUDE.md, "D2 usage"). Presentational: it reports
   * choices and renders nothing itself.
   */
  import Segments from './Segments.svelte';
  import { t } from '../i18n/t';

  import type { Direction, LayoutEngine } from '../settings/layout-engine';

  type Props = {
    engine: LayoutEngine;
    direction: Direction;
    /** Shown beside the direction control, while there is one. */
    directionHint?: string;
    onEngine: (engine: LayoutEngine) => void;
    onDirection: (direction: Direction) => void;
  };

  let { engine, direction, directionHint, onEngine, onDirection }: Props = $props();

  // Proper nouns, the same in every locale: names, not message keys, as a
  // language name is (docs/decisions.md, 2026-09-20).
  const engines: { value: LayoutEngine; label: string }[] = [
    { value: 'tala', label: 'TALA' },
    { value: 'dagre', label: 'Dagre' },
    { value: 'elk', label: 'ELK' },
  ];
  const directions: { value: Direction; label: string }[] = [
    { value: 'down', label: t('layout.down') },
    { value: 'right', label: t('layout.right') },
    { value: 'up', label: t('layout.up') },
    { value: 'left', label: t('layout.left') },
  ];
</script>

<div class="picker">
  <Segments value={engine} options={engines} label={t('layout.engine')} onValueChange={onEngine} />
  {#if engine !== 'tala'}
    <Segments value={direction} options={directions} label={t('layout.direction')} onValueChange={onDirection} />
    {#if directionHint}
      <span class="hint">{directionHint}</span>
    {/if}
  {/if}
</div>

<style>
  .hint {
    color: var(--color-text-secondary);
    font-size: var(--text-control);
  }

  .picker {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    align-items: center;
  }
</style>
