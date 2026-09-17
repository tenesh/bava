<script lang="ts">
  /**
   * A menu opened at a point: the canvas's right-click menu, and the same tree
   * behind the selection toolbar's More. Wraps Ark's Menu, controlled, anchored
   * at the pointer; submenus are nested menus opened from a trigger item.
   *
   * Presentational: it shows the tree it is handed and reports a command id.
   */
  import { Menu, Portal } from '@ark-ui/svelte';
  import { atPoint, type MenuNode } from '../canvas/context-menu';
  import { portalRoot } from './portal-root';
  import ToolIcon from './ToolIcon.svelte';

  type Props = {
    items: MenuNode[];
    open: boolean;
    /** Viewport coordinates to open at. */
    anchor: { x: number; y: number } | null;
    onSelect: (id: string) => void;
    onOpenChange: (open: boolean) => void;
  };

  let { items, open, anchor, onSelect, onOpenChange }: Props = $props();
</script>

{#snippet entries(list: MenuNode[])}
  {#each list as node, index (node.kind === 'separator' ? `separator-${index}` : node.id)}
    {#if node.kind === 'separator'}
      <Menu.Separator class="bava-menu-separator" />
    {:else if node.kind === 'item'}
      <Menu.Item value={node.id} class="bava-menu-item">
        <span class="bava-menu-label">{node.label}</span>
        {#if node.keys}<span class="keys">{node.keys}</span>{/if}
      </Menu.Item>
    {:else}
      <Menu.Root onSelect={(details) => onSelect(details.value)} positioning={{ placement: 'right-start', gutter: 2 }}>
        <Menu.TriggerItem class="bava-menu-item">
          <span class="bava-menu-label">{node.label}</span>
          <span class="chevron"><ToolIcon id="chevron" size="sm" /></span>
        </Menu.TriggerItem>
        <Portal container={portalRoot()}>
          <Menu.Positioner>
            <Menu.Content class="bava-menu">
              {@render entries(node.items)}
            </Menu.Content>
          </Menu.Positioner>
        </Portal>
      </Menu.Root>
    {/if}
  {/each}
{/snippet}

<Menu.Root
  {open}
  positioning={atPoint(() => anchor)}
  lazyMount
  unmountOnExit
  onOpenChange={(details) => onOpenChange(details.open)}
  onSelect={(details) => onSelect(details.value)}
>
  <Portal container={portalRoot()}>
    <Menu.Positioner>
      <Menu.Content class="bava-menu">
        {@render entries(items)}
      </Menu.Content>
    </Menu.Positioner>
  </Portal>
</Menu.Root>

<style>
  :global(.bava-menu) {
    z-index: var(--z-portal);
    display: flex;
    flex-direction: column;
    min-width: var(--size-menu-min);
    padding: var(--space-1);
    background: var(--color-surface-overlay);
    border: var(--border-width) solid var(--color-border-subtle);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-floating);
    outline: none;
  }

  :global(.bava-menu[hidden]) {
    display: none;
  }

  :global(.bava-menu-item) {
    display: flex;
    align-items: center;
    gap: var(--space-4);
    height: var(--size-row);
    padding: 0 var(--space-2);
    border-radius: var(--radius-sm);
    font-size: var(--text-control);
    color: var(--color-text-primary);
    cursor: default;
  }

  :global(.bava-menu-item[data-highlighted]) {
    background: var(--color-accent-subtle);
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
    outline-offset: calc(var(--focus-halo-width) * -1);
  }

  :global(.bava-menu-label) {
    flex: 1;
  }

  .keys {
    font-family: var(--font-mono);
    font-size: var(--text-mono-chip);
    color: var(--color-text-muted);
  }

  .chevron {
    display: flex;
    color: var(--color-text-muted);
  }

  :global(.bava-menu-separator) {
    height: var(--border-width);
    margin: var(--space-1) 0;
    border: 0;
    background: var(--color-border-subtle);
  }
</style>
