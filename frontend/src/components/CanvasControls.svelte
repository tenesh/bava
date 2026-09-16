<script lang="ts">
  /**
   * The tool rail and zoom readout.
   *
   * Presentational: it shows the active tool and emits a choice. It does not
   * reach into the canvas, and it holds no geometry.
   */
  import { TOOLS, type ToolId } from '../canvas/tools.svelte';
  import { t } from '../i18n/t';

  type Props = {
    active: ToolId;
    zoom: number;
    onSelect: (tool: ToolId) => void;
    onZoom: (direction: 1 | -1) => void;
  };

  let { active, zoom, onSelect, onZoom }: Props = $props();
</script>

<div class="rail" role="toolbar" aria-label={t('canvas.tools')} aria-orientation="vertical">
  {#each TOOLS as tool (tool.id)}
    <button
      type="button"
      class="tool"
      class:active={active === tool.id}
      aria-pressed={active === tool.id}
      title={`${t(tool.labelKey)} (${tool.key.toUpperCase()})`}
      onclick={() => onSelect(tool.id)}
    >
      <span class="label">{t(tool.labelKey)}</span>
      <span class="key">{tool.key.toUpperCase()}</span>
    </button>
  {/each}
</div>

<div class="zoom">
  <button type="button" onclick={() => onZoom(-1)} aria-label={t('canvas.zoomOut')}>−</button>
  <span class="readout">{Math.round(zoom * 100)}%</span>
  <button type="button" onclick={() => onZoom(1)} aria-label={t('canvas.zoomIn')}>+</button>
</div>

<style>
  .rail {
    position: absolute;
    top: var(--space-3);
    left: var(--space-3);
    z-index: var(--z-floating);
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-1);
    background: var(--color-surface-overlay);
    border: var(--border-width) solid var(--color-border-subtle);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-floating);
  }

  .tool {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    height: var(--size-row);
    padding: 0 var(--space-2);
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    font: inherit;
    font-size: var(--text-meta);
    color: var(--color-text-secondary);
  }

  .tool.active {
    background: var(--color-accent-subtle);
    color: var(--color-accent);
  }

  .tool:focus-visible,
  .zoom button:focus-visible {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
    outline-offset: calc(var(--focus-halo-width) * -1);
  }

  .key {
    font-family: var(--font-mono);
    font-size: var(--text-mono-chip);
    color: var(--color-text-faint);
  }

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

  .readout {
    font-family: var(--font-mono);
    font-size: var(--text-mono-status);
    color: var(--color-text-muted);
    min-width: var(--space-10);
    text-align: center;
  }
</style>
