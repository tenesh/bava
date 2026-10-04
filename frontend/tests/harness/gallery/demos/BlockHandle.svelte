<script lang="ts">
  import BlockHandle from '../../../../src/components/BlockHandle.svelte';
  import Cell from '../Cell.svelte';
</script>

{#each [{ name: 'beside a paragraph' }, { name: 'Add hovered, the grip focused', marks: [{ target: '[aria-label="Add a block after"]', force: 'hover' as const }, { target: '[aria-label="Drag, or open the block menu"]', force: 'focus' as const }] }] as each (each.name)}
  <Cell name={each.name} width="26rem" marks={each.marks}>
    <div class="page">
      <BlockHandle at={{ left: 64, top: 0 }} alt="⌥" onAdd={() => {}} onMenu={() => {}} onDragStart={() => {}} onDragEnd={() => {}} />
      <p>A paragraph of the page, with its handle beside it.</p>
    </div>
  </Cell>
{/each}

<style>
  .page {
    position: relative;
    padding-left: 64px;
  }

  p {
    margin: 0;
    color: var(--color-text-prose);
  }
</style>
