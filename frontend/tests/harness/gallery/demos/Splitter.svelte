<script lang="ts">
  import Splitter from '../../../../src/components/Splitter.svelte';
  import Cell from '../Cell.svelte';

  const states: { name: string; force?: 'hover' | 'focus' }[] = [
    { name: 'side by side' },
    { name: 'hovered', force: 'hover' },
    { name: 'focused', force: 'focus' },
  ];
</script>

<!-- Each splitter's panel ids are its own, as the page holds several; the text is the first word. -->
{#snippet panel(id: string)}
  <p class="text">{id.split(' ')[0]}</p>
{/snippet}

{#each states as each (each.name)}
  <Cell name={each.name} width="201px" height="6rem" force={each.force} target={each.name === 'side by side' ? undefined : '.bava-splitter-handle'}>
    <Splitter panels={[{ id: `Files ${each.name}`, size: 50, minSize: 20 }, { id: `Page ${each.name}`, size: 50, minSize: 20 }]} {panel} />
  </Cell>
{/each}

<Cell name="stacked" width="10rem" height="201px" ground="nav">
  <Splitter orientation="vertical" panels={[{ id: 'Files', size: 50, minSize: 20 }, { id: 'Media', size: 50, minSize: 20 }]} {panel} />
</Cell>

<style>
  .text {
    margin: var(--space-2);
    color: var(--color-text-secondary);
  }
</style>
