<script lang="ts">
  /**
   * Beside the block under the pointer in the Document: `+` to add a block
   * below it, ⋮⋮ to drag it or open its menu.
   *
   * Presentational: it reports the press, the drag's start, and where the
   * menu should open.
   */
  import ToolIcon from './ToolIcon.svelte';
  import { t } from '../i18n/t';

  type Props = {
    /** Where the block starts, relative to the pane. */
    at: { left: number; top: number };
    onAdd: () => void;
    onMenu: (anchor: { x: number; y: number }) => void;
    onDragStart: (event: DragEvent) => void;
    onDragEnd: () => void;
  };

  let { at, onAdd, onMenu, onDragStart, onDragEnd }: Props = $props();
</script>

<div class="handle" style:left={`${at.left}px`} style:top={`${at.top}px`}>
  <button type="button" class="bava-icon-button small" aria-label={t('doc.addBlock')} title={t('doc.addBlock')} onmousedown={(event) => event.preventDefault()} onclick={onAdd}>
    <ToolIcon id="insert" size="sm" />
  </button>
  <button
    type="button"
    class="bava-icon-button small grip"
    aria-label={t('doc.blockMenu')}
    title={t('doc.blockMenu')}
    draggable="true"
    ondragstart={onDragStart}
    ondragend={onDragEnd}
    onmousedown={(event) => event.stopPropagation()}
    onclick={(event) => {
      const box = event.currentTarget.getBoundingClientRect();
      onMenu({ x: box.left, y: box.bottom });
    }}
  >
    <ToolIcon id="grip" size="sm" />
  </button>
</div>

<style>
  .handle {
    position: absolute;
    display: flex;
    gap: var(--space-half);
    transform: translateX(-100%);
    padding-right: var(--space-1);
  }

  .small {
    width: var(--size-row-sm);
    height: var(--size-row-sm);
    color: var(--color-text-muted);
  }

  .grip {
    cursor: grab;
  }
</style>
