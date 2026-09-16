<script lang="ts">
  /**
   * Mount point. Layout lives in Shell; this file owns the imperative
   * libraries and the wiring between them.
   */
  import { onMount } from 'svelte';
  import { CanvasStage } from './canvas/stage';
  import { createScene } from './canvas/scene';
  import { createViewport } from './canvas/viewport';
  import { createTools, toolForKey } from './canvas/tools.svelte';
  import CanvasControls from './components/CanvasControls.svelte';
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
  const canvas = new CanvasStage();
  const scene = createScene();
  const viewport = createViewport();
  const tools = createTools();
  let zoom = $state.raw(viewport.zoom);

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
    canvas.render(scene.data());

    client.request(initialSource);

    // Tool shortcuts are global while the canvas has focus. Ignored while a
    // text field has it, or typing D2 would switch tools on every keystroke.
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, [contenteditable], .cm-editor')) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === 'Escape') {
        tools.escape();
        return;
      }
      const tool = toolForKey(event.key);
      if (tool) tools.activate(tool);
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      client.destroy();
      canvas.destroy();
      pane.destroy();
      theme.destroy();
    };
  });

  // Effects belong at initialisation, not inside onMount: an effect created in
  // a mount callback is orphaned and Svelte throws.
  //
  // The D2 preview is not wired to the canvas in this milestone. The canvas is
  // a drawing surface now, and a rendered diagram becomes an element on it in
  // Milestone 6. The pipeline still runs — diagnostics below prove it — but
  // nothing paints it. Recorded as a known regression.
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
    <div class="canvas-region">
      <div class="fill" bind:this={canvasHost}></div>
      <CanvasControls
        active={tools.active}
        {zoom}
        onSelect={(tool) => tools.activate(tool)}
        onZoom={(direction) => {
          viewport.setZoom(viewport.zoom * (direction === 1 ? 1.2 : 1 / 1.2));
          zoom = viewport.zoom;
        }}
      />
    </div>
  {/snippet}
</Shell>

<style>
  .fill {
    height: 100%;
  }

  .canvas-region {
    position: relative;
    height: 100%;
    background: var(--color-canvas-bg);
  }
</style>
