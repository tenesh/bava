<script lang="ts">
  import Icon from '../../../../src/components/Icon.svelte';
  import { PARALLELOGRAM_PATH } from '../../../../src/components/tool-icons';
  import Cell from '../Cell.svelte';
</script>

{#each ['sm', 'md', 'lg'] as const as size (size)}
  <Cell name={size}><Icon path={PARALLELOGRAM_PATH} {size} /></Cell>
{/each}
<Cell name="labelled"><Icon path={PARALLELOGRAM_PATH} label="Parallelogram" /></Cell>
