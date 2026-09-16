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
  import { createCanvasCommands } from './canvas/commands';
  import type { SceneData } from './canvas/scene';
  import FileTree from './components/FileTree.svelte';
  import ConfirmDialog from './components/ConfirmDialog.svelte';
  import { createFileActions, type Choice, type PromptKind } from './files/actions.svelte';
  import EmptyState from './components/EmptyState.svelte';
  import ShortcutsDialog from './components/ShortcutsDialog.svelte';
  import FilesSection from './settings/FilesSection.svelte';
  import { createSettings } from './settings/settings.svelte';
  import { createRecents } from './files/recents.svelte';
  import { createAutosave } from './files/autosave.svelte';
  import { createViewState } from './shell/view.svelte';
  import { createDispatcher, MENU_COMMAND_EVENT, type Command, type CommandHandlers } from './shell/commands';
  import { editTarget, fieldSelection } from './shell/edit-target';
  import { currentPlatform, matchShortcut, reservedByMenu, shortcutGroups, type MenuSpec } from './shell/shortcuts';
  import menuSpec from '../../internal/app/menu/spec.json';
  import { Clipboard, Events } from '@wailsio/runtime';
  import { FileService, MenuService } from '../bindings/github.com/tenesh/bava/internal/app';
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
  const canvasCommands = createCanvasCommands({ history, selection });
  const view = createViewState();
  const settingsState = createSettings();
  const recents = createRecents();
  const platform = currentPlatform();
  const shortcuts = shortcutGroups(menuSpec as MenuSpec, platform);
  const shortcutFor = matchShortcut(menuSpec as MenuSpec, platform);
  let zoom = $state.raw(viewport.zoom);
  let hasSelection = $state.raw(false);
  let settingsOpen = $state(false);
  let aboutOpen = $state(false);
  let shortcutsOpen = $state(false);
  // A passing message for the status bar: a command or a setting that failed.
  let notice = $state.raw<string | null>(null);
  let noticeTimer: ReturnType<typeof setTimeout> | undefined;

  function reportSettingsError(error: string) {
    if (error) notify(t('error.settingsSave'));
  }

  function notify(message: string) {
    notice = message;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => (notice = null), 6000);
  }

  // The scene itself is not reactive — `canvas.md` forbids reactive geometry —
  // so the current snapshot is published here and the render effect reads it.
  // A counter would work too, but this makes the dependency the actual data.
  let published = $state.raw<SceneData>(history.current);

  // Selection is plain state inside the canvas; the menu's arrange items read
  // this copy of whether anything is selected.
  function syncSelection() {
    hasSelection = canvasCommands.hasSelection;
  }

  function commit() {
    published = history.current;
    syncSelection();
    doc.touch();
    autosave.changed();
  }

  const currentScene = () => ({ version: 1, elements: history.current.elements as never });

  const autosave = createAutosave({
    settings: () => ({ mode: settingsState.autosave, delayMs: settingsState.autosaveDelayMs }),
    document: doc,
    save: () => doc.save(currentScene()),
  });

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

  // Loading a document is not an edit: history starts over, so undo after
  // New or Open cannot bring the previous document's shapes back.
  function loadScene(elements: unknown[]) {
    history.reset({ elements: elements as never });
    selection.clear();
    syncSelection();
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
      reset: () => {
        doc.reset();
        loadScene([]);
        autosave.resume();
      },
      reload: async () => {
        const result = await doc.reload();
        if (result && !result.error) loadScene(result.scene.elements ?? []);
        return result;
      },
    },
    ask,
    currentScene,
    chooseSavePath: async () => {
      const chosen = await FileService.ChooseFileToSave('untitled.md');
      return chosen.path || null;
    },
  });

  // Every way of opening a document ends here: the menu, recents, the tree.
  async function openPath(path: string) {
    if (!(await fileActions.open(path))) return;
    recents.add(path);
    autosave.resume();
    // Opening a file also opens the folder it lives in, so its siblings appear.
    await workspace.open(path.replace(/[\\/][^\\/]*$/, ''));
  }

  async function openFile() {
    const chosen = await FileService.ChooseFileToOpen();
    if (chosen.path) await openPath(chosen.path);
  }

  async function afterSave(saved: boolean) {
    if (!saved) return;
    // A save by hand settles whatever paused autosave.
    autosave.resume();
    if (doc.path) recents.add(doc.path);
    await workspace.refresh();
  }

  const save = async () => afterSave(await fileActions.save());
  const saveAs = async () => afterSave(await fileActions.saveAs());

  function zoomTo(next: number) {
    viewport.setZoom(next);
    zoom = viewport.zoom;
  }

  /**
   * Edit commands arrive from the menu, not as key presses, so they go
   * wherever focus is: the source editor, a text field, or the canvas — and
   * nowhere when the canvas is hidden or a dialog has focus.
   */
  async function routeEdit(actions: {
    source: () => void | Promise<void>;
    field: () => void | Promise<void>;
    canvas: () => void | Promise<void>;
  }) {
    const target = editTarget(document.activeElement, { canvasVisible: view.showsCanvas });
    if (target !== 'none') await actions[target]();
  }

  // The system clipboard goes through Wails rather than the browser: webview
  // clipboard access differs per platform and asks permission on some.
  // The canvas keeps its own clipboard of scene elements.
  const clipboardHandlers = {
    copy: () =>
      routeEdit({
        source: () => Clipboard.SetText(pane.selectedText()).then(() => {}),
        field: () => Clipboard.SetText(fieldSelection(document.activeElement)).then(() => {}),
        canvas: () => void canvasCommands.copy(),
      }),
    cut: () =>
      routeEdit({
        source: async () => {
          await Clipboard.SetText(pane.selectedText());
          pane.replaceSelection('');
        },
        field: async () => {
          await Clipboard.SetText(fieldSelection(document.activeElement));
          document.execCommand('delete');
        },
        canvas: () => {
          if (canvasCommands.cut()) commit();
        },
      }),
    paste: () =>
      routeEdit({
        source: async () => pane.replaceSelection(await Clipboard.Text()),
        field: async () => void document.execCommand('insertText', false, await Clipboard.Text()),
        canvas: () => {
          if (canvasCommands.paste()) commit();
        },
      }),
  };

  // Deprecated, but it is the only way to ask the browser to act on a plain
  // text field as if the key had been pressed.
  const fieldCommand = (name: string) => () => void document.execCommand(name);

  const canvasEdit = (run: () => void) => () => {
    run();
    commit();
  };

  const handlers: CommandHandlers = {
    'app.about': () => {
      aboutOpen = true;
    },
    'app.settings': () => {
      settingsOpen = true;
    },
    'file.new': async () => {
      await fileActions.create();
    },
    'file.open': openFile,
    'file.openRecent': async (path) => {
      if (path) await openPath(path);
    },
    'file.save': save,
    'file.saveAs': saveAs,
    'file.settings': () => {
      settingsOpen = true;
    },

    'edit.undo': () =>
      routeEdit({ source: () => pane.undo(), field: fieldCommand('undo'), canvas: canvasEdit(canvasCommands.undo) }),
    'edit.redo': () =>
      routeEdit({ source: () => pane.redo(), field: fieldCommand('redo'), canvas: canvasEdit(canvasCommands.redo) }),
    'edit.cut': clipboardHandlers.cut,
    'edit.copy': clipboardHandlers.copy,
    'edit.paste': clipboardHandlers.paste,
    'edit.selectAll': () =>
      routeEdit({
        source: () => pane.selectAll(),
        field: fieldCommand('selectAll'),
        canvas: () => {
          canvasCommands.selectAll();
          syncSelection();
        },
      }),
    'edit.delete': () =>
      routeEdit({
        source: fieldCommand('delete'),
        field: fieldCommand('delete'),
        canvas: canvasEdit(canvasCommands.deleteSelection),
      }),

    'view.document': () => view.setMode('document'),
    'view.both': () => view.setMode('both'),
    'view.canvas': () => view.setMode('canvas'),
    'view.files': () => view.toggleFiles(),
    'view.ai': () => view.toggleAI(),
    'view.zoomIn': () => zoomTo(viewport.zoom * 1.2),
    'view.zoomOut': () => zoomTo(viewport.zoom / 1.2),
    'view.actualSize': () => zoomTo(1),
    'view.theme.light': () => theme.set('light'),
    'view.theme.dark': () => theme.set('dark'),
    'view.theme.system': () => theme.set('system'),

    'tool.select': () => tools.activate('select'),
    'tool.rect': () => tools.activate('rect'),
    'tool.ellipse': () => tools.activate('ellipse'),
    'tool.arrow': () => tools.activate('arrow'),
    'tool.line': () => tools.activate('line'),
    'tool.pen': () => tools.activate('pen'),
    'tool.text': () => tools.activate('text'),
    'tool.frame': () => tools.activate('frame'),

    'canvas.group': canvasEdit(canvasCommands.group),
    'canvas.ungroup': canvasEdit(canvasCommands.ungroup),
    'canvas.bringToFront': canvasEdit(canvasCommands.bringToFront),
    'canvas.sendToBack': canvasEdit(canvasCommands.sendToBack),

    'help.shortcuts': () => {
      shortcutsOpen = true;
    },
    'help.about': () => {
      aboutOpen = true;
    },
  };

  const dispatcher = createDispatcher(handlers, {
    // Shown, and logged locally: there is nowhere to report to, by design.
    onError: (id, error) => {
      console.error(`menu command ${id} failed`, error);
      notify(t('error.command'));
    },
  });

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
      isReserved: reservedByMenu(menuSpec as MenuSpec, platform),
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
      // Canvas keys stand down while typing, inside a dialog, or with the
      // canvas hidden — Backspace must not empty a canvas nobody can see.
      const typing =
        editTarget(event.target as Element | null, { canvasVisible: view.showsCanvas }) !== 'canvas';

      const handled = handleKey(event, {
        deleteSelection: canvasEdit(canvasCommands.deleteSelection),
        selectNext: () => {
          selection.selectNext(history.current);
          syncSelection();
        },
        selectPrevious: () => {
          selection.selectPrevious(history.current);
          syncSelection();
        },
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
          syncSelection();
          published = history.current;
        },
        activateTool: (tool) => tools.activate(tool),
      }, { typing });

      if (handled) event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);

    // Shortcuts on punctuation keys cannot be native accelerators — Wails on
    // Windows never matches them — so the page handles them, in the capture
    // phase so no editor or field answers first.
    const onShortcut = (event: KeyboardEvent) => {
      const id = shortcutFor(event);
      if (!id) return;
      event.preventDefault();
      event.stopPropagation();
      void dispatcher.dispatch({ id });
    };
    window.addEventListener('keydown', onShortcut, true);

    const onBlur = () => void autosave.focusLost();
    window.addEventListener('blur', onBlur);

    const offMenu = Events.On(MENU_COMMAND_EVENT, (event) => {
      void dispatcher.dispatch(event.data as Command);
    });

    void settingsState.load().catch((error: unknown) => {
      console.error('settings failed to load', error);
      notify(t('error.settingsLoad'));
    });

    return () => {
      offMenu();
      window.removeEventListener('keydown', onShortcut, true);
      clearTimeout(noticeTimer);
      window.removeEventListener('blur', onBlur);
      autosave.destroy();
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

  // The native menu shows checks and enabled items from this state. Go never
  // guesses at it; the frontend reports every change.
  $effect(() => {
    const state = {
      viewMode: view.mode,
      showsFiles: view.showsFiles,
      showsAI: view.showsAI,
      theme: theme.choice,
      tool: tools.active,
      hasSelection,
      recents: recents.paths,
    };
    void MenuService.SetState(state).catch(() => {
      // Outside the app shell — a test, a plain browser — there is no menu.
    });
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
  status={notice ??
    (autosave.pauseReason === 'conflict'
      ? t('status.autosavePaused')
      : autosave.pauseReason === 'error'
        ? t('status.autosaveFailed')
        : undefined)}
  themeChoice={theme.choice}
  onChooseTheme={(choice) => theme.set(choice)}
  {view}
  bind:settingsOpen
>
  {#snippet settings()}
    <FilesSection
      mode={settingsState.autosave}
      delayMs={settingsState.autosaveDelayMs}
      onModeChange={(mode) => void settingsState.setAutosave(mode).then(reportSettingsError)}
      onDelayChange={(ms) => void settingsState.setAutosaveDelay(ms).then(reportSettingsError)}
    />
  {/snippet}

  {#snippet files()}
    {#if workspace.root}
      <FileTree
        entries={workspace.entries}
        activePath={doc.path}
        onActivate={(path) => void openPath(path)}
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

<ShortcutsDialog
  bind:open={shortcutsOpen}
  title={t('shortcuts.title')}
  groups={shortcuts}
  onOpenChange={(open) => (shortcutsOpen = open)}
/>

{#if aboutOpen}
  <ConfirmDialog
    open
    title={t('about.title')}
    body={t('about.body')}
    options={[{ value: 'close', label: t('about.close'), primary: true }]}
    onChoose={() => (aboutOpen = false)}
  />
{/if}

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

  .canvas-region {
    position: relative;
    height: 100%;
    background: var(--color-canvas-bg);
  }
</style>
