<script lang="ts">
  import DiagramDialog from '../../../../src/components/DiagramDialog.svelte';
  import type { Direction, LayoutEngine } from '../../../../src/settings/layout-engine';
  import { DIAGRAM_SVG } from '../data';

  let { variant }: { variant: string } = $props();

  let open = $state(true);
  // svelte-ignore state_referenced_locally
  let engine = $state<LayoutEngine>(variant === 'dagre' ? 'dagre' : 'tala');
  let direction = $state<Direction>('right');

  const SOURCE = 'web -> api: requests\napi -> db: reads\n';
  const BROKEN = 'web -> api: requests\napi -> {\n';

  // svelte-ignore state_referenced_locally
  const setUp =
    variant === 'error'
      ? { source: BROKEN, preview: DIAGRAM_SVG, shapes: 3, errors: [{ message: 'unexpected end of file: missing closing }', from: 26, to: 27, line: 2 }] }
      : variant === 'empty'
        ? { source: '', preview: '', shapes: 0, errors: [] }
        : { source: SOURCE, preview: DIAGRAM_SVG, shapes: 3, errors: [] };
</script>

<DiagramDialog
  bind:open
  source={setUp.source}
  preview={setUp.preview}
  errors={setUp.errors}
  pending={false}
  shapes={setUp.shapes}
  {engine}
  {direction}
  onEngine={(next) => (engine = next)}
  onDirection={(next) => (direction = next)}
  onSource={() => {}}
  onInsert={() => {}}
  onOpenChange={(next) => (open = next)}
/>
