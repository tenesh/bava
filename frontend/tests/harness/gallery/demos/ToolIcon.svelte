<script lang="ts">
  import ToolIcon from '../../../../src/components/ToolIcon.svelte';
  import { ICON_IDS } from '../../../../src/components/tool-icons';
  import Cell from '../Cell.svelte';
</script>

<Cell name="every icon, md">
  <div class="grid">
    {#each ICON_IDS as id (id)}
      <div class="glyph"><ToolIcon {id} /><span class="id">{id}</span></div>
    {/each}
  </div>
</Cell>
<Cell name="sm, md, lg">
  <div class="sizes">
    {#each ['sm', 'md', 'lg'] as const as size (size)}<ToolIcon id="rect" {size} />{/each}
  </div>
</Cell>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(10, 6rem);
    gap: var(--space-2);
  }

  .glyph {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-1);
    color: var(--color-text-primary);
  }

  .id {
    font-size: var(--text-label);
    color: var(--color-text-faint);
  }

  .sizes {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }
</style>
