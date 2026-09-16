<script lang="ts">
  /**
   * Mount point. Layout lives in Shell; this file owns the imperative
   * libraries and the wiring between them.
   */
  import { onMount } from 'svelte';
  import { DiagramCanvas } from './canvas/canvas';
  import { SourcePane } from './editor/source-pane';
  import { createRenderClient } from './ipc/render.svelte';
  import { createTheme } from './styles/theme.svelte';
  import Shell from './shell/Shell.svelte';

  const initialSource = `users: Users {shape: person}
web: Web App {
  api: API
}
db: Postgres {shape: cylinder}

users -> web.api: request
web.api -> db: query
`;

  const client = createRenderClient();
  const theme = createTheme();

  // Constructed at initialisation so the effects below can close over them.
  // They are inert until mounted, and both guard against being used before.
  const pane = new SourcePane();
  const canvas = new DiagramCanvas();

  let sourceHost: HTMLDivElement;
  let canvasHost: HTMLDivElement;

  const nodeCount = $derived(Object.keys(client.state.nodeMap).length);

  onMount(() => {
    // Captured: `bind:this` is nulled when the snippet's DOM is torn down,
    // which happens before this cleanup runs.
    const editorHost = sourceHost;
    const diagramHost = canvasHost;

    pane.mount(editorHost, {
      doc: initialSource,
      onChange: (source) => client.request(source),
    });
    canvas.mount(diagramHost);

    // A click on a shape resolves through the response's nodeMap to source.
    const onCanvasClick = (event: MouseEvent) => {
      const id = canvas.nodeIDForTarget(event.target as Element | null);
      if (!id) return;
      const span = client.state.nodeMap[id];
      if (span) pane.revealRange(span.from, span.to);
    };
    diagramHost.addEventListener('click', onCanvasClick);

    client.request(initialSource);

    return () => {
      diagramHost.removeEventListener('click', onCanvasClick);
      client.destroy();
      canvas.destroy();
      pane.destroy();
      theme.destroy();
    };
  });

  // Effects belong at initialisation, not inside onMount: an effect created in
  // a mount callback is orphaned and Svelte throws.
  $effect(() => {
    canvas.setSVG(client.state.svg);
  });

  $effect(() => {
    pane.setDiagnostics(client.state.errors);
  });
</script>

<Shell
  title="untitled"
  engine="tala"
  nodes={nodeCount}
  errors={client.state.errors.length}
  themeChoice={theme.choice}
  onChooseTheme={(choice) => theme.set(choice)}
>
  {#snippet document()}
    <div class="fill" bind:this={sourceHost}></div>
  {/snippet}

  {#snippet canvas()}
    <div class="fill" bind:this={canvasHost}></div>
  {/snippet}
</Shell>

<style>
  .fill {
    height: 100%;
  }
</style>
