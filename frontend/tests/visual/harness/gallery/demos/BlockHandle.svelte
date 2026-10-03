<script lang="ts">
  import BlockHandle from '../../../../../src/components/BlockHandle.svelte';
  import Cell from '../Cell.svelte';
</script>

<Cell name="beside a paragraph" width="26rem">
  <div class="page">
    <BlockHandle at={{ left: 64, top: 0 }} alt="⌥" onAdd={() => {}} onMenu={() => {}} onDragStart={() => {}} onDragEnd={() => {}} />
    <p>A paragraph of the page, with its handle beside it.</p>
  </div>
</Cell>

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
