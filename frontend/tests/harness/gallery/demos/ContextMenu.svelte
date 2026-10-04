<script lang="ts">
  import ContextMenu from '../../../../src/components/ContextMenu.svelte';
  import { contextMenuFor } from '../../../../src/canvas/context-menu';
  import Cell from '../Cell.svelte';

  // Two shapes selected, something to paste, and a locked shape elsewhere.
  const items = contextMenuFor({ units: 2, canGroup: true, canUngroup: false, canPaste: true, canPasteStyles: false, hasLocked: true }, 'darwin');

  let open = $state(false);
  let anchor = $state<{ x: number; y: number } | null>(null);
</script>

<Cell name="right-click on the canvas" width="20rem" height="6rem" ground="canvas">
  <div
    class="area"
    role="presentation"
    oncontextmenu={(event) => {
      event.preventDefault();
      anchor = { x: event.clientX, y: event.clientY };
      open = true;
    }}
  ></div>
</Cell>
<ContextMenu {items} {open} {anchor} onSelect={() => {}} onOpenChange={(next) => (open = next)} />

<style>
  .area {
    height: 100%;
  }
</style>
