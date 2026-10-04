<script lang="ts">
  /**
   * One state of a component in the gallery: its name above, the component in
   * a frame below. The frame is positioned, so a component placed absolutely
   * (the tool rail, the zoom buttons) sits inside it, on the ground it has in
   * the app.
   */
  import type { Snippet } from 'svelte';

  type Props = {
    name: string;
    /** The frame's size, as CSS; by default as large as what it holds. */
    width?: string;
    height?: string;
    /** What the component sits on in the app. */
    ground?: 'surface' | 'nav' | 'canvas';
    children: Snippet;
  };

  let { name, width, height, ground = 'surface', children }: Props = $props();
</script>

<figure class="cell" data-cell={name}>
  <figcaption>{name}</figcaption>
  <div class="frame" data-ground={ground} style:width style:height>
    {@render children()}
  </div>
</figure>

<style>
  .cell {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin: 0;
    padding: var(--space-2);
  }

  figcaption {
    font-size: var(--text-label);
    color: var(--color-text-faint);
  }

  .frame {
    position: relative;
  }

  .frame[data-ground='nav'] {
    background: var(--color-surface-nav);
  }

  .frame[data-ground='canvas'] {
    background: var(--color-canvas-bg);
  }
</style>
