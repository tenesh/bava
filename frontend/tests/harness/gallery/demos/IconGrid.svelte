<script lang="ts">
  import IconGrid from '../../../../src/components/IconGrid.svelte';
  import { createIconPicker } from '../../../../src/shell/icon-picker.svelte';
  import { loadSet } from '../../../../src/canvas/icons/sets';
  import Cell from '../Cell.svelte';

  const custom = () => [
    {
      set: 'custom' as const,
      name: 'acme-billing',
      title: 'acme-billing',
      keywords: [],
      svg: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" fill="#0F766E"/><rect x="3" y="8" width="18" height="3" fill="#F59E0B"/></svg>',
    },
  ];
  // Each grid as the keys and the sets would leave it.
  const grids = [
    { name: 'General, searching', icons: createIconPicker({ load: loadSet, custom }) },
    { name: 'Logos', icons: createIconPicker({ load: loadSet, custom }) },
    { name: 'Custom', icons: createIconPicker({ load: loadSet, custom }) },
    { name: 'loading', icons: createIconPicker({ load: () => new Promise(() => {}), custom }) },
    { name: 'failed', icons: createIconPicker({ load: () => Promise.reject(new Error('gone')), custom }) },
  ];
  grids[0].icons.setQuery('data');
  grids[0].icons.highlight(2);
  grids[1].icons.setTab('logos');
  grids[2].icons.setTab('custom');
</script>

{#each grids as grid, n (grid.name)}
  <Cell name={grid.name} ground="canvas">
    <div class="room">
      <IconGrid icons={grid.icons} listId={`demo-icons-${n}`} optionId={(i) => `demo-icon-${n}-${i}`} onPick={() => {}} />
    </div>
  </Cell>
{/each}

<style>
  .room {
    width: var(--size-insert-panel);
    padding-top: var(--space-3);
    background: var(--color-surface-overlay);
    border: var(--border-width) solid var(--color-border-subtle);
    border-radius: var(--radius-lg);
  }
</style>
