<script lang="ts">
  /**
   * The Space's name at the top of the side pane; opening it lists recent
   * Spaces and what to do with this one. Wraps Ark's Menu.
   *
   * Presentational: it reports an id, `recent:<path>` for a recent Space.
   */
  import { Menu, Portal } from '@ark-ui/svelte';
  import { portalRoot } from './portal-root';
  import ToolIcon from './ToolIcon.svelte';
  import { spaceInitial as initial, tileFill, tileText } from './space-tile';
  import { t } from '../i18n/t';

  type Props = {
    name: string;
    root: string;
    recents: { path: string; name: string }[];
    onSelect: (id: string) => void;
  };

  let { name, root, recents, onSelect }: Props = $props();

  // The positioner takes a number, so the token is read from the page.
  function menuGutter(): number {
    try {
      return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--size-menu-gutter')) || 0;
    } catch {
      return 0;
    }
  }
  const gutter = menuGutter();
</script>

<Menu.Root onSelect={(details) => onSelect(details.value)} positioning={{ placement: 'bottom-start', gutter }}>
  <Menu.Trigger class="bava-space-switcher" aria-label={t('space.switch')}>
    <span class="tile" style:background={tileFill(name)} style:color={tileText(name)} aria-hidden="true">{initial(name)}</span>
    <span class="name">{name}</span>
    <span class="caret"><ToolIcon id="chevronDown" size="sm" /></span>
  </Menu.Trigger>
  <Portal container={portalRoot()}>
    <Menu.Positioner>
      <Menu.Content class="bava-menu bava-space-menu">
        {#if recents.length > 0}
          <Menu.ItemGroup>
            <Menu.ItemGroupLabel class="bava-menu-group">{t('space.recent')}</Menu.ItemGroupLabel>
            {#each recents as recent (recent.path)}
              <Menu.Item value={`recent:${recent.path}`} class="bava-menu-item">
                <span class="tile small" style:background={tileFill(recent.name)} style:color={tileText(recent.name)} aria-hidden="true">{initial(recent.name)}</span>
                <span class="bava-menu-label">{recent.name}</span>
                {#if recent.path === root}<span class="current"><ToolIcon id="finishLine" size="sm" /></span>{/if}
              </Menu.Item>
            {/each}
          </Menu.ItemGroup>
          <Menu.Separator class="bava-menu-separator" />
        {/if}
        <Menu.Item value="space.new" class="bava-menu-item"><ToolIcon id="insert" size="sm" /><span class="bava-menu-label">{t('space.new')}</span></Menu.Item>
        <Menu.Item value="space.open" class="bava-menu-item"><ToolIcon id="folder" size="sm" /><span class="bava-menu-label">{t('space.open')}</span></Menu.Item>
        <Menu.Item value="file.open" class="bava-menu-item"><ToolIcon id="page" size="sm" /><span class="bava-menu-label">{t('space.openFile')}</span></Menu.Item>
        <Menu.Separator class="bava-menu-separator" />
        <Menu.Item value="space.trash" class="bava-menu-item"><ToolIcon id="delete" size="sm" /><span class="bava-menu-label">{t('space.trash')}</span></Menu.Item>
        <Menu.Item value="space.settings" class="bava-menu-item"><ToolIcon id="settings" size="sm" /><span class="bava-menu-label">{t('space.settings')}</span></Menu.Item>
      </Menu.Content>
    </Menu.Positioner>
  </Portal>
</Menu.Root>

<style>
  :global(.bava-space-switcher) {
    display: flex;
    align-items: center;
    gap: var(--size-row-gap);
    width: calc(100% - var(--space-4));
    height: var(--size-toolbar);
    margin: var(--space-2) var(--space-2) var(--space-half);
    padding: 0 var(--space-2);
    border: 0;
    border-radius: var(--radius-md);
    background: transparent;
    color: var(--color-text-primary);
    font: inherit;
    font-size: var(--text-body);
    font-weight: var(--weight-semibold);
    text-align: left;
  }

  :global(.bava-space-switcher:hover) {
    background: var(--color-accent-subtle);
  }

  :global(.bava-space-switcher[data-state='open']) {
    background: var(--color-selection);
  }

  :global(.bava-space-switcher:focus-visible) {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
  }

  .tile {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: var(--size-space-tile);
    height: var(--size-space-tile);
    flex: none;
    border-radius: var(--radius-md);
    font-size: var(--text-tile-sm);
    font-weight: var(--weight-semibold);
  }

  /* A tile in the menu: a row's height, a little rounder. */
  .tile.small {
    width: var(--size-row-sm);
    height: var(--size-row-sm);
    border-radius: var(--radius-lg);
  }

  .current {
    display: flex;
    color: var(--color-accent);
  }

  /* The switcher's menu: wider than a context menu, with taller rows. */
  :global(.bava-space-menu) {
    width: var(--size-space-menu);
    border-radius: var(--radius-lg);
  }

  :global(.bava-space-menu .bava-menu-item) {
    gap: var(--space-2);
    height: var(--size-space-menu-row);
  }

  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .caret {
    display: flex;
    color: var(--color-text-muted);
  }

  :global(.bava-menu-group) {
    padding: var(--size-row-gap) var(--space-2) var(--space-1);
    font-size: var(--text-label);
    font-weight: var(--weight-semibold);
    letter-spacing: var(--tracking-label);
    text-transform: uppercase;
    color: var(--color-text-muted);
  }
</style>
