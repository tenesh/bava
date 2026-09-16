<script lang="ts">
  /**
   * Mount point. Layout lives in Shell; this file owns the imperative
   * libraries and the wiring between them.
   */
  import { onMount } from 'svelte';
  import { CanvasStage } from './canvas/stage';
  import { createViewport } from './canvas/viewport';
  import { createTools } from './canvas/tools.svelte';
  import CanvasControls from './components/CanvasControls.svelte';
  import { SourcePane } from './editor/source-pane';
  import { createRenderClient } from './ipc/render.svelte';
  import { createTheme } from './styles/theme.svelte';
  import Shell from './shell/Shell.svelte';
  import { createDocument } from './files/document.svelte';
  import { createWorkspace } from './files/workspace.svelte';
  import { createHistory } from './canvas/history';
  import { createSelection } from './canvas/selection';
  import { createPointerHandler } from './canvas/pointer';
  import { handleKey } from './canvas/keymap';
  import { paste as pasteInto } from './canvas/edit';
  import { createScene as sceneFrom, type SceneData, type SceneElement } from './canvas/scene';
  import FileTree from './components/FileTree.svelte';
  import ConfirmDialog from './components/ConfirmDialog.svelte';
  import { createFileActions, type Choice, type PromptKind } from './files/actions.svelte';
  import EmptyState from './components/EmptyState.svelte';
  import { FileService } from '../bindings/github.com/tenesh/bava/internal/app';
  import { t } from './i18n/t';

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
  const viewport = createViewport();
  const doc = createDocument();
  const workspace = createWorkspace();
  const tools = createTools();
  const history = createHistory({ elements: [] });
  const selection = createSelection();
  const pointer = createPointerHandler({ history, selection, tools });
  let zoom = $state.raw(viewport.zoom);
  let clipboard: SceneElement[] = [];

  // The scene itself is not reactive — `canvas.md` forbids reactive geometry —
  // so the current snapshot is published here and the render effect reads it.
  // A counter would work too, but this makes the dependency the actual data.
  let published = $state.raw<SceneData>(history.current);

  function commit() {
    published = history.current;
    doc.touch();
  }

  // A prompt waiting for an answer, and the resolver its caller awaits.
  let prompt = $state.raw<{ kind: PromptKind; resolve: (choice: Choice) => void } | null>(null);

  function ask(kind: PromptKind): Promise<Choice> {
    return new Promise((resolve) => {
      prompt = { kind, resolve };
    });
  }

  function answer(choice: string) {
    const pending = prompt;
    prompt = null;
    pending?.resolve(choice as Choice);
  }

  // Loading a file replaces the scene. It goes through history like every
  // other change, so the canvas has one source of truth.
  function loadScene(elements: unknown[]) {
    history.mutate((draft) => {
      draft.elements.length = 0;
      for (const element of elements) draft.elements.push(element as never);
    });
    published = history.current;
  }

  const fileActions = createFileActions({
    document: {
      get path() {
        return doc.path;
      },
      get dirty() {
        return doc.dirty;
      },
      open: async (path) => {
        const result = await doc.open(path);
        if (!result.error) loadScene(result.scene.elements ?? []);
        return result;
      },
      save: (scene, options) => doc.save(scene, options),
      saveAs: (path, scene) => doc.saveAs(path, scene),
      reload: async () => {
        const result = await doc.reload();
        if (result && !result.error) loadScene(result.scene.elements ?? []);
        return result;
      },
    },
    ask,
    currentScene: () => ({ version: 1, elements: history.current.elements as never }),
    chooseSavePath: async () => {
      const chosen = await FileService.ChooseFileToSave('untitled.md');
      return chosen.path || null;
    },
  });

  async function openFile() {
    const chosen = await FileService.ChooseFileToOpen();
    if (!chosen.path) return;
    await fileActions.open(chosen.path);
    // "Open" also opens the folder the file lives in, so its siblings appear.
    if (doc.path === chosen.path) {
      await workspace.open(chosen.path.replace(/[\\/][^\\/]*$/, ''));
    }
  }

  async function save() {
    await fileActions.save();
    await workspace.refresh();
  }

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
    canvas.render(history.current);

    const scenePoint = (event: PointerEvent) => {
      const rect = diagramHost.getBoundingClientRect();
      return viewport.screenToScene({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    };

    const onDown = (event: PointerEvent) => {
      diagramHost.setPointerCapture(event.pointerId);
      pointer.down(scenePoint(event), { additive: event.shiftKey });
    };
    const onMove = (event: PointerEvent) => pointer.move(scenePoint(event));
    const onUp = (event: PointerEvent) => {
      pointer.up(scenePoint(event));
      commit();
    };

    diagramHost.addEventListener('pointerdown', onDown);
    diagramHost.addEventListener('pointermove', onMove);
    diagramHost.addEventListener('pointerup', onUp);

    client.request(initialSource);

    // Tool shortcuts are global while the canvas has focus. Ignored while a
    // text field has it, or typing D2 would switch tools on every keystroke.
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = Boolean(target?.closest('input, textarea, [contenteditable], .cm-editor'));

      const handled = handleKey(event, {
        undo: () => {
          history.undo();
          commit();
        },
        redo: () => {
          history.redo();
          commit();
        },
        copy: () => {
          clipboard = history.current.elements.filter((e) => selection.has(e.id));
        },
        paste: () => {
          if (clipboard.length === 0) return;
          const working = sceneFrom({ elements: [...history.current.elements] as never });
          pasteInto(working, clipboard as never);
          history.mutate((draft) => {
            draft.elements.length = 0;
            for (const element of working.data().elements) draft.elements.push(element as never);
          });
          commit();
        },
        selectAll: () => selection.selectAll(history.current),
        deleteSelection: () => {
          const ids = new Set(selection.ids);
          if (ids.size === 0) return;
          history.mutate((draft) => {
            draft.elements = draft.elements.filter((e) => !ids.has(e.id));
          });
          selection.clear();
          commit();
        },
        selectNext: () => selection.selectNext(history.current),
        selectPrevious: () => selection.selectPrevious(history.current),
        nudge: (dx, dy) => {
          const ids = new Set(selection.ids);
          if (ids.size === 0) return;
          history.mutate((draft) => {
            for (const element of draft.elements) {
              if (!ids.has(element.id)) continue;
              element.x += dx;
              element.y += dy;
            }
          });
          commit();
        },
        escape: () => {
          tools.escape();
          selection.clear();
          published = history.current;
        },
        activateTool: (tool) => tools.activate(tool),
      }, { typing });

      if (handled) event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      diagramHost.removeEventListener('pointerdown', onDown);
      diagramHost.removeEventListener('pointermove', onMove);
      diagramHost.removeEventListener('pointerup', onUp);
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

  // Repaint when a new snapshot is published.
  $effect(() => {
    canvas.render(published);
  });
</script>

<Shell
  title={doc.path ?? t('file.untitled')}
  dirty={doc.dirty}
  engine="tala"
  nodes={nodeCount}
  errors={client.state.errors.length}
  themeChoice={theme.choice}
  onChooseTheme={(choice) => theme.set(choice)}
>
  {#snippet actions()}
    <button type="button" class="titlebar-action" onclick={openFile}>{t('file.open')}</button>
    <button type="button" class="titlebar-action" onclick={save}>{t('file.save')}</button>
  {/snippet}

  {#snippet files()}
    {#if workspace.root}
      <FileTree
        entries={workspace.entries}
        activePath={doc.path}
        onActivate={(path) => void fileActions.open(path)}
      />
    {:else}
      <EmptyState title={t('file.noFolder')} body={t('file.noFolderBody')} />
    {/if}
  {/snippet}
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

{#if prompt?.kind === 'unsaved'}
  <ConfirmDialog
    open
    title={t('file.unsaved.title')}
    body={t('file.unsaved.body')}
    options={[
      { value: 'cancel', label: t('file.cancel') },
      { value: 'discard', label: t('file.unsaved.discard') },
      { value: 'save', label: t('file.unsaved.save'), primary: true },
    ]}
    onChoose={answer}
  />
{:else if prompt?.kind === 'conflict'}
  <ConfirmDialog
    open
    title={t('file.conflict.title')}
    body={t('file.conflict.body')}
    options={[
      { value: 'cancel', label: t('file.cancel') },
      { value: 'reload', label: t('file.conflict.reload') },
      { value: 'overwrite', label: t('file.conflict.overwrite'), primary: true },
    ]}
    onChoose={answer}
  />
{/if}

<style>
  .fill {
    height: 100%;
  }

  .titlebar-action {
    height: var(--size-row);
    padding: 0 var(--space-3);
    border: var(--border-width) solid transparent;
    border-radius: var(--radius-sm);
    background: transparent;
    font: inherit;
    font-size: var(--text-control);
    color: var(--color-text-secondary);
  }

  .titlebar-action:focus-visible {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
  }

  .canvas-region {
    position: relative;
    height: 100%;
    background: var(--color-canvas-bg);
  }
</style>
