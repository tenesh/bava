<script lang="ts">
  /**
   * Resizable regions, wrapping Ark's Splitter.
   *
   * The compound structure stays inside the wrapper: the caller supplies a
   * snippet per panel and the ids it wants, and this file owns the resize
   * handles and their styling.
   */
  import { Splitter } from '@ark-ui/svelte';
  import type { Snippet } from 'svelte';

  type Panel = {
    id: string;
    /** Percentage of the container. */
    size: number;
    minSize?: number;
  };

  type Props = {
    panels: Panel[];
    /** Side by side (the default), or stacked one above the other. */
    orientation?: 'horizontal' | 'vertical';
    onSizeChange?: (sizes: number[]) => void;
    panel: Snippet<[string]>;
  };

  let { panels, orientation = 'horizontal', onSizeChange, panel }: Props = $props();
</script>

<Splitter.Root
  class="bava-splitter"
  {orientation}
  panels={panels.map((p) => ({ id: p.id, minSize: p.minSize }))}
  size={panels.map((p) => p.size)}
  onResize={(details) => onSizeChange?.(details.size)}
>
  {#each panels as p, i (p.id)}
    {#if i > 0}
      <Splitter.ResizeTrigger id={`${panels[i - 1].id}:${p.id}`} class="bava-splitter-handle" />
    {/if}
    <Splitter.Panel id={p.id} class="bava-splitter-panel">
      {@render panel(p.id)}
    </Splitter.Panel>
  {/each}
</Splitter.Root>

<style>
  :global(.bava-splitter) {
    display: flex;
    height: 100%;
    min-height: 0;
  }

  :global(.bava-splitter-panel) {
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  }

  /* Ark draws the handle as a button: none of the button's own look. */
  :global(.bava-splitter-handle) {
    flex: none;
    padding: 0;
    border: 0;
    appearance: none;
    position: relative;
    width: var(--border-width);
    background: var(--color-border-subtle);
    cursor: col-resize;
  }

  /* The line stays one hairline; the pointer finds it a few pixels either side. */
  :global(.bava-splitter-handle)::before {
    content: '';
    position: absolute;
    inset: 0 calc(var(--size-splitter-reach) * -1);
  }

  :global(.bava-splitter[data-orientation='vertical'] > .bava-splitter-handle)::before {
    inset: calc(var(--size-splitter-reach) * -1) 0;
  }

  :global(.bava-splitter[data-orientation='vertical']) {
    flex-direction: column;
  }

  :global(.bava-splitter[data-orientation='vertical'] > .bava-splitter-handle) {
    width: auto;
    height: var(--border-width);
    cursor: row-resize;
  }

  :global(.bava-splitter-handle:hover),
  :global(.bava-splitter-handle[data-focus]) {
    background: var(--color-accent);
  }

  :global(.bava-splitter-handle:focus-visible) {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
  }
</style>
