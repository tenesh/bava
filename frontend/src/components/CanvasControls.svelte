<script lang="ts">
  /**
   * The zoom readout and its buttons. The tools live in `ToolRail`.
   *
   * Presentational: it shows the zoom and emits a direction. It does not reach
   * into the canvas, and it holds no geometry.
   */
  import { t } from '../i18n/t';

  type Props = {
    zoom: number;
    onZoom: (direction: 1 | -1) => void;
  };

  let { zoom, onZoom }: Props = $props();
</script>

<div class="zoom">
  <button type="button" onclick={() => onZoom(-1)} aria-label={t('canvas.zoomOut')}>−</button>
  <span class="readout">{Math.round(zoom * 100)}%</span>
  <button type="button" onclick={() => onZoom(1)} aria-label={t('canvas.zoomIn')}>+</button>
</div>

<style>
  .zoom {
    position: absolute;
    right: var(--space-3);
    bottom: var(--space-3);
    z-index: var(--z-floating);
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1);
    background: var(--color-surface-overlay);
    border: var(--border-width) solid var(--color-border-subtle);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-floating);
  }

  .zoom button {
    width: var(--size-row);
    height: var(--size-row);
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    font: inherit;
    color: var(--color-text-secondary);
  }

  .zoom button:focus-visible {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
    outline-offset: calc(var(--focus-halo-width) * -1);
  }

  .readout {
    font-family: var(--font-mono);
    font-size: var(--text-mono-status);
    color: var(--color-text-muted);
    min-width: var(--space-10);
    text-align: center;
  }
</style>
