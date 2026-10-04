<script lang="ts">
  import ViewSwitcher from '../../../../src/components/ViewSwitcher.svelte';
  import type { ViewMode } from '../../../../src/shell/view.svelte';
  import Cell from '../Cell.svelte';

  const views = $state<ViewMode[]>(['document', 'both', 'canvas']);
</script>

{#each views as view, index (index)}
  <Cell name={view}><ViewSwitcher value={view} onValueChange={(next) => (views[index] = next)} /></Cell>
{/each}
