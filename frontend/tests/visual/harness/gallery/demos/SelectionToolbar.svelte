<script lang="ts">
  import SelectionToolbar from '../../../../../src/components/SelectionToolbar.svelte';
  import type { LineAction, ToolbarControl } from '../../../../../src/canvas/toolbar';
  import type { PropertyKey, PropertyValue, StyleKey } from '../../../../../src/canvas/style';
  import Cell from '../Cell.svelte';

  type Current = string | null | 'mixed' | 'unavailable';
  type Bar = {
    name: string;
    styles: Record<StyleKey, Current>;
    controls: ToolbarControl[];
    properties: Partial<Record<PropertyKey, PropertyValue | 'mixed'>>;
    align: boolean;
    distribute: boolean;
    capacity?: number;
    lineActions?: LineAction[];
    showMore?: boolean;
  };

  // The controls in the order the toolbar's model gives them.
  const SHAPE: ToolbarControl[] = [
    { id: 'fill', group: 'colour', kind: 'colour' },
    { id: 'stroke', group: 'colour', kind: 'colour' },
    { id: 'color', group: 'colour', kind: 'colour' },
    { id: 'strokeWidth', group: 'stroke', kind: 'options' },
    { id: 'strokeStyle', group: 'stroke', kind: 'options' },
    { id: 'edges', group: 'stroke', kind: 'options' },
    { id: 'opacity', group: 'stroke', kind: 'slider' },
    { id: 'fontSize', group: 'label', kind: 'options' },
    { id: 'align', group: 'label', kind: 'options' },
    { id: 'verticalAlign', group: 'label', kind: 'options' },
  ];
  const ARROW: ToolbarControl[] = [
    { id: 'stroke', group: 'colour', kind: 'colour' },
    { id: 'color', group: 'colour', kind: 'colour' },
    { id: 'strokeWidth', group: 'stroke', kind: 'options' },
    { id: 'strokeStyle', group: 'stroke', kind: 'options' },
    { id: 'opacity', group: 'stroke', kind: 'slider' },
    { id: 'arrowType', group: 'arrow', kind: 'options' },
    { id: 'startArrowhead', group: 'arrow', kind: 'options' },
    { id: 'endArrowhead', group: 'arrow', kind: 'options' },
  ];
  const shapeProps = { strokeWidth: 2, strokeStyle: 'solid', edges: 'round', opacity: 100, fontSize: 16, align: 'center', verticalAlign: 'middle' };

  const bars: Bar[] = [
    { name: 'one shape', styles: { fill: 'blue', stroke: null, color: null }, controls: SHAPE, properties: shapeProps, align: false, distribute: false },
    { name: 'three shapes, colours mixed', styles: { fill: 'mixed', stroke: 'mixed', color: '#d9480f' }, controls: SHAPE, properties: { ...shapeProps, strokeWidth: 'mixed' }, align: true, distribute: true },
    { name: 'an arrow', styles: { fill: 'unavailable', stroke: 'red', color: null }, controls: ARROW, properties: { strokeWidth: 2, strokeStyle: 'dashed', opacity: 80, arrowType: 'elbow', startArrowhead: 'none', endArrowhead: 'arrow' }, align: false, distribute: false, lineActions: ['editPoints'] },
    { name: 'a line, closed', styles: { fill: 'green', stroke: null, color: 'unavailable' }, controls: SHAPE.slice(0, 7), properties: shapeProps, align: false, distribute: false, lineActions: ['editPoints', 'openLine'] },
    { name: 'drawing a line by clicks', styles: { fill: 'unavailable', stroke: 'unavailable', color: 'unavailable' }, controls: [], properties: {}, align: false, distribute: false, lineActions: ['finishLine'], showMore: false },
    { name: 'narrow: the rest in More', styles: { fill: 'blue', stroke: null, color: null }, controls: SHAPE, properties: shapeProps, align: true, distribute: false, capacity: 4 },
  ];
</script>

<div class="column">
  {#each bars as bar (bar.name)}
    <Cell name={bar.name}>
      <SelectionToolbar
        styles={bar.styles}
        controls={bar.controls}
        properties={bar.properties}
        align={bar.align}
        distribute={bar.distribute}
        capacity={bar.capacity}
        lineActions={bar.lineActions}
        showMore={bar.showMore}
        keysFor={(id) => (id === 'canvas.alignLeft' ? '⌥A' : '')}
        onApply={() => {}}
        onProperty={() => {}}
        onCommand={() => {}}
        onMore={() => {}}
        onLine={() => {}}
      />
    </Cell>
  {/each}
</div>

<style>
  .column {
    display: flex;
    flex-direction: column;
  }
</style>
