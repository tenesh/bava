<script lang="ts">
  import CanvasControls from '../../../../src/components/CanvasControls.svelte';
  import Cell from '../Cell.svelte';

  let zooms = $state([1, 0.25, 4]);
</script>

{#each zooms as zoom, index (index)}
  <Cell name={`${Math.round(zoom * 100)}%`} width="12rem" height="4.5rem" ground="canvas">
    <CanvasControls {zoom} onZoom={(direction) => (zooms[index] = zoom * (direction === 1 ? 1.2 : 1 / 1.2))} />
  </Cell>
{/each}

<Cell
  name="Zoom out hovered, Zoom in pressed"
  width="12rem"
  height="4.5rem"
  ground="canvas"
  marks={[
    { target: '[aria-label="Zoom out"]', force: 'hover' },
    { target: '[aria-label="Zoom in"]', force: 'active' },
  ]}
>
  <CanvasControls zoom={1} onZoom={() => {}} />
</Cell>
<Cell name="Zoom in focused" width="12rem" height="4.5rem" ground="canvas" force="focus" target="[aria-label=&quot;Zoom in&quot;]">
  <CanvasControls zoom={1} onZoom={() => {}} />
</Cell>
