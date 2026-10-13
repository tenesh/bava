<script lang="ts">
  import InsertPanel from '../../../../src/components/InsertPanel.svelte';
  import { createInsert, ICON_CATEGORY } from '../../../../src/shell/insert.svelte';
  import { createIconPicker } from '../../../../src/shell/icon-picker.svelte';
  import { loadSet } from '../../../../src/canvas/icons/sets';
  import Cell from '../Cell.svelte';

  // Each panel's model set as the keys and pointer would leave it.
  const panels = [
    { name: 'the categories', insert: createInsert() },
    { name: 'a row hovered', insert: createInsert() },
    { name: 'a category', insert: createInsert() },
    { name: 'a search', insert: createInsert() },
    { name: 'nothing matching', insert: createInsert() },
    { name: 'the Icon category', insert: createInsert() },
    { name: 'the Custom tab', insert: createInsert() },
  ];
  const custom = async () => [
    {
      set: 'custom' as const,
      name: 'acme-billing',
      title: 'acme-billing',
      keywords: [],
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><rect x="3" y="5" width="18" height="14" rx="2" fill="#0F766E"/><rect x="3" y="8" width="18" height="3" fill="#F59E0B"/></svg>',
    },
  ];
  const icons = createIconPicker({ load: loadSet, custom: async () => [] });
  // Its own picker, on its Custom tab, with what the tab does to the library.
  const customIcons = createIconPicker({ load: loadSet, custom });
  customIcons.setTab('custom');
  const library = { add() {}, showFolder() {}, rename: async () => '', remove: async () => '' };
  panels[1].insert.highlight(1);
  panels[2].insert.choose(0);
  panels[3].insert.setQuery('dia');
  panels[4].insert.setQuery('diazzz');
  panels[5].insert.choose(panels[5].insert.entries.indexOf(ICON_CATEGORY));
  panels[6].insert.choose(panels[6].insert.entries.indexOf(ICON_CATEGORY));
</script>

{#each panels as panel (panel.name)}
  <Cell name={panel.name} ground="canvas">
    <div class="room">
      {#if panel.name === 'the Custom tab'}
        <InsertPanel insert={panel.insert} icons={customIcons} {library} onOutcome={() => {}} />
      {:else}
        <InsertPanel insert={panel.insert} {icons} onOutcome={() => {}} />
      {/if}
    </div>
  </Cell>
{/each}

<style>
  .room {
    padding: var(--space-4);
  }
</style>
