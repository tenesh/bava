<script lang="ts">
  /**
   * A region of the shell, named by its title. `titled` shows the title in a
   * small-caps header; `bare` keeps it as the region's accessible name only.
   * Presentational: props in, nothing else.
   */
  import type { Snippet } from 'svelte';

  type Props = {
    title: string;
    variant?: 'titled' | 'bare';
    /** Shown at the right of the header: a count, a state, a control. */
    meta?: string;
    children: Snippet;
  };

  let { title, variant = 'titled', meta, children }: Props = $props();
</script>

<section class="pane" aria-label={title}>
  {#if variant === 'titled'}
    <header class="header">
      <span class="title">{title}</span>
      {#if meta}<span class="meta">{meta}</span>{/if}
    </header>
  {/if}
  <div class="body">
    {@render children()}
  </div>
</section>

<style>
  /* Fills its region: the region is a block, so without a height the pane
     shrinks to its header and the body (the canvas stage) is zero tall. */
  .pane {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-width: 0;
    min-height: 0;
    background: var(--color-surface);
  }

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    height: var(--size-statusbar);
    padding: 0 var(--space-3);
    border-bottom: var(--border-width) solid var(--color-border-hairline);
    flex: none;
  }

  .title {
    font-size: var(--text-label);
    font-weight: var(--weight-semibold);
    letter-spacing: var(--tracking-label);
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .meta {
    font-family: var(--font-mono);
    font-size: var(--text-mono-chip);
    color: var(--color-text-faint);
  }

  .body {
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
</style>
