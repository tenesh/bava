<script lang="ts">
  /**
   * Keyboard shortcuts, grouped by menu, each key on a keycap of its own.
   *
   * Presentational: the caller derives the groups from the menu spec.
   */
  import Dialog from './Dialog.svelte';
  import { keycaps } from './keycaps';

  type Group = { title: string; rows: { label: string; keys: string }[] };

  type Props = {
    open: boolean;
    title: string;
    groups: Group[];
    onOpenChange: (open: boolean) => void;
  };

  let { open = $bindable(), title, groups, onOpenChange }: Props = $props();
</script>

<Dialog bind:open {title} size="shortcuts" flush closable {onOpenChange}>
  <div class="shortcuts">
    {#each groups as group (group.title)}
      <section class="group">
        <h3 class="heading">{group.title}</h3>
        <dl class="rows">
          {#each group.rows as row (row.label + row.keys)}
            <div class="row">
              <dt>{row.label}</dt>
              <dd class="caps" aria-label={row.keys}>
                {#each keycaps(row.keys) as key, index (index)}<kbd class="cap">{key}</kbd>{/each}
              </dd>
            </div>
          {/each}
        </dl>
      </section>
    {/each}
  </div>
</Dialog>

<style>
  /*
   * One size whatever the groups hold, spanning the body edge to edge; its
   * height leaves room for the header (its padding, close button and rule).
   * Groups flow down three columns, as a menu's shortcuts read in order.
   */
  .shortcuts {
    box-sizing: border-box;
    height: 100%;
    padding: var(--space-2) var(--space-6) var(--space-5);
    overflow-y: auto;
    column-count: 3;
    column-gap: var(--space-7);
  }

  .group {
    break-inside: avoid;
  }

  .heading {
    margin: var(--space-3) 0 var(--space-1);
    font-size: var(--text-label);
    font-weight: var(--weight-semibold);
    letter-spacing: var(--tracking-label);
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  .rows {
    margin: 0;
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
    height: var(--size-row-lg);
    border-bottom: var(--border-width) solid var(--color-border-subtle);
    font-size: var(--text-control);
  }

  dt {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--color-text-secondary);
  }

  .caps {
    display: inline-flex;
    flex: none;
    gap: var(--size-keycap-gap);
    margin: 0;
  }

  .cap {
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: var(--size-keycap);
    height: var(--size-keycap);
    padding: 0 var(--size-keycap-padding);
    border: var(--border-width) solid var(--color-border-subtle);
    border-bottom-width: var(--size-keycap-edge);
    border-radius: var(--radius-md);
    background: var(--color-surface-raised);
    font-family: var(--font-mono);
    font-size: var(--text-keycap);
    color: var(--color-text-primary);
  }
</style>
