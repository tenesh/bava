<script lang="ts">
  import InsertPanel from '../../../../src/components/InsertPanel.svelte';
  import { createInsert } from '../../../../src/shell/insert.svelte';
  import Cell from '../Cell.svelte';

  // Each panel's model set as the keys and pointer would leave it.
  const panels = [
    { name: 'the categories', insert: createInsert() },
    { name: 'a row hovered', insert: createInsert() },
    { name: 'a category', insert: createInsert() },
    { name: 'a search', insert: createInsert() },
    { name: 'nothing matching', insert: createInsert() },
  ];
  panels[1].insert.highlight(1);
  panels[2].insert.choose(0);
  panels[3].insert.setQuery('dia');
  panels[4].insert.setQuery('diazzz');
</script>

{#each panels as panel (panel.name)}
  <Cell name={panel.name} ground="canvas">
    <div class="room">
      <InsertPanel insert={panel.insert} onOutcome={() => {}} />
    </div>
  </Cell>
{/each}

<style>
  .room {
    padding: var(--space-4);
  }
</style>
