<script lang="ts">
  /**
   * A shortcut drawn as one small key box per key ("⇧⌘]" as ⇧ ⌘ ]), read
   * out once as the whole shortcut. Used at the right of a menu item.
   *
   * Presentational.
   */
  import { keycaps } from './keycaps';

  type Props = { keys: string };

  let { keys }: Props = $props();
</script>

<span class="keycaps">
  <span class="spoken">{keys}</span>
  {#each keycaps(keys) as key, index (index)}<kbd aria-hidden="true">{key}</kbd>{/each}
</span>

<style>
  .keycaps {
    display: inline-flex;
    gap: var(--space-half);
  }

  .spoken {
    position: absolute;
    width: var(--border-width);
    height: var(--border-width);
    margin: calc(var(--border-width) * -1);
    padding: 0;
    border: 0;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  kbd {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: var(--size-menu-key);
    height: var(--size-menu-key);
    padding: 0 var(--space-half);
    border: var(--border-width) solid var(--color-border-strong);
    border-radius: var(--radius-sm);
    font-family: var(--font-data);
    font-size: var(--text-menu-keys);
    line-height: 1;
    color: var(--color-text-muted);
  }
</style>
