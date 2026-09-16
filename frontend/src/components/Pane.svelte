<script lang="ts">
  /** A titled region of the shell. Presentational: props in, nothing else. */
  import type { Snippet } from 'svelte';

  type Props = {
    title: string;
    /** Shown at the right of the header — a count, a state, a control. */
    meta?: string;
    children: Snippet;
  };

  let { title, meta, children }: Props = $props();
</script>

<section class="pane" aria-label={title}>
  <header class="header">
    <span class="title">{title}</span>
    {#if meta}<span class="meta">{meta}</span>{/if}
  </header>
  <div class="body">
    {@render children()}
  </div>
</section>

<style>
  .pane {
    display: flex;
    flex-direction: column;
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
    letter-spacing: 0.06em;
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
