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
  import ToolRail from './components/ToolRail.svelte';
  import InsertPanel from './components/InsertPanel.svelte';
  import { createInsert } from './shell/insert.svelte';
  import ContextMenu from './components/ContextMenu.svelte';
  import { contextMenuFor, contextSelection, overflowMenu, parseOverflowId, type MenuNode } from './canvas/context-menu';
  import { nudged, topLevel } from './canvas/edit';
  import { createScene, isLocked } from './canvas/scene';
  import { carriedWith } from './canvas/containment';
  import { angleOfElement } from './canvas/rotate';
  import { createExporter, exportIO } from './canvas/export/exporter.svelte';
  import { CodeEditor, commitCode, fitToCode } from './canvas/code/editor';
  import { createCodeRuns } from './canvas/code/runs';
  import { measureCode } from './canvas/code/measure';
  import { invalidateAdvanceOnFontLoad } from './canvas/code/advance';
  import { monoAdvance } from './canvas/code/advance';
  import ExportDialog from './components/ExportDialog.svelte';
  import { topmostAt } from './canvas/eraser';
  import { SourcePane } from './editor/source-pane';
  import { createRenderClient } from './ipc/render.svelte';
  import DiagramDialog from './components/DiagramDialog.svelte';
  import { createDiagramDialog } from './shell/diagram-dialog.svelte';
  import { toElements } from './canvas/import/convert';
  import { createTheme } from './styles/theme.svelte';
  import Shell from './shell/Shell.svelte';
  import { createDocument, sceneToSave } from './files/document.svelte';
  import { createWorkspace } from './files/workspace.svelte';
  import { createHistory } from './canvas/history';
  import { createSelection } from './canvas/selection';
  import { createPointerHandler } from './canvas/pointer';
  import { cursorFor } from './canvas/cursor';
  import { createCurrentStyle } from './canvas/current-style';
  import { smoothPoints } from './canvas/curves';
  import { pathOf, labelField } from './canvas/arrows';
  import { keepsBrowserMenu } from './shell/native-menu';
  import { endTextPlacement, freeEndAt, insertTextAtEnd } from './canvas/arrow-text';
  import { frameThrottle } from './canvas/frame-throttle';
  import { bindingReach } from './canvas/binding';
  import { paintFor } from './canvas/paint';
  import { handleKey } from './canvas/keymap';
  import { createCanvasCommands } from './canvas/commands';
  import { wheelAction } from './canvas/navigation';
  import { LabelEditor, commitLabel, commitText, editableAt, insertText, labelBox } from './canvas/label-editor';
  import { canvasLineWidth, measureFor } from './canvas/text-measure';
  import { wrapLines } from './canvas/text-layout';
  import { applyStyle, currentProperty, currentStyle, CODE_FONT_SIZE, setProperty, type PropertyKey } from './canvas/style';
  import SelectionToolbar from './components/SelectionToolbar.svelte';
  import { toolbarFor, type LineAction, type ToolbarControl } from './canvas/toolbar';
  import { closeLine, openLine } from './canvas/closed';
  import { readRootVariable } from './canvas/palette';
  import type { SceneData, SceneElement } from './canvas/scene';
  import FileTree from './components/FileTree.svelte';
  import ConfirmDialog from './components/ConfirmDialog.svelte';
  import { createFileActions, type Choice, type PromptKind } from './files/actions.svelte';
  import EmptyState from './components/EmptyState.svelte';
  import Splash from './components/Splash.svelte';
  import { createLaunch, LAUNCH_CAP_MS } from './shell/launch.svelte';
  import ShortcutsDialog from './components/ShortcutsDialog.svelte';
  import AboutDialog from './components/AboutDialog.svelte';
  import ErrorDialog from './components/ErrorDialog.svelte';
  import { installErrorHandlers, report } from './ipc/log';
  import { createErrorPolicy, type GoError, type GoNotice } from './shell/errors.svelte';
  import FilesSection from './settings/FilesSection.svelte';
  import AdvancedSection from './settings/AdvancedSection.svelte';
  import CanvasSection from './settings/CanvasSection.svelte';
  import { createSettings } from './settings/settings.svelte';
  import { createRecents } from './files/recents.svelte';
  import { createAutosave } from './files/autosave.svelte';
  import { createViewState } from './shell/view.svelte';
  import { createDispatcher, MENU_COMMAND_EVENT, type Command, type CommandHandlers } from './shell/commands';
  import { canvasKeyStandsDown, editTarget, fieldSelection } from './shell/edit-target';
  import {
    canvasScoped,
    currentPlatform,
    keysFor,
    matchShortcut,
    reservedByMenu,
    shortcutGroups,
    type MenuSpec,
  } from './shell/shortcuts';
  import menuSpec from '../../internal/app/menu/spec.json';
  import { Clipboard, Events } from '@wailsio/runtime';
  import { ExportService, FileService, LogService, MenuService } from '../bindings/github.com/tenesh/bava/internal/app';
  import { t } from './i18n/t';

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
  // Set when the canvas is mounted: puts the right cursor on it now.
  let cursorUpdate: (() => void) | null = null;
  // A new tool is a new cursor, before the pointer moves.
  $effect(() => {
    void tools.active;
    cursorUpdate?.();
  });
  // The style a new element takes: the last chosen, for this session (06.15).
  const newElementStyle = createCurrentStyle();
  const pointer = createPointerHandler({
    history,
    selection,
    tools,
    newStyle: (type) => newElementStyle.for(type),
    bindingEnabled: () => settingsState.arrowBinding,
    midpointSnap: () => settingsState.midpointSnap,
    // Half a handle's on-screen side, in scene units at the current zoom.
    handleSize: () => (parseFloat(readRootVariable('--size-selection-handle')) || 0) / 2 / viewport.zoom,
    // Half the trail's on-screen width, in scene units: what the trail visibly covers.
    eraserTolerance: () => (parseFloat(readRootVariable('--size-eraser-trail')) || 0) / 2 / viewport.zoom,
    // How near a click counts as hitting a line, in scene units at this zoom.
    hitTolerance,
    // How near an arrow end must come to a shape to attach, at this zoom.
    bindingReach: () => bindingReach(viewport.zoom),
    // The shortest segment that offers a bend, in scene units at this zoom.
    bendMinSegment: () => (parseFloat(readRootVariable('--size-bend-min-segment')) || 0) / viewport.zoom,
    // How near a press must come to a line's point, in scene units at this zoom.
    pointHit: () => (parseFloat(readRootVariable('--size-point-hit')) || 0) / viewport.zoom,
    segmentMin: () => (parseFloat(readRootVariable('--size-point-handle')) || 0) / 2 / viewport.zoom,
    pointHandle: () => (parseFloat(readRootVariable('--size-point-handle')) || 0) / viewport.zoom,
    bentBoxPadding: () => (parseFloat(readRootVariable('--size-bent-box-padding')) || 0) / viewport.zoom,
    labelDrag: () => (parseFloat(readRootVariable('--size-label-drag')) || 0) / viewport.zoom,
    bendInsertDistance: () => (parseFloat(readRootVariable('--size-bend-insert')) || 0) / viewport.zoom,
    minLinear: () => (parseFloat(readRootVariable('--size-min-linear')) || 0) / viewport.zoom,
    confirmDistance: () => (parseFloat(readRootVariable('--size-line-confirm')) || 0) / viewport.zoom,
    // An arrow's label as the stage draws it, for sliding it along the arrow.
    labelBounds: (id) => canvas.labelBounds(id),
    // How far a press must travel to be a drag, in scene units at this zoom.
    dragThreshold: () => (parseFloat(readRootVariable('--size-drag-threshold')) || 0) / viewport.zoom,
    // The rotate handle's distance above the selection, as the stage draws it.
    rotateGap: () => (parseFloat(readRootVariable('--size-rotate-gap')) || 0) / viewport.zoom,
    // A placed code block is sized the way a committed one is.
    codeMetrics,
  });
  // A code block pasted a new size re-wraps and grows to its code (06.17).
  const canvasCommands = createCanvasCommands({ history, selection, afterPasteStyle: (element) => fitToCode(element, codeMetrics(element)) });

  /** How near a click counts as hitting a line, in scene units at the current zoom. */
  function hitTolerance() {
    return (parseFloat(readRootVariable('--size-hit-tolerance')) || 0) / viewport.zoom;
  }

  /** The editor that opens over a code block, and the block it is on. */
  let codeEditor: CodeEditor | null = null;

  /**
   * The metrics a code block is measured and drawn with, from the tokens, at
   * the block's own size when given one (06.17).
   */
  function codeMetrics(element?: SceneElement) {
    // Absent means the file format's 13, as the stage draws it.
    const size = (element as { fontSize?: number } | undefined)?.fontSize ?? CODE_FONT_SIZE;
    return {
      advance: monoAdvance(size, readRootVariable('--font-mono').trim()),
      lineHeight: size * (parseFloat(readRootVariable('--leading-code')) || 0),
      padding: parseFloat(readRootVariable('--size-code-padding')) || 0,
    };
  }

  /**
   * The tokenised code every drawing path reads: the stage as it arrives, and
   * an export from the same map, so a file cannot be coloured differently
   * from the canvas it came from.
   */
  const codeRuns = createCodeRuns({ onRuns: (id, runs) => canvas.setCodeRuns(id, runs) });

  const highlightBlocks = (scene: SceneData) => codeRuns.update(scene);

  /** Open the editor over a code block, sized and placed as it is drawn. */
  function editCode(element: SceneElement) {
    if (!codeEditor) return;
    const block = element as SceneElement & { code: string; language?: string };
    const topLeft = viewport.sceneToScreen({ x: element.x, y: element.y });
    void codeEditor.open({
      code: block.code,
      language: block.language,
      rect: {
        x: topLeft.x,
        y: topLeft.y,
        width: Math.max(element.w, 1) * viewport.zoom,
        height: Math.max(element.h, 1) * viewport.zoom,
      },
      angle: angleOfElement(element),
      zoom: viewport.zoom,
      // Typed at the block's own size.
      // Its stylesheet's size is the code token: scaled from that to the block's.
      fontScale: ((element as { fontSize?: number }).fontSize ?? CODE_FONT_SIZE) / (parseFloat(readRootVariable('--text-code')) || CODE_FONT_SIZE),
      isReserved: reservedByMenu(menuSpec as MenuSpec, platform),
      // Grows as it is typed in, measured as the block will be on commit.
      measure: (code) => {
        // At the block's width: it wraps, and only grows taller.
        const size = measureCode(code, codeMetrics(element), element.w);
        // A block made taller than its code keeps that height while typed in.
        return { width: size.width * viewport.zoom, height: Math.max(size.height, element.h) * viewport.zoom };
      },
      onCommit: (code) => {
        commitCode(history, element.id, code, codeMetrics(element));
        commit();
        void highlightBlocks(history.current);
      },
    });
  }

  // Diagram from code: its own render client, so previewing a diagram being
  // written never disturbs the document's own render, and the debounce and
  // staleness rules come with it.
  const diagramClient = createRenderClient();
  let diagramOpen = $state.raw(false);
  // What the dialog's preview is laid out with, and so what Insert uses.
  const diagramDialog = createDiagramDialog({
    request: (source, layout) => diagramClient.request(source, layout),
    defaultEngine: () => settingsState.layoutEngine,
    saveDefault: async (engine) => reportSettingsError(await settingsState.setLayoutEngine(engine)),
  });

  function openDiagramDialog() {
    if (!canvasShown()) return;
    diagramOpen = true;
    diagramDialog.open(DIAGRAM_STARTER);
  }

  /** What the dialog opens with: enough to show that something happens. */
  const DIAGRAM_STARTER = 'a -> b';

  function insertDiagram() {
    const layout = diagramClient.state.layout;
    if (layout.shapes.length === 0 && layout.connections.length === 0) return;
    // Centred on what the user is looking at, at the diagram's own size.
    const centre = viewport.screenToScene({
      x: (canvasHostEl?.clientWidth ?? 0) / 2,
      y: (canvasHostEl?.clientHeight ?? 0) / 2,
    });
    canvasCommands.insertDiagram(toElements(layout, { at: centre }));
    // The engine used becomes the default, so the next dialog opens with it;
    // the document is laid out with the default, so it is laid out again.
    void diagramDialog.inserted().then((changed) => {
      if (changed) client.request(pane.doc, { engine: settingsState.layoutEngine });
    });
    diagramOpen = false;
    commit();
    syncSelection();
  }
  // Export: the dialog's settings and what each button does. The drawing
  // itself is pure code under `canvas/export/`.
  const exporter = createExporter({
    scene: () => history.current,
    selection: () => selection.ids,
    documentName: () => doc.path?.replace(/^.*[\\/]/, '') || t('file.untitled'),
    notify,
    codeRuns: () => codeRuns.all(),
    // The columns an export draws on are the ones the canvas measured.
    monoAdvance: () => codeMetrics().advance,
    io: exportIO({
      choosePath: async (suggested) => (await FileService.ChooseFileToSave(suggested)).path || null,
      save: (path, contents) => ExportService.Save(path, contents),
    }),
  });
  // Drawn when the dialog is open or a setting changes, never from inside the
  // markup: the preview swaps `data-theme` for the length of the draw, which
  // has no business happening during a render pass.
  const exportPreview = $derived(exporter.isOpen ? exporter.preview() : '');

  const view = createViewState();
  const settingsState = createSettings();
  const recents = createRecents();
  const platform = currentPlatform();
  const shortcuts = shortcutGroups(menuSpec as MenuSpec, platform);
  const shortcutFor = matchShortcut(menuSpec as MenuSpec, platform);
  const canvasOnly = canvasScoped(menuSpec as MenuSpec);
  let zoom = $state.raw(viewport.zoom);
  let hasSelection = $state.raw(false);
  // Whether Copy Styles has copied anything, for the native menu.
  let canPasteStyles = $state.raw(false);
  let settingsOpen = $state(false);
  // The right-click menu, and where it opens.
  let contextMenu = $state.raw<{ items: MenuNode[]; anchor: { x: number; y: number } } | null>(null);

  function selectionInfo() {
    const selected = history.current.elements.filter((e) => selection.has(e.id));
    const units = topLevel(createScene(history.current), selected).length;
    return {
      units,
      canGroup: units >= 2,
      canUngroup: selected.some((e) => e.type === 'group'),
      canPaste: canvasCommands.canPaste,
      canPasteStyles: canvasCommands.canPasteStyles,
      hasLocked: canvasCommands.hasLocked,
    };
  }

  /**
   * Opened after the event that asked for it has finished: opened during it,
   * the same right-click reaches the menu's outside-interaction check and
   * closes it at once.
   */
  function openContextMenu(anchor: { x: number; y: number }, overflow: ToolbarControl[] = []) {
    const items = [...contextMenuFor(selectionInfo()), ...overflowMenu(overflow)];
    setTimeout(() => (contextMenu = { items, anchor }));
  }

  // The insert panel beside the rail.
  let insertOpen = $state(false);
  const insert = createInsert();

  function openInsertPanel() {
    insert.reset();
    insertOpen = true;
  }

  /** Close the panel; the rail gives focus back to its + button. */
  function closeInsertPanel() {
    insertOpen = false;
  }
  let aboutOpen = $state(false);
  let shortcutsOpen = $state(false);
  // A passing message for the status bar: a command or a setting that failed.
  let notice = $state.raw<string | null>(null);
  let noticeTimer: ReturnType<typeof setTimeout> | undefined;

  // The canvas is on screen only with a document open and a view that shows it.
  // Hidden, it takes no keys: Backspace must not empty a canvas nobody can see.
  const canvasShown = () => doc.isOpen && view.showsCanvas;

  // The splash covers the window until settings and fonts have loaded.
  const settingsLoad = settingsState.load();
  const launch = createLaunch({
    settings: settingsLoad,
    // jsdom has no FontFaceSet.
    fonts: document.fonts?.ready ?? Promise.resolve(),
    capMs: LAUNCH_CAP_MS,
  });

  // The ways out of the no-file state, with the keys the menu binds.
  const noFileHints = [
    { keys: keysFor(menuSpec as MenuSpec, 'file.open', platform), label: t('empty.noFile.open') },
    { keys: keysFor(menuSpec as MenuSpec, 'file.new', platform), label: t('empty.noFile.new') },
  ];

  const errors = createErrorPolicy({ notify: () => notify(t('error.another')), translate: t });

  const errorText = {
    unexpected: { title: t('error.unexpected.title'), body: t('error.unexpected.body') },
    unexpectedExit: { title: t('error.unexpectedExit.title'), body: t('error.unexpectedExit.body') },
    webviewReloaded: { title: t('error.webviewReloaded.title'), body: t('error.webviewReloaded.body') },
  };

  async function copyText(text: string, confirmation: string) {
    await Clipboard.SetText(text);
    notify(confirmation);
  }

  async function openLogsFolder() {
    if (await LogService.OpenLogsFolder()) notify(t('error.logsUnavailable'));
  }

  function reportSettingsError(error: string) {
    if (error) notify(t('error.settingsSave'));
  }

  function notify(message: string) {
    notice = message;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => (notice = null), 6000);
  }

  // The scene itself is not reactive (`canvas.md` forbids reactive geometry),
  // so the current snapshot is published here and the render effect reads it.
  // A counter would work too, but this makes the dependency the actual data.
  let published = $state.raw<SceneData>(history.current);

  // Selection is plain state inside the canvas; the menu's arrange items read
  // this copy of whether anything is selected.
  // The selection's ids, published for the colour bar; selection itself is
  // plain state inside the canvas.
  let selectedIds = $state.raw<string[]>([]);
  // The pointer's modes, published as the selection is: a line being drawn
  // by clicks (the toolbar is its Done button), and the line in point editing.
  let drawingByClicks = $state(false);
  let editingPointsOf = $state<string | null>(null);
  const toolbar = $derived(toolbarFor(published, selectedIds, { drawing: drawingByClicks, editing: editingPointsOf }));
  /** What each property control shows for the selection. */
  const toolbarProperties = $derived(
    Object.fromEntries(
      toolbar.controls
        .filter((control) => control.kind !== 'colour')
        .map((control) => [control.id, currentProperty(published, selectedIds, control.id as PropertyKey)]),
    ),
  );
  /**
   * How many controls the row has room for. A control is a square button plus
   * its gap; the row keeps a margin either side of the canvas. Until the first
   * measurement the row shows everything: measuring happens before paint, and
   * a guessed number here would be a second copy of the tokens.
   */
  let toolbarCapacity = $state.raw(Number.POSITIVE_INFINITY);

  function measureToolbar(width: number) {
    // The tokens are the only source for these sizes; without a stylesheet
    // (a test, a plain browser) nothing is measured and the row stays whole.
    const button = parseFloat(readRootVariable('--size-row'));
    const gap = parseFloat(readRootVariable('--space-1'));
    const margin = parseFloat(readRootVariable('--space-6')) * 2;
    if (!Number.isFinite(button + gap + margin)) return;
    toolbarCapacity = Math.max(1, Math.floor((width - margin) / (button + gap)));
  }

  // Changing tool finishes a line being drawn click by click, as Excalidraw's,
  // and keeps the tool picked; Line to Arrow and back finishes it too.
  let drawingWith = tools.active;
  $effect(() => {
    const tool = tools.active;
    if (tool !== drawingWith && pointer.drawingPoints) {
      pointer.finishPoints({ keepTool: true });
      canvas.setBindingCandidates([]);
      commit();
      canvas.render(history.current);
    }
    drawingWith = tool;
  });

  function syncSelection() {
    hasSelection = canvasCommands.hasSelection;
    selectedIds = selection.ids;
    canvas.setSelection(selection.ids);
    // Point editing (06.13) is drawn with the selection it belongs to.
    canvas.setPointEditing(pointer.editingPoints);
    drawingByClicks = pointer.drawingPoints;
    editingPointsOf = pointer.editingPoints?.id ?? null;
  }

  /** A line action from the toolbar (06.15). */
  function onLineAction(action: LineAction) {
    if (action === 'finishLine') {
      pointer.finishPoints();
      canvas.setBindingCandidates([]);
      commit();
      canvas.render(history.current);
      return;
    }
    if (action === 'editPoints') {
      const [id] = selection.ids;
      if (id !== undefined && pointer.editPoints(id)) syncSelection();
      return;
    }
    const [id] = selection.ids;
    if (id === undefined) return;
    if (action === 'closeLine') closeLine(history, id);
    else openLine(history, id);
    commit();
  }

  function commit() {
    // A gesture or command that changed nothing (a click, a selection) is not
    // an edit: it must not mark the document unsaved or wake autosave.
    const changed = published !== history.current;
    // Undo can remove a selected element; its id must not stay selected.
    selection.retain(history.current.elements.map((e) => e.id));
    published = history.current;
    syncSelection();
    if (!changed) return;
    doc.touch();
    autosave.changed();
  }

  // The opened scene's version and unknown top-level keys travel back with
  // the elements, so a save keeps what a newer Bava wrote.
  const currentScene = () => sceneToSave(doc.sceneExtra, history.current.elements);

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

  // With nothing open there is nothing to save.
  const save = async () => {
    if (doc.isOpen) await afterSave(await fileActions.save());
  };
  const saveAs = async () => {
    if (doc.isOpen) await afterSave(await fileActions.saveAs());
  };

  let canvasHostEl: HTMLDivElement | null = null;

  let labelEditor: LabelEditor | null = null;

  /**
   * Measure text as the stage draws it: in the element's own font, line by
   * line. A new text element has no font size yet, so it takes the defaults.
   */
  function measurerFor(element: SceneElement | null) {
    const font = paintFor(element ?? ({ type: 'text' } as SceneElement), readRootVariable).font;
    return (text: string) => measureFor(text, font);
  }

  /** Open the editor over a shape's label, a frame's label, or a text element. */
  function editElement(element: SceneElement) {
    if (!labelEditor) return;
    const isText = element.type === 'text';
    const isArrow = element.type === 'arrow';
    const measure = measurerFor(element);
    const paint = paintFor(element, readRootVariable);
    // The box the stage draws the text in, so the field wraps and sits as the
    // text will be drawn.
    const lineWidth = canvasLineWidth(`${paint.font.size}px ${paint.font.family}`);
    // An arrow's label is typed where it is drawn: on its spot, at its wrap
    // width, turned with it (06.17); it opened over the arrow's box before.
    const field = isArrow ? arrowLabelField(element, paint, lineWidth) : null;
    const box = field ?? labelBox(element, parseFloat(readRootVariable('--size-label-inset')) || 0);
    const topLeft = viewport.sceneToScreen({ x: box.x, y: box.y });
    canvas.setEditing(element.id);
    labelEditor.open({
      value: isText ? (element as { text: string }).text : ((element as { label?: string }).label ?? ''),
      rect: { x: topLeft.x, y: topLeft.y, width: box.w * viewport.zoom, height: box.h * viewport.zoom },
      angle: field ? field.angle : angleOfElement(element),
      growCentred: field !== null,
      // An arrow's label is always centred on its path, whatever it stores.
      font: isArrow ? { ...paint.font, align: 'center', verticalAlign: 'middle' } : paint.font,
      opacity: paint.opacity,
      zoom: viewport.zoom,
      measure: isText ? onScreen(measure) : undefined,
      // A label's wrapped height on screen, for its vertical alignment; an
      // arrow's field is the label's own box, wrapped as the stage wraps it.
      textHeight: isText
        ? undefined
        : (value) => wrapLines(value, box.w, lineWidth).length * paint.font.size * paint.font.lineHeight * viewport.zoom,
      onCommit: (value) => {
        canvas.setEditing(null);
        if (isText) commitText(history, element.id, value, measure);
        else commitLabel(history, element.id, value);
        commit();
      },
    });
  }

  /** The field for an arrow's label, in scene space: where the stage draws the label. */
  function arrowLabelField(element: SceneElement, paint: ReturnType<typeof paintFor>, measure: (text: string) => number) {
    const drawn = smoothPoints(pathOf(('points' in element ? element.points : []) as number[], (element as { arrowType?: string }).arrowType), paint.tension);
    return labelField(element, drawn, paint.tension, paint.font, measure);
  }

  /** Free text's size on screen: its scene measurement at the current zoom. */
  function onScreen(measure: (text: string) => { width: number; height: number }) {
    return (text: string) => {
      const size = measure(text);
      return { width: size.width * viewport.zoom, height: size.height * viewport.zoom };
    };
  }

  /** Place new text: nothing enters history until something is typed. */
  function placeText(point: { x: number; y: number }) {
    if (!labelEditor) return;
    const measure = measurerFor(null);
    const paint = paintFor({ type: 'text' } as SceneElement, readRootVariable);
    // By a free arrow end, decided now, so the field opens where the text
    // will land: its side the arrow points at on the tip (06.16, B29).
    const end = freeEndAt(history.current, point, (parseFloat(readRootVariable('--size-point-hit')) || 0) / viewport.zoom);
    const placement = end ? endTextPlacement(history.current, end) : null;
    const line = paint.font.size * paint.font.lineHeight;
    const start = placement
      ? // The field grows rightward as it is typed into, so only its
        // vertical anchor can be honoured while typing; the text settles on
        // commit.
        { x: placement.at.x, y: placement.at.y - placement.anchor[1] * line }
      : point;
    const screen = viewport.sceneToScreen(start);
    labelEditor.open({
      value: '',
      rect: { x: screen.x, y: screen.y, width: 0, height: 0 },
      measure: onScreen(measure),
      font: paint.font,
      zoom: viewport.zoom,
      onCommit: (value) => {
        // By a free arrow end, the text is that end's, and the end attaches
        // to it (06.16, B29); anywhere else, free text where it was clicked.
        const placed = end ? insertTextAtEnd(history, end, value, measure) : insertText(history, point, value, measure);
        if (placed) commit();
      },
    });
  }

  function editSelection() {
    const ids = selection.ids;
    if (ids.length !== 1) return;
    const element = history.current.elements.find((e) => e.id === ids[0]);
    if (element && (editableAt({ elements: [element] }, { x: element.x, y: element.y }, hitTolerance()) || element.type === 'frame')) {
      editElement(element);
    }
  }

  /** Push the viewport to the stage and the zoom readout. */
  function applyView() {
    // The editor sits over an element's old place; finish it before the view moves.
    labelEditor?.commit();
    canvas.setViewport({ zoom: viewport.zoom, pan: viewport.pan });
    zoom = viewport.zoom;
  }

  /** Zoom about a screen point; the canvas centre when none is given. */
  function zoomTo(next: number, around?: { x: number; y: number }) {
    const centre = around ?? {
      x: (canvasHostEl?.clientWidth ?? 0) / 2,
      y: (canvasHostEl?.clientHeight ?? 0) / 2,
    };
    viewport.zoomAt(centre, next);
    applyView();
  }

  /**
   * Edit commands arrive from the menu, not as key presses, so they go
   * wherever focus is: the source editor, a text field, or the canvas; and
   * nowhere when the canvas is hidden or a dialog has focus.
   */
  /**
   * The source editor with focus: the document's pane, or another source pane
   * (the Diagram from Code dialog's). An edit command acts on the one the user
   * is typing in, never on one they cannot see.
   */
  function focusedSource(): SourcePane {
    return SourcePane.containing(document.activeElement) ?? pane;
  }

  async function routeEdit(actions: {
    source: () => void | Promise<void>;
    field: () => void | Promise<void>;
    canvas: () => void | Promise<void>;
    /** The editor over a code block, which keeps its own history. */
    code?: () => void | Promise<void>;
  }) {
    const target = editTarget(document.activeElement, { canvasVisible: canvasShown() });
    if (target === 'none') return;
    // A code block's editor owns its keys; where a command has nothing
    // sensible to do there, it does nothing rather than reaching past it.
    const action = target === 'code' ? actions.code : actions[target];
    await action?.();
  }

  // The system clipboard goes through Wails rather than the browser: webview
  // clipboard access differs per platform and asks permission on some.
  // The canvas keeps its own clipboard of scene elements.
  const clipboardHandlers = {
    copy: () =>
      routeEdit({
        source: () => Clipboard.SetText(focusedSource().selectedText()).then(() => {}),
        code: () => Clipboard.SetText(codeEditor?.selectedText() ?? '').then(() => {}),
        field: () => Clipboard.SetText(fieldSelection(document.activeElement)).then(() => {}),
        canvas: () => void canvasCommands.copy(),
      }),
    cut: () =>
      routeEdit({
        source: async () => {
          const editor = focusedSource();
          await Clipboard.SetText(editor.selectedText());
          editor.replaceSelection('');
        },
        code: async () => {
          await Clipboard.SetText(codeEditor?.selectedText() ?? '');
          codeEditor?.replaceSelection('');
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
        source: async () => {
          // Chosen before the await: focus can move while the clipboard is read.
          const editor = focusedSource();
          editor.replaceSelection(await Clipboard.Text());
        },
        code: async () => codeEditor?.replaceSelection(await Clipboard.Text()),
        field: async () => void document.execCommand('insertText', false, await Clipboard.Text()),
        canvas: () => {
          if (canvasCommands.paste()) commit();
        },
      }),
  };

  // Deprecated, but it is the only way to ask the browser to act on a plain
  // text field as if the key had been pressed.
  const fieldCommand = (name: string) => () => void document.execCommand(name);

  // A canvas command edits only a canvas on screen. Canvas shortcuts reach the
  // page whatever is showing, and committing marks the document changed: with
  // nothing open, that asked "save changes?" about a document that did not exist.
  const canvasEdit = (run: () => void) => () => {
    if (!canvasShown()) return;
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
    'file.export': () => exporter.open({ onlySelected: false }),
    'insert.diagram': openDiagramDialog,

    'edit.undo': () =>
      routeEdit({
        source: () => focusedSource().undo(),
        code: () => codeEditor?.undo(),
        field: fieldCommand('undo'),
        // Not mid-gesture, a line drawn by clicks included (06.16, O1).
        canvas: () => {
          if (!pointer.holdsHistory) canvasEdit(canvasCommands.undo)();
        },
      }),
    'edit.redo': () =>
      routeEdit({
        source: () => focusedSource().redo(),
        code: () => codeEditor?.redo(),
        field: fieldCommand('redo'),
        canvas: () => {
          if (!pointer.holdsHistory) canvasEdit(canvasCommands.redo)();
        },
      }),
    'edit.cut': clipboardHandlers.cut,
    'edit.copy': clipboardHandlers.copy,
    'edit.paste': clipboardHandlers.paste,
    'edit.selectAll': () =>
      routeEdit({
        source: () => focusedSource().selectAll(),
        code: () => codeEditor?.selectAll(),
        field: fieldCommand('selectAll'),
        canvas: () => {
          // In point editing, Select All does nothing (06.15, as Excalidraw).
          if (pointer.selectAll()) return;
          canvasCommands.selectAll();
          syncSelection();
        },
      }),
    'edit.delete': () =>
      routeEdit({
        source: fieldCommand('delete'),
        field: fieldCommand('delete'),
        canvas: () => {
          // In point editing, the selected points (none: nothing), as the key does.
          if (pointer.deletePoints()) {
            commit();
            return;
          }
          canvasEdit(canvasCommands.deleteSelection)();
        },
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
    'tool.code': () => tools.activate('code'),
    'tool.eraser': () => tools.activate('eraser'),
    'tool.diamond': () => tools.activate('diamond'),
    'tool.cylinder': () => tools.activate('cylinder'),
    'tool.hexagon': () => tools.activate('hexagon'),
    'tool.parallelogram': () => tools.activate('parallelogram'),
    'tool.document': () => tools.activate('document'),
    'tool.person': () => tools.activate('person'),
    'tool.cloud': () => tools.activate('cloud'),

    'canvas.group': canvasEdit(canvasCommands.group),
    'canvas.ungroup': canvasEdit(canvasCommands.ungroup),
    'canvas.bringToFront': canvasEdit(canvasCommands.bringToFront),
    'canvas.sendToBack': canvasEdit(canvasCommands.sendToBack),
    'canvas.bringForward': canvasEdit(canvasCommands.bringForward),
    'canvas.sendBackward': canvasEdit(canvasCommands.sendBackward),
    'canvas.flipHorizontal': canvasEdit(canvasCommands.flipHorizontal),
    'canvas.flipVertical': canvasEdit(canvasCommands.flipVertical),
    // Edit the selected line's or arrow's points (06.15, P2); not an elbow's.
    'canvas.editPoints': () => {
      const [id] = selection.ids;
      if (!canvasShown() || selection.ids.length !== 1 || id === undefined) return;
      if (pointer.editPoints(id)) syncSelection();
    },
    // In point editing, the selected points (06.15, P16); otherwise the selection.
    'canvas.duplicate': () => {
      if (canvasShown() && pointer.duplicatePoints()) {
        commit();
        return;
      }
      canvasEdit(canvasCommands.duplicate)();
    },
    'canvas.lock': canvasEdit(canvasCommands.lock),
    'canvas.unlockAll': canvasEdit(canvasCommands.unlockAll),
    'canvas.copyPng': () => {
      if (canvasShown()) void exporter.copyFromMenu('png');
    },
    'canvas.copySvg': () => {
      if (canvasShown()) void exporter.copyFromMenu('svg');
    },
    'canvas.exportSelection': () => {
      if (canvasShown()) exporter.open({ onlySelected: true });
    },
    'canvas.copyStyles': () => {
      if (!canvasShown()) return;
      canvasCommands.copyStyles();
      canPasteStyles = canvasCommands.canPasteStyles;
    },
    'canvas.pasteStyles': canvasEdit(canvasCommands.pasteStyles),
    'canvas.alignLeft': canvasEdit(() => canvasCommands.align('left')),
    'canvas.alignCenter': canvasEdit(() => canvasCommands.align('center')),
    'canvas.alignRight': canvasEdit(() => canvasCommands.align('right')),
    'canvas.alignTop': canvasEdit(() => canvasCommands.align('top')),
    'canvas.alignMiddle': canvasEdit(() => canvasCommands.align('middle')),
    'canvas.alignBottom': canvasEdit(() => canvasCommands.align('bottom')),
    'canvas.distributeHorizontal': canvasEdit(() => canvasCommands.distribute('horizontal')),
    'canvas.distributeVertical': canvasEdit(() => canvasCommands.distribute('vertical')),

    'help.shortcuts': () => {
      shortcutsOpen = true;
    },
    'help.openLogs': () => openLogsFolder(),
    'help.copyDiagnostics': async () => {
      await copyText(await LogService.Diagnostics(navigator.userAgent), t('error.diagnosticsCopied'));
    },
    'help.about': () => {
      aboutOpen = true;
    },
  };

  const dispatcher = createDispatcher(handlers, {
    // Shown, and logged locally: there is nowhere to report to, by design.
    onError: (id, error) => {
      void report(error, `command:${id}`);
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
    canvasHostEl = diagramHost;

    pane.mount(editorHost, {
      doc: '',
      // Laid out with the configured engine, which the status bar names.
      onChange: (source) => client.request(source, { engine: settingsState.layoutEngine }),
      isReserved: reservedByMenu(menuSpec as MenuSpec, platform),
    });
    // A mono advance measured before Geist Mono resolves would be stored in
    // the user's file; the first measurement after it loads replaces it.
    invalidateAdvanceOnFontLoad();
    canvas.mount(diagramHost);
    canvas.render(history.current);
    // Text wrapped before Geist loaded was measured with a fallback; wrap it
    // again once fonts arrive. jsdom has no FontFaceSet.
    const onFontsLoaded = () => canvas.invalidate();
    document.fonts?.addEventListener('loadingdone', onFontsLoaded);
    void highlightBlocks(history.current);

    const scenePoint = (event: PointerEvent) => {
      const rect = diagramHost.getBoundingClientRect();
      return viewport.screenToScene({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    };

    const screenPoint = (event: { clientX: number; clientY: number }) => {
      const rect = diagramHost.getBoundingClientRect();
      return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    // Panning by dragging: with the middle button, or with Space held.
    let spaceHeld = false;
    let panningFrom: { x: number; y: number } | null = null;

    // Where the pointer last was during a drag, so a modifier pressed without
    // moving it can redraw the preview.
    let lastDragPoint: { x: number; y: number } | null = null;
    // Where the pointer last was over the canvas, for the cursor.
    let lastPointer: { x: number; y: number } | null = null;
    // The cursor for what is under the pointer and what is going on
    // (`canvas/cursor.ts`). A drag keeps the cursor it started with, except
    // a label's, which is held.
    const updateCursor = () => {
      if (pointer.dragging && !pointer.draggingLabel && !panningFrom) return;
      diagramHost.style.cursor = cursorFor({
        tool: tools.active,
        over: lastPointer && !pointer.dragging ? pointer.cursorTarget(lastPointer) : null,
        panning: panningFrom ? 'moving' : spaceHeld ? 'ready' : null,
        dragging: pointer.draggingLabel ? 'label' : null,
      });
    };
    cursorUpdate = updateCursor;
    const onDown = (event: PointerEvent) => {
      // A press inside the label editor is typing, not a canvas gesture.
      if (labelEditor?.contains(event.target)) return;
      // The right button opens the context menu; it never draws, drags or selects.
      if (event.button === 2) return;
      diagramHost.setPointerCapture(event.pointerId);
      if (event.button === 1 || spaceHeld) {
        panningFrom = screenPoint(event);
        updateCursor();
        return;
      }
      // Text is placed with a click and typed; it is not a drag.
      if (tools.active === 'text') return;
      pointer.down(scenePoint(event), { additive: event.shiftKey, alt: event.altKey, mod: event.metaKey || event.ctrlKey, shift: event.shiftKey });
      // A click selects; show it now rather than on release.
      syncSelection();
      updateCursor();
    };
    // Drawn at most once per frame: a pointer reports moves faster than the
    // screen redraws. Every move still reaches the pointer handler, so a pen
    // stroke or an eraser trail keeps every point.
    const drawDrag = frameThrottle((point: { x: number; y: number }, shift: boolean, alt: boolean, mod: boolean) => {
      if (!pointer.dragging) return;
      if (tools.active === 'eraser') {
        canvas.setErasing(pointer.erasing, pointer.eraserTrail);
        return;
      }
      // Live feedback: the drag's result drawn as it would be committed, or the
      // scene as it is when the drag would change nothing.
      canvas.render(pointer.preview(point, { shift, alt, mod }) ?? history.current);
      canvas.setMarquee(pointer.marquee);
      // The shapes this arrow would attach to, shown while it is drawn.
      canvas.setBindingCandidates(pointer.bindingCandidates, pointer.snapSpots);
    });
    const drawPan = frameThrottle(() => applyView());
    // What the pointer is over, looked up once a frame: a disc under the
    // handle it is on (none while dragging), and the cursor.
    const drawHover = frameThrottle((point: { x: number; y: number }, alt: boolean, shift: boolean) => {
      canvas.setHoverHandle(pointer.hoveredHandle(point));
      // In point editing, Alt shows the point an Alt-click would add (06.15, P14).
      if (pointer.editingPoints && !pointer.dragging) canvas.render((alt ? pointer.appendPreview(point, { shift }) : null) ?? history.current);
      updateCursor();
      // With the Arrow tool, the shape a press would start on (06.15, C18).
      if (!pointer.dragging && !pointer.drawingPoints) canvas.setBindingCandidates(pointer.bindingCandidates);
    });
    const drawClicking = frameThrottle((point: { x: number; y: number }, shift: boolean) => {
      canvas.render(pointer.pointsPreview(point, { shift }) ?? history.current);
    });
    const onMove = (event: PointerEvent) => {
      if (panningFrom) {
        const now = screenPoint(event);
        viewport.panBy(now.x - panningFrom.x, now.y - panningFrom.y);
        panningFrom = now;
        drawPan();
        return;
      }
      const point = scenePoint(event);
      lastDragPoint = point;
      lastPointer = point;
      pointer.move(point, { alt: event.altKey, mod: event.metaKey || event.ctrlKey, shift: event.shiftKey });
      drawHover(point, event.altKey, event.shiftKey);
      // Drawing click by click: the next segment follows the pointer, pressed
      // or not; a press there draws nothing of its own.
      if (pointer.drawingPoints) {
        drawClicking(point, event.shiftKey);
        canvas.setBindingCandidates(pointer.bindingCandidates, pointer.snapSpots);
        return;
      }
      if (!pointer.dragging) return;
      drawDrag(point, event.shiftKey, event.altKey, event.metaKey || event.ctrlKey);
    };
    const onUp = (event: PointerEvent) => {
      if (labelEditor?.contains(event.target)) return;
      // The right button belongs to the context menu, on release as on press.
      if (event.button === 2) return;
      lastDragPoint = null;
      // Nothing from before the release may be drawn after it.
      drawDrag.cancel();
      drawClicking.cancel();
      if (panningFrom) {
        panningFrom = null;
        drawPan.cancel();
        applyView();
        updateCursor();
        return;
      }
      if (tools.active === 'text') {
        const point = scenePoint(event);
        tools.escape();
        // After the release, so the click's own focus change cannot close it.
        queueMicrotask(() => placeText(point));
        return;
      }
      const placed = pointer.up(scenePoint(event), { alt: event.altKey, mod: event.metaKey || event.ctrlKey, shift: event.shiftKey });
      if (placed) {
        tools.escape();
        const element = history.current.elements.find((e) => e.id === placed);
        // After the release, so the click's own focus change cannot close it.
        if (element) queueMicrotask(() => editCode(element));
      }
      canvas.setMarquee(null);
      canvas.setErasing(new Set(), []);
      canvas.setBindingCandidates([]);
      commit();
      // The last frame drawn was a preview, possibly of a place the release
      // did not commit (a drag back to its start changes nothing, so nothing
      // republishes). Show what is. Unchanged elements are skipped. While a
      // line is drawn click by click, what is includes its next segment.
      canvas.render(pointer.pointsPreview(scenePoint(event), { shift: event.shiftKey }) ?? history.current);
      updateCursor();
    };
    // Right-click: an unselected element under the pointer becomes the
    // selection first, then the menu opens at the pointer for it.
    const onContextMenu = (event: MouseEvent) => {
      event.preventDefault();
      if (!canvasShown() || labelEditor?.contains(event.target)) return;
      const hit = topmostAt(history.current, scenePoint(event as PointerEvent));
      const next = contextSelection(history.current, selection.ids, hit);
      if (next.join(' ') !== selection.ids.join(' ')) {
        selection.clear();
        next.forEach((id, i) => selection.click(id, { additive: i > 0 }));
        syncSelection();
      }
      openContextMenu({ x: event.clientX, y: event.clientY });
    };
    const onDoubleClick = (event: MouseEvent) => {
      if (labelEditor?.contains(event.target)) return;
      // A double-click on a fixed segment of the selected elbow lets it go,
      // before it could open the label editor. On a bend it removes nothing
      // (06.15, as Excalidraw).
      if (pointer.releaseSegmentAt(scenePoint(event as PointerEvent))) {
        commit();
        return;
      }
      // A line's points are edited by double-click, an arrow's with Cmd/Ctrl
      // (a plain double-click types its label), as in Excalidraw.
      if (pointer.doubleClick(scenePoint(event as PointerEvent), { mod: event.metaKey || event.ctrlKey })) {
        syncSelection();
        return;
      }
      const element = editableAt(history.current, scenePoint(event as PointerEvent), hitTolerance());
      if (element?.type === 'code') editCode(element);
      else if (element) editElement(element);
    };
    const onWheel = (event: WheelEvent) => {
      if (labelEditor?.contains(event.target)) return;
      event.preventDefault();
      const action = wheelAction(event);
      if (action.kind === 'zoom') {
        zoomTo(viewport.zoom * action.factor, screenPoint(event));
      } else {
        viewport.panBy(action.dx, action.dy);
        applyView();
      }
    };
    // Shift constrains a drag and Alt copies it, and the preview follows either
    // key even when the pointer does not move: the drag is redrawn where the
    // pointer last was, so the release commits what is on screen.
    const onModifier = (event: KeyboardEvent) => {
      if (!['Shift', 'Alt', 'Meta', 'Control'].includes(event.key)) return;
      // In point editing, Alt shows or hides the next point where the pointer is.
      if (!pointer.dragging && pointer.editingPoints && lastPointer) {
        drawHover(lastPointer, event.altKey, event.shiftKey);
        return;
      }
      if (!pointer.dragging || !lastDragPoint) return;
      // Through the frame throttle, so a move queued before the key cannot
      // draw over this with the old state.
      drawDrag(lastDragPoint, event.shiftKey, event.altKey, event.metaKey || event.ctrlKey);
    };
    const onSpace = (event: KeyboardEvent) => {
      if (event.key !== ' ') return;
      // Always cleared on release, wherever focus went while it was held.
      if (event.type === 'keyup') {
        spaceHeld = false;
        updateCursor();
        return;
      }
      if (canvasKeyStandsDown(event.target as Element | null, event.key, event.defaultPrevented)) return;
      if (editTarget(event.target as Element | null, { canvasVisible: canvasShown() }) !== 'canvas') return;
      spaceHeld = true;
      updateCursor();
      event.preventDefault();
    };
    const releaseSpace = () => (spaceHeld = false);
    diagramHost.addEventListener('pointerdown', onDown);
    diagramHost.addEventListener('pointermove', onMove);
    diagramHost.addEventListener('pointerup', onUp);
    diagramHost.addEventListener('wheel', onWheel, { passive: false });
    diagramHost.addEventListener('dblclick', onDoubleClick);
    diagramHost.addEventListener('contextmenu', onContextMenu);
    labelEditor = new LabelEditor(diagramHost);
    codeEditor = new CodeEditor(diagramHost);
    window.addEventListener('keydown', onSpace);
    window.addEventListener('keyup', onSpace);
    window.addEventListener('keydown', onModifier);
    window.addEventListener('keyup', onModifier);
    window.addEventListener('blur', releaseSpace);
    // The webview's own menu (Reload and all) only where there is text to
    // cut, copy or paste; the canvas opens Bava's menu itself (06.17).
    const onAnyContextMenu = (event: MouseEvent) => {
      if (!keepsBrowserMenu(event.target as Element | null)) event.preventDefault();
    };
    window.addEventListener('contextmenu', onAnyContextMenu);

    // The stage is sized at mount; follow the pane as the window or the
    // splitters change it.
    const sizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            canvas.resize(diagramHost.clientWidth, diagramHost.clientHeight);
            measureToolbar(diagramHost.clientWidth);
          });
    sizeObserver?.observe(diagramHost);

    // Tool shortcuts are global while the canvas has focus. Ignored while a
    // text field has it, or typing D2 would switch tools on every keystroke.
    const onKeyDown = (event: KeyboardEvent) => {
      // Canvas keys stand down while typing, inside a dialog, or with the
      // canvas hidden. Backspace must not empty a canvas nobody can see.
      // A focused control keeps its own Enter, Space, Tab and arrows.
      if (canvasKeyStandsDown(event.target as Element | null, event.key, event.defaultPrevented)) return;
      const typing =
        editTarget(event.target as Element | null, { canvasVisible: canvasShown() }) !== 'canvas';

      const handled = handleKey(event, {
        deleteSelection: () => {
          // In point editing, Delete removes the selected points; with none
          // selected, the line itself.
          if (pointer.deletePoints()) {
            commit();
            return;
          }
          canvasEdit(canvasCommands.deleteSelection)();
        },
        nudge: (dx, dy) => {
          // A frame carries its contents and a group its children, by keyboard
          // exactly as by mouse.
          // An attached arrow whose shape is not selected stays put (06.16, B21).
          const ids = new Set(carriedWith(history.current, nudged(history.current, selection.ids)).map((element) => element.id));
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
          // Escape finishes a line drawn click by click, or leaves point
          // editing, before anything else.
          if (pointer.escape()) {
            canvas.setBindingCandidates([]);
            commit();
            canvas.render(history.current);
            return;
          }
          tools.escape();
          selection.clear();
          syncSelection();
          published = history.current;
        },
        activateTool: (tool) => tools.activate(tool),
        toggleLock: () => tools.toggleLock(),
        editSelection: () => {
          // Enter finishes a line drawn click by click, or edits a selected
          // line's points; anything else, its text.
          if (pointer.enter()) {
            canvas.setBindingCandidates([]);
            commit();
            canvas.render(history.current);
            return;
          }
          editSelection();
        },
      }, { typing });

      if (handled) event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);

    // Shortcuts on punctuation keys cannot be native accelerators (Wails on
    // Windows never matches them), so the page handles them, in the capture
    // phase so no editor or field answers first.
    const onShortcut = (event: KeyboardEvent) => {
      const id = shortcutFor(event);
      if (!id) return;
      // A canvas-scoped key belongs to whatever has focus when that is not
      // the canvas: ⌘] indents in the editor, ⇧H types a capital H.
      if (canvasOnly.has(id) && editTarget(event.target as Element | null, { canvasVisible: canvasShown() }) !== 'canvas') {
        return;
      }
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

    void settingsLoad.catch((error: unknown) => {
      void report(error, 'settings');
      notify(t('error.settingsLoad'));
    });

    // Anything nothing else caught: logged, and shown per the error policy.
    const removeErrorHandlers = installErrorHandlers(window, {
      report,
      onUnexpected: (error) => errors.unexpected(error),
    });
    // Go recovered from a panic.
    const offAppError = Events.On('app:error', (event) => errors.unexpected(event.data as GoError));
    // Told once: the previous session ended unexpectedly, or the webview was
    // reloaded after its process died.
    void LogService.TakeNotices()
      .then((notices) => (notices ?? []).forEach((notice) => errors.notice(notice as GoNotice)))
      .catch((error: unknown) => void report(error, 'notices'));

    return () => {
      removeErrorHandlers();
      offAppError();
      offMenu();
      window.removeEventListener('keydown', onShortcut, true);
      clearTimeout(noticeTimer);
      window.removeEventListener('blur', onBlur);
      autosave.destroy();
      diagramHost.removeEventListener('pointerdown', onDown);
      diagramHost.removeEventListener('pointermove', onMove);
      diagramHost.removeEventListener('pointerup', onUp);
      diagramHost.removeEventListener('wheel', onWheel);
      diagramHost.removeEventListener('dblclick', onDoubleClick);
      diagramHost.removeEventListener('contextmenu', onContextMenu);
      document.fonts?.removeEventListener('loadingdone', onFontsLoaded);
      drawDrag.cancel();
      drawPan.cancel();
      drawClicking.cancel();
      labelEditor?.destroy();
      codeEditor?.destroy();
      codeEditor = null;
      labelEditor = null;
      window.removeEventListener('contextmenu', onAnyContextMenu);
      window.removeEventListener('keydown', onSpace);
      window.removeEventListener('keyup', onSpace);
      window.removeEventListener('keydown', onModifier);
      window.removeEventListener('keyup', onModifier);
      window.removeEventListener('blur', releaseSpace);
      sizeObserver?.disconnect();
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
  // Milestone 6. The pipeline still runs (diagnostics below prove it), but
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
      canPasteStyles,
      hasLocked: published.elements.some(isLocked),
      hasDocument: doc.path !== null || published.elements.length > 0,
      showsCanvas: view.showsCanvas,
      recents: recents.paths,
    };
    void MenuService.SetState(state).catch(() => {
      // Outside the app shell (a test, a plain browser) there is no menu.
    });
  });

  // Shape colours are theme tokens read into Konva, which cannot see CSS: a
  // theme change re-reads them. The theme writes its attribute synchronously,
  // so the new values are in place when this runs.
  $effect(() => {
    void theme.resolved;
    canvas.restyle();
  });

  // Repaint when a new snapshot is published.
  $effect(() => {
    canvas.render(published);
    void highlightBlocks(published);
  });
</script>

<!-- Inert while the splash covers it: no focus or reading behind the cover. -->
<div class="app" inert={!launch.ready}>
<Shell
  open={doc.isOpen}
  hints={noFileHints}
  title={doc.path ?? t('file.untitled')}
  dirty={doc.dirty}
  engine={doc.isOpen ? settingsState.layoutEngine : undefined}
  nodes={doc.isOpen ? nodeCount : undefined}
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
  onPanelError={(panel, error) => void report(error, `panel:${panel}`)}
>
  {#snippet settings()}
    <FilesSection
      mode={settingsState.autosave}
      delayMs={settingsState.autosaveDelayMs}
      onModeChange={(mode) => void settingsState.setAutosave(mode).then(reportSettingsError)}
      onDelayChange={(ms) => void settingsState.setAutosaveDelay(ms).then(reportSettingsError)}
    />
    <CanvasSection
      arrowBinding={settingsState.arrowBinding}
      midpointSnap={settingsState.midpointSnap}
      onArrowBindingChange={(on) => void settingsState.setArrowBinding(on).then(reportSettingsError)}
      onMidpointSnapChange={(on) => void settingsState.setMidpointSnap(on).then(reportSettingsError)}
    />
    <AdvancedSection
      verbose={settingsState.verboseLogging}
      onVerboseChange={(on) => void settingsState.setVerboseLogging(on).then(reportSettingsError)}
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
      <EmptyState title={t('file.noFolder')} body={t('file.noFolderBody')} mark />
    {/if}
  {/snippet}
  {#snippet document()}
    <div class="fill" bind:this={sourceHost}></div>
  {/snippet}

  {#snippet canvas()}
    <div class="canvas-region">
      <div class="fill" bind:this={canvasHost}></div>
      {#if toolbar.visible}
        <div class="selection-toolbar">
          <SelectionToolbar
            styles={{
              fill: currentStyle(published, selectedIds, 'fill'),
              stroke: currentStyle(published, selectedIds, 'stroke'),
              color: currentStyle(published, selectedIds, 'color'),
            }}
            controls={toolbar.controls}
            properties={toolbarProperties}
            capacity={toolbarCapacity}
            onProperty={(key, value) => {
              // A code block at a new size re-wraps and grows to its code, in
              // the same step (06.17).
              setProperty(history, selectedIds, key, value, key === 'fontSize' ? (element) => fitToCode(element, codeMetrics(element)) : undefined);
              // Which sizes it was chosen from: the code ones only for code alone.
              const codeSizes = toolbar.controls.some((control) => control.id === 'fontSize' && control.variant === 'code');
              newElementStyle.remember(key, value, codeSizes ? 'code' : 'text');
              commit();
              // A new language means new colours, and the language may not be
              // loaded yet.
              if (key === 'language') void highlightBlocks(history.current);
            }}
            keysFor={(id) => keysFor(menuSpec as MenuSpec, id, platform)}
            align={toolbar.align}
            distribute={toolbar.distribute}
            onApply={(key, swatch) => {
              applyStyle(history, selectedIds, key, swatch);
              newElementStyle.remember(key, swatch);
              commit();
            }}
            onCommand={(id) => void dispatcher.dispatch({ id })}
            onMore={(anchor, overflow) => openContextMenu(anchor, overflow)}
            lineActions={toolbar.lineActions}
            onLine={onLineAction}
            showMore={!drawingByClicks}
          />
        </div>
      {/if}
      <ToolRail
        active={tools.active}
        {insertOpen}
        onSelect={(tool) => {
          insertOpen = false;
          tools.activate(tool);
        }}
        onInsert={() => (insertOpen ? closeInsertPanel() : openInsertPanel())}
        locked={tools.locked}
        onLock={() => tools.toggleLock()}
      />
      {#if insertOpen}
        <div class="insert-panel">
          <InsertPanel
            {insert}
            onOutcome={(outcome) => {
              if (outcome.type === 'choose') tools.activate(outcome.tool);
              if (outcome.type === 'command' && outcome.id === 'diagram') openDiagramDialog();
              closeInsertPanel();
            }}
          />
        </div>
      {/if}
      <CanvasControls
        {zoom}
        onZoom={(direction) => zoomTo(viewport.zoom * (direction === 1 ? 1.2 : 1 / 1.2))}
      />
    </div>
  {/snippet}
</Shell>
</div>

<!--
  Always mounted, so closing never reads props from state already cleared:
  that threw at a running window.
-->
<DiagramDialog
  open={diagramOpen}
  source={DIAGRAM_STARTER}
  preview={diagramClient.state.svg}
  errors={diagramClient.state.errors}
  pending={diagramClient.state.pending}
  shapes={diagramClient.state.layout.shapes.length}
  engine={diagramDialog.engine}
  direction={diagramDialog.direction}
  onEngine={(next) => diagramDialog.setEngine(next)}
  onDirection={(next) => diagramDialog.setDirection(next)}
  isReserved={reservedByMenu(menuSpec as MenuSpec, platform)}
  onSource={(next) => diagramDialog.setSource(next)}
  onInsert={insertDiagram}
  onOpenChange={(next) => {
    diagramOpen = next;
  }}
/>

<ExportDialog
  open={exporter.isOpen}
  hasSelection={selectedIds.length > 0}
  settings={exporter.settings}
  preview={exportPreview}
  onSettings={(change) => exporter.change(change)}
  onExport={(format) => void exporter.exportAs(format)}
  onCopy={() => void exporter.copy()}
/>

<ContextMenu
    items={contextMenu?.items ?? []}
    open={contextMenu !== null}
    anchor={contextMenu?.anchor ?? null}
    onSelect={(id) => {
      contextMenu = null;
      // A control that did not fit the toolbar row acts from the menu; every
      // other entry is a command the native menu has too.
      const choice = parseOverflowId(id);
      if (choice?.kind === 'property') {
        setProperty(history, selectedIds, choice.key, choice.value, choice.key === 'fontSize' ? (element) => fitToCode(element, codeMetrics(element)) : undefined);
        const codeSizes = toolbar.controls.some((control) => control.id === 'fontSize' && control.variant === 'code');
        newElementStyle.remember(choice.key, choice.value, codeSizes ? 'code' : 'text');
      } else if (choice?.kind === 'style') {
        applyStyle(history, selectedIds, choice.key, choice.swatch);
        newElementStyle.remember(choice.key, choice.swatch);
      } else {
        void dispatcher.dispatch({ id });
        return;
      }
      commit();
    }}
    onOpenChange={(open) => {
      if (!open) contextMenu = null;
    }}
  />

{#if !launch.ready}
  <Splash status={t('launch.starting')} />
{/if}

<ShortcutsDialog
  bind:open={shortcutsOpen}
  title={t('shortcuts.title')}
  groups={shortcuts}
  onOpenChange={(open) => (shortcutsOpen = open)}
/>

<!--
  Keyed on the item shown: dismissing with Escape or a click outside sets the
  dialog's own open state to false, and a reused instance would then show the
  next queued item closed: invisible, and stuck.
-->
{#key errors.current}
{#if errors.current}
  <ErrorDialog
    open
    title={errorText[errors.current.kind].title}
    body={errorText[errors.current.kind].body}
    details={errors.current.details}
    onCopyDetails={(details) => void copyText(details, t('error.detailsCopied'))}
    onOpenLogs={() => void openLogsFolder()}
    onClose={() => errors.dismiss()}
  />
{/if}
{/key}

<AboutDialog bind:open={aboutOpen} onOpenChange={(open) => (aboutOpen = open)} />

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

  .selection-toolbar {
    position: absolute;
    left: 50%;
    bottom: var(--space-4);
    z-index: var(--z-floating);
    transform: translateX(-50%);
  }

  .app {
    height: 100%;
  }

  /* Beside the rail: the rail's inset, its button width and a gap. */
  .insert-panel {
    position: absolute;
    top: var(--space-3);
    left: calc(var(--space-3) + var(--size-rail-button) + var(--space-2) * 2 + var(--space-2));
    z-index: var(--z-floating);
  }

  .canvas-region {
    position: relative;
    height: 100%;
    background: var(--color-canvas-bg);
  }
</style>
