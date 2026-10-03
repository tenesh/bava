<script lang="ts">
  import Tooltip from '../../../../../src/components/Tooltip.svelte';
  import ToolIcon from '../../../../../src/components/ToolIcon.svelte';
  import Cell from '../Cell.svelte';
</script>

<Cell name="right, with its key" width="14rem" height="4rem">
  <Tooltip label="Rectangle" keys="R" type="button" class="bava-icon-button" aria-label="Rectangle">
    <ToolIcon id="rect" />
  </Tooltip>
</Cell>
<Cell name="above" width="14rem" height="4rem">
  <div class="low">
    <Tooltip label="Align left edges" placement="top" type="button" class="bava-icon-button" aria-label="Align left edges">
      <ToolIcon id="alignLeft" />
    </Tooltip>
  </div>
</Cell>

<style>
  .low {
    padding-top: var(--space-8);
  }
</style>
