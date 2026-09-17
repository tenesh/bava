<script lang="ts">
  /** The shared empty treatment. Repeated across the file tree, canvas, search. */
  import Mark from './Mark.svelte';

  type Props = {
    title: string;
    body?: string;
    /** Show the faded brand mark above the title, for "nothing open yet" states. */
    mark?: boolean;
  };

  let { title, body, mark = false }: Props = $props();
</script>

<div class="empty">
  {#if mark}
    <div class="faded"><Mark size="hero" /></div>
  {/if}
  <p class="title">{title}</p>
  {#if body}<p class="body">{body}</p>{/if}
</div>

<style>
  .empty {
    height: 100%;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: var(--space-1);
    padding: var(--space-6);
    text-align: center;
  }

  .faded {
    opacity: var(--opacity-mark-faded);
    margin-bottom: var(--space-2);
  }

  .title {
    margin: 0;
    font-size: var(--text-control);
    color: var(--color-text-secondary);
  }

  .body {
    margin: 0;
    font-size: var(--text-meta);
    color: var(--color-text-muted);
    max-width: 30ch;
  }
</style>
