<script lang="ts">
  /**
   * Keyboard shortcuts, grouped by menu.
   *
   * Presentational: the caller derives the groups from the menu spec.
   */
  import Dialog from './Dialog.svelte';

  type Group = { title: string; rows: { label: string; keys: string }[] };

  type Props = {
    open: boolean;
    title: string;
    groups: Group[];
    onOpenChange: (open: boolean) => void;
  };

  let { open = $bindable(), title, groups, onOpenChange }: Props = $props();
</script>

<Dialog bind:open {title} {onOpenChange}>
  <div class="groups">
    {#each groups as group (group.title)}
      <section>
        <h3 class="heading">{group.title}</h3>
        <dl class="rows">
          {#each group.rows as row (row.label + row.keys)}
            <div class="row">
              <dt>{row.label}</dt>
              <dd><kbd>{row.keys}</kbd></dd>
            </div>
          {/each}
        </dl>
      </section>
    {/each}
  </div>
</Dialog>

<style>
  .groups {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-4) var(--space-6);
    max-height: var(--size-dialog-body-max);
    overflow-y: auto;
  }

  .heading {
    margin: 0 0 var(--space-2);
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
    justify-content: space-between;
    gap: var(--space-4);
    min-height: var(--size-row);
    align-items: center;
    font-size: var(--text-control);
  }

  dt {
    color: var(--color-text-secondary);
  }

  dd {
    margin: 0;
  }

  kbd {
    font-family: var(--font-mono);
    color: var(--color-text-primary);
  }
</style>
