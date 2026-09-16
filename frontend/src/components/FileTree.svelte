<script lang="ts">
  /**
   * The workspace listing.
   *
   * Presentational: it renders entries and reports an activation. Opening a
   * file is the shell's decision, not this component's.
   */
  import type { Entry } from '../files/workspace.svelte';

  type Props = {
    entries: Entry[];
    activePath: string | null;
    onActivate: (path: string) => void;
  };

  let { entries, activePath, onActivate }: Props = $props();

  function extension(name: string): string {
    const dot = name.lastIndexOf('.');
    return dot === -1 ? '' : name.slice(dot + 1).toUpperCase();
  }
</script>

<ul class="tree">
  {#each entries as entry (entry.path)}
    <li>
      <button
        type="button"
        class="entry"
        class:active={entry.path === activePath}
        disabled={entry.isDir}
        onclick={() => onActivate(entry.path)}
      >
        <span class="badge">{entry.isDir ? '▸' : extension(entry.name)}</span>
        <span class="name">{entry.name}</span>
      </button>
    </li>
  {/each}
</ul>

<style>
  .tree {
    margin: 0;
    padding: var(--space-1);
    list-style: none;
  }

  .entry {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    width: 100%;
    height: var(--size-row);
    padding: 0 var(--space-2);
    border: 0;
    border-radius: var(--radius-sm);
    background: transparent;
    font: inherit;
    font-size: var(--text-meta);
    color: var(--color-text-secondary);
    text-align: start;
  }

  .entry.active {
    background: var(--color-accent-subtle);
    color: var(--color-accent);
  }

  .entry:focus-visible {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
    outline-offset: calc(var(--focus-halo-width) * -1);
  }

  .badge {
    flex: none;
    min-width: var(--space-5);
    font-family: var(--font-mono);
    font-size: var(--text-mono-chip);
    color: var(--color-text-faint);
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
