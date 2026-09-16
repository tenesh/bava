<script lang="ts">
  import { onMount } from 'svelte';
  import { DiagramCanvas } from './canvas/canvas';
  import { SourcePane } from './editor/source-pane';
  import { createRenderClient } from './ipc/render.svelte';
  import { createTheme } from './styles/theme.svelte';

  // Milestone 1 shell: two panes, structural CSS only. Replaced by the app
  // shell in Milestone 3.
  //
  // Both values it carried as Milestone 2 debt — the divider width and its
  // colour — now resolve from tokens.

  const initialSource = `users: Users {shape: person}
web: Web App {
  api: API
}
db: Postgres {shape: cylinder}

users -> web.api: request
web.api -> db: query
`;

  const client = createRenderClient();
  // Sets data-theme on <html>, which is what the token layer keys off.
  const theme = createTheme();

  let sourceHost: HTMLDivElement;
  let canvasHost: HTMLDivElement;

  // Imperative libraries: created in onMount, destroyed in the cleanup return,
  // never handed reactive props.
  // Constructed at initialisation so the effects below can close over them.
  // They are inert until mounted, and both guard against being used before.
  const pane = new SourcePane();
  const canvas = new DiagramCanvas();

  onMount(() => {
    pane.mount(sourceHost, {
      doc: initialSource,
      onChange: (source) => client.request(source),
    });
    canvas.mount(canvasHost);

    // A click on a shape resolves through the response's nodeMap to source.
    const onCanvasClick = (event: MouseEvent) => {
      const id = canvas.nodeIDForTarget(event.target as Element | null);
      if (!id) return;
      const span = client.state.nodeMap[id];
      if (span) pane.revealRange(span.from, span.to);
    };
    canvasHost.addEventListener('click', onCanvasClick);

    client.request(initialSource);

    return () => {
      canvasHost.removeEventListener('click', onCanvasClick);
      client.destroy();
      canvas.destroy();
      pane.destroy();
      theme.destroy();
    };
  });

  // Effects belong at initialisation, not inside onMount: an effect created in
  // a mount callback is orphaned and Svelte throws. Data flows into the canvas
  // from here; the canvas itself never reads reactive state.
  $effect(() => {
    canvas.setSVG(client.state.svg);
  });

  $effect(() => {
    pane.setDiagnostics(client.state.errors);
  });
</script>

<div class="shell">
  <section class="pane pane-source" aria-label="D2 source">
    <div class="fill" bind:this={sourceHost}></div>
  </section>
  <section class="pane pane-canvas" aria-label="Diagram">
    <div class="fill" bind:this={canvasHost}></div>
  </section>
</div>

<style>
  .shell {
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
    height: 100%;
  }

  .pane {
    min-width: 0;
    min-height: 0;
    overflow: auto;
  }

  .pane-canvas {
    border-inline-start: var(--border-width) solid var(--color-border-subtle);
  }

  .fill {
    height: 100%;
  }
</style>
