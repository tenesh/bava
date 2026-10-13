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
  ];
  const icons = createIconPicker({ load: loadSet, custom: () => [] });
  panels[1].insert.highlight(1);
  panels[2].insert.choose(0);
  panels[3].insert.setQuery('dia');
  panels[4].insert.setQuery('diazzz');
  panels[5].insert.choose(panels[5].insert.entries.indexOf(ICON_CATEGORY));
</script>

{#each panels as panel (panel.name)}
  <Cell name={panel.name} ground="canvas">
    <div class="room">
      <InsertPanel insert={panel.insert} {icons} onOutcome={() => {}} />
    </div>
  </Cell>
{/each}

<style>
  .room {
    padding: var(--space-4);
  }
</style>
