<script lang="ts">
  /** Test fixture: a ToolRail whose insert panel opens and closes. */
  import ToolRail from '../ToolRail.svelte';

  let insertOpen = $state(false);
  export function setOpen(open: boolean) {
    insertOpen = open;
  }
</script>

<ToolRail active="select" {insertOpen} onSelect={() => {}} onInsert={() => (insertOpen = !insertOpen)} />
