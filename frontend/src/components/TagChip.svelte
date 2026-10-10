<script lang="ts">
  /**
   * One tag, as a plain chip reading `#launch` (the `#` is drawn, not part
   * of the tag), with a remove button when `onRemove` is
   * given (`removeLabel` names it). Every tag in Bava is drawn by this.
   *
   * Presentational: it reports a remove.
   */
  import ToolIcon from './ToolIcon.svelte';

  type Props = {
    tag: string;
    onRemove?: () => void;
    removeLabel?: string;
    /** Double-clicked: renaming, where a tag can be renamed. */
    ondblclick?: () => void;
  };

  let { tag, onRemove, removeLabel = '', ondblclick }: Props = $props();
</script>

<span class="tag-chip" class:removable={onRemove !== undefined} {ondblclick} role="presentation">
  <span class="name"><span class="hash" aria-hidden="true">#</span>{tag}</span>
  {#if onRemove}
    <button type="button" class="remove" aria-label={removeLabel} title={removeLabel} onclick={onRemove}>
      <ToolIcon id="close" size="sm" />
    </button>
  {/if}
</span>

<style>
  .tag-chip {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    height: var(--size-row-sm);
    padding: 0 var(--space-2);
    border: var(--border-width) solid var(--color-border-strong);
    border-radius: var(--radius-sm);
    background: var(--color-surface);
    color: var(--color-text-secondary);
    font-family: var(--font-data);
    font-size: var(--text-meta);
    white-space: nowrap;
  }

  .hash {
    color: var(--color-text-faint);
  }

  .tag-chip.removable {
    padding-inline-end: var(--space-1);
  }

  .remove {
    display: inline-flex;
    align-items: center;
    padding: 0;
    border: 0;
    border-radius: var(--radius-full);
    background: none;
    color: var(--color-text-muted);
    font: inherit;
    cursor: pointer;
  }

  .remove:hover {
    background: var(--color-control-hover);
    color: var(--color-text-primary);
  }

  .remove:active {
    background: var(--color-control-active);
  }

  .remove:focus-visible {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
    outline-offset: var(--focus-halo-width);
  }
</style>
