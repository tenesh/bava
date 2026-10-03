<script lang="ts">
  import InsertPanel from '../../../../../src/components/InsertPanel.svelte';
  import { createInsert } from '../../../../../src/shell/insert.svelte';
  import Cell from '../Cell.svelte';

  const insert = createInsert();
</script>

<Cell name="over the canvas" ground="canvas">
  <div class="room">
    <InsertPanel {insert} onOutcome={() => {}} />
  </div>
</Cell>

<style>
  .room {
    padding: var(--space-4);
  }
</style>
