<script lang="ts">
  /** The shared empty treatment. Repeated across the file tree, canvas, search. */
  import Mark from './Mark.svelte';

  type Props = {
    title: string;
    body?: string;
    /** Show the faded brand mark above the title, for "nothing open yet" states. */
    mark?: boolean;
    /** Ways out of the state: a formatted shortcut beside what it does. */
    hints?: { keys: string; label: string }[];
    /** A whole pane with nothing open reads larger than an empty spot in a list. */
    size?: 'spot' | 'pane';
  };

  let { title, body, mark = false, hints = [], size = 'spot' }: Props = $props();
</script>

<div class="empty" data-size={size}>
  {#if mark}
    <div class="faded"><Mark size="hero" /></div>
  {/if}
  <p class="title">{title}</p>
  {#if body}<p class="body">{body}</p>{/if}
  {#if hints.length > 0}
    <ul class="hints">
      {#each hints as hint (hint.label)}
        <li>{#if hint.keys}<kbd>{hint.keys}</kbd>{/if}{hint.label}</li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  /* Border-box: the padding sits inside the full height, or the pane scrolls. */
  .empty {
    box-sizing: border-box;
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

  .hints {
    display: grid;
    gap: var(--space-1);
    margin: var(--space-2) 0 0;
    padding: 0;
    list-style: none;
    justify-items: start;
  }

  .hints li {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--text-meta);
    color: var(--color-text-secondary);
  }

  [data-size='pane'] {
    gap: var(--space-2);
  }

  [data-size='pane'] .title {
    font-size: var(--text-title);
    font-weight: var(--weight-medium);
    color: var(--color-text-primary);
  }

  [data-size='pane'] .body {
    font-size: var(--text-body);
    color: var(--color-text-secondary);
  }

  [data-size='pane'] .hints {
    gap: var(--space-2);
    margin-top: var(--space-4);
  }

  [data-size='pane'] .hints li {
    font-size: var(--text-body);
  }

  [data-size='pane'] kbd {
    font-size: var(--text-mono-source);
  }

  kbd {
    padding: 0 var(--space-1);
    border: var(--border-width) solid var(--color-border-subtle);
    border-radius: var(--radius-sm);
    background: var(--color-surface-nav);
    font-family: var(--font-mono);
    font-size: var(--text-mono-chip);
    color: var(--color-text-secondary);
  }
</style>
