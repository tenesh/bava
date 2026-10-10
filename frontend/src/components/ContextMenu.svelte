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
    /** Once the menu has closed and left the page: where focus can be given back. */
    onClosed?: () => void;
    /**
     * Drawn where it is written, not in the portal: a dialog's own menus,
     * which the dialog's focus trap would otherwise pull the keys back from.
     * Placed against the window, so the dialog's edges never cut it.
     */
    within?: boolean;
  };

  let { items, open, anchor, onSelect, onOpenChange, onClosed, within = false }: Props = $props();

  // Opened from a button or a press, the menu takes the keys itself: Ark
  // leaves focus where it was, so the arrows never reached it, and a menu in
  // a dialog lost the focus fight and closed.
  let content: HTMLElement | null = $state(null);
  // What held the keys before the menu took them: given back when it closes
  // with nowhere else to go, as Ark has no trigger of its own to give back to.
  let before: HTMLElement | null = null;
  $effect(() => {
    if (open) before = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
  });

  function closed() {
    const back = before;
    before = null;
    const lost = document.activeElement === null || document.activeElement === document.body;
    if (lost && back?.isConnected) back.focus({ preventScroll: true });
    onClosed?.();
  }

  $effect(() => {
    const menu = content;
    if (!open || !menu) return;
    const frame = requestAnimationFrame(() => {
      if (!menu.contains(document.activeElement)) menu.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  });
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
      <Menu.Root onSelect={(details) => onSelect(details.value)} positioning={{ placement: 'right-start', gutter: 2, ...(within ? { strategy: 'fixed' as const } : {}) }}>
        <Menu.TriggerItem class="bava-menu-item">
          <span class="bava-menu-label">{node.label}</span>
          <span class="chevron"><ToolIcon id="chevron" size="sm" /></span>
        </Menu.TriggerItem>
        {#if within}
          <Menu.Positioner>
            <Menu.Content class="bava-menu">
              {@render entries(node.items)}
            </Menu.Content>
          </Menu.Positioner>
        {:else}
          <Portal container={portalRoot()}>
            <Menu.Positioner>
              <Menu.Content class="bava-menu">
                {@render entries(node.items)}
              </Menu.Content>
            </Menu.Positioner>
          </Portal>
        {/if}
      </Menu.Root>
    {/if}
  {/each}
{/snippet}

<Menu.Root
  {open}
  positioning={within ? { ...atPoint(() => anchor), strategy: 'fixed' } : atPoint(() => anchor)}
  lazyMount
  unmountOnExit
  onOpenChange={(details) => onOpenChange(details.open)}
  onSelect={(details) => onSelect(details.value)}
  onExitComplete={() => queueMicrotask(closed)}
>
  {#if within}
    <Menu.Positioner>
      <Menu.Content class="bava-menu" bind:ref={content}>
        {@render entries(items)}
      </Menu.Content>
    </Menu.Positioner>
  {:else}
    <Portal container={portalRoot()}>
      <Menu.Positioner>
        <Menu.Content class="bava-menu" bind:ref={content}>
          {@render entries(items)}
        </Menu.Content>
      </Menu.Positioner>
    </Portal>
  {/if}
</Menu.Root>

<style>
  /* The menu, its items and separators are styled in `styles/menus.scss`. */
  .keys {
    font-family: var(--font-mono);
    font-size: var(--text-menu-keys);
    color: var(--color-text-muted);
  }

  .chevron {
    display: flex;
    color: var(--color-text-muted);
  }
</style>
