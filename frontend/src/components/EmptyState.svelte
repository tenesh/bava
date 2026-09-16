<script lang="ts">
  /** The shared empty treatment. Repeated across the file tree, canvas, search. */
  type Props = {
    title: string;
    body?: string;
  };

  let { title, body }: Props = $props();
</script>

<div class="empty">
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
