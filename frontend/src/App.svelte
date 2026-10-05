<script lang="ts">
  /**
   * Mount point. Layout lives in Shell; this file owns the imperative
   * libraries and the wiring between them.
   */
  import { onMount, tick, untrack } from 'svelte';
  import { CanvasStage } from './canvas/stage';
  import { createViewport } from './canvas/viewport';
  import { createTools } from './canvas/tools.svelte';
  import CanvasControls from './components/CanvasControls.svelte';
  import ToolRail from './components/ToolRail.svelte';
  import InsertPanel from './components/InsertPanel.svelte';
  import { createInsert } from './shell/insert.svelte';
  import ContextMenu from './components/ContextMenu.svelte';
  import { contextMenuFor, contextSelection, EMBED_IN_DOCUMENT, overflowMenu, parseOverflowId, rightClickHit, type MenuNode } from './canvas/context-menu';
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
  import { base64 } from './canvas/export/fonts';
  import { framePicture } from './canvas/export/frame-picture';
  import { embedFrame, frameGroups, redrawPictures, type EmbedIO } from './files/embed-actions';
  import FramePicker from './components/FramePicker.svelte';
  import { SourcePane } from './editor/source-pane';
  import DocumentPane from './docs/DocumentPane.svelte';
  import { createRenderClient } from './ipc/render.svelte';
  import DiagramDialog from './components/DiagramDialog.svelte';
  import { createDiagramDialog } from './shell/diagram-dialog.svelte';
  import { toElements } from './canvas/import/convert';
  import { inNewFrame } from './canvas/import/in-frame';
  import { createTheme } from './styles/theme.svelte';
  import Shell from './shell/Shell.svelte';
  import { statusContext, type StatusSide } from './shell/status-context';
  import { statusLocation } from './shell/status-location';
  import { createDocument, sceneToSave } from './files/document.svelte';
  import { createSpace, type TrashEntry } from './files/space.svelte';
  import { folderOf, followMove, formatBytes, linksMissedMessage, launchTarget, pageTitle, saveSpaceSettings, spaceChoices, treeMenu, unsavedBody, within } from './files/space-helpers';
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
  import { applyStyle, currentStyle, CODE_FONT_SIZE, setProperty, shownProperty, type PropertyKey } from './canvas/style';
  import SelectionToolbar from './components/SelectionToolbar.svelte';
  import { toolbarFor, type LineAction, type ToolbarControl } from './canvas/toolbar';
  import { closeLine, openLine } from './canvas/closed';
  import { readRootVariable } from './canvas/palette';
  import type { SceneData, SceneElement } from './canvas/scene';
  import SpaceTree from './components/SpaceTree.svelte';
  import ToolIcon from './components/ToolIcon.svelte';
  import SpaceSwitcher from './components/SpaceSwitcher.svelte';
  import StartScreen from './components/StartScreen.svelte';
  import TrashDialog from './components/TrashDialog.svelte';
  import MediaSection from './components/MediaSection.svelte';
  import MediaDialog from './components/MediaDialog.svelte';
  import Splitter from './components/Splitter.svelte';
  import { mediaUsage, type AttachmentFile, type MediaItem } from './files/media';
  import SpaceSettingsDialog from './components/SpaceSettingsDialog.svelte';
  import NewSpaceDialog from './components/NewSpaceDialog.svelte';
  import ConfirmDialog from './components/ConfirmDialog.svelte';
  import { createFileActions, type Choice, type PromptKind } from './files/actions.svelte';
  import EmptyState from './components/EmptyState.svelte';
  import Splash from './components/Splash.svelte';
  import { createLaunch, LAUNCH_CAP_MS } from './shell/launch.svelte';
  import ShortcutsDialog from './components/ShortcutsDialog.svelte';
  import AboutDialog from './components/AboutDialog.svelte';
  import ErrorDialog from './components/ErrorDialog.svelte';
  import { installErrorHandlers, report } from './ipc/log';
  import { bodyKeyFor, createErrorPolicy, type GoError, type GoNotice } from './shell/errors.svelte';
  import FilesSection from './settings/FilesSection.svelte';
  import AdvancedSection from './settings/AdvancedSection.svelte';
  import CanvasSection from './settings/CanvasSection.svelte';
  import { createSettings } from './settings/settings.svelte';
  import { createRecents } from './files/recents.svelte';
  import { createAutosave } from './files/autosave.svelte';
  import { createViewState, MEDIA_SHARE } from './shell/view.svelte';
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
  import { Browser, Clipboard, Events } from '@wailsio/runtime';
  import { followAction, followBeside, joinFile, resolveLink, type Move } from './docs/links';
  import { relinkEdits } from './docs/page-links';
  import { addMedia, type MediaFile } from './docs/add-media';
  import { ExportService, FileService, LogService, MenuService, SpaceService } from '../bindings/github.com/tenesh/bava/internal/app';
  import { t } from './i18n/t';
  import type { MessageKey } from './i18n/messages';

  const theme = createTheme();

  // Constructed at initialisation so the effects below can close over them.
  // They are inert until mounted, and both guard against being used before.
  const canvas = new CanvasStage();
  const viewport = createViewport();
  const doc = createDocument();
  const space = createSpace();
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
  // The style a new element takes: the last chosen, for this session.
  const newElementStyle = createCurrentStyle();
  const pointer = createPointerHandler({
    history,
    selection,
    tools,
    newStyle: (type) => newElementStyle.for(type),
    bindingEnabled: () => settingsState.arrowBinding,
    midpointSnap: () => settingsState.midpointSnap,
    // Snapping to objects: its reach is 8 screen px at any zoom,
    // and only what is on screen is snapped to.
    objectSnap: () => settingsState.objectSnap,
    snapDistance: () => (parseFloat(readRootVariable('--size-snap-distance')) || 0) / viewport.zoom,
    visibleBox: () => {
      const { width, height } = canvas.size();
      if (!width || !height) return null;
      const corner = viewport.screenToScene({ x: 0, y: 0 });
      return { x: corner.x, y: corner.y, w: width / viewport.zoom, h: height / viewport.zoom };
    },
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
    // A code block whose editor is open has no handles to press.
    editingText: () => canvas.editing(),
    // An arrow's label as the stage draws it, for sliding it along the arrow.
    labelBounds: (id) => canvas.labelBounds(id),
    // How far a press must travel to be a drag, in scene units at this zoom.
    dragThreshold: () => (parseFloat(readRootVariable('--size-drag-threshold')) || 0) / viewport.zoom,
    // The rotate handle's distance above the selection, as the stage draws it.
    rotateGap: () => (parseFloat(readRootVariable('--size-rotate-gap')) || 0) / viewport.zoom,
    // A placed code block is sized the way a committed one is.
    codeMetrics,
  });
  // A code block pasted a new size re-wraps and grows to its code.
  const canvasCommands = createCanvasCommands({ history, selection, afterPasteStyle: (element) => fitToCode(element, codeMetrics(element)) });

  /** How near a click counts as hitting a line, in scene units at the current zoom. */
  function hitTolerance() {
    return (parseFloat(readRootVariable('--size-hit-tolerance')) || 0) / viewport.zoom;
  }

  /** The editor that opens over a code block, and the block it is on. */
  let codeEditor: CodeEditor | null = null;

  /**
   * The metrics a code block is measured and drawn with, from the tokens, at
   * the block's own size when given one.
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
        canvas.setEditing(null);
        commitCode(history, element.id, code, codeMetrics(element));
        commit();
        void highlightBlocks(history.current);
      },
    });
    // After `open`, which first closes an editor already open (and so clears
    // what is marked edited): the block loses its outline and handles.
    canvas.setEditing(element.id);
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

  // Opened from the page (`/` Diagram from code): Insert puts the diagram in
  // a frame of its own and embeds that frame at the caret.
  let diagramForPage = false;

  function openDiagramDialog() {
    if (!canvasShown()) return;
    diagramForPage = false;
    diagramOpen = true;
    diagramDialog.open(DIAGRAM_STARTER);
  }

  /** `/` Diagram from code, once the page is in a Space. */
  async function openDiagramForPage() {
    if (!embedIO.inSpace() && !(await embedIO.offerSpace())) return;
    diagramForPage = true;
    diagramOpen = true;
    diagramDialog.open(DIAGRAM_STARTER);
  }

  /** What the dialog opens with: enough to show that something happens. */
  const DIAGRAM_STARTER = 'a -> b';

  function insertDiagram() {
    const layout = diagramClient.state.layout;
    if (layout.shapes.length === 0 && layout.connections.length === 0) return;
    if (diagramForPage) {
      insertDiagramInPage();
      return;
    }
    // Centred on what the user is looking at, at the diagram's own size.
    const centre = viewport.screenToScene({
      x: (canvasHostEl?.clientWidth ?? 0) / 2,
      y: (canvasHostEl?.clientHeight ?? 0) / 2,
    });
    canvasCommands.insertDiagram(toElements(layout, { at: centre }));
    // The engine used becomes the default, so the next dialog opens with it.
    void diagramDialog.inserted();
    diagramOpen = false;
    commit();
    syncSelection();
  }
  /** The diagram in a new frame below the canvas's content, embedded at the page's caret. */
  function insertDiagramInPage() {
    canvasCommands.insertDiagram(inNewFrame(history.current, toElements(diagramClient.state.layout, { at: { x: 0, y: 0 } }), t('frames.diagram')));
    void diagramDialog.inserted();
    diagramOpen = false;
    diagramForPage = false;
    commit();
    // The new frame: the one inserted that no other frame holds.
    const frame = history.current.elements.find((element) => element.type === 'frame' && element.frame === undefined && selection.has(element.id));
    if (frame) void embedPicked(frame.id, null);
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
      // One frame alone: it can be embedded in the page.
      frame: selected.length === 1 && selected[0].type === 'frame' && doc.isOpen,
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

  const errorTitle = {
    unexpected: t('error.unexpected.title'),
    unexpectedExit: t('error.unexpectedExit.title'),
    webviewReloaded: t('error.webviewReloaded.title'),
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
        .map((control) => [control.id, shownProperty(published, selectedIds, control.id as PropertyKey)]),
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
    // Guides belong to the tool that drew them.
    if (tool !== drawingWith) canvas.setSnapGuides([]);
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
    // Point editing is drawn with the selection it belongs to.
    canvas.setPointEditing(pointer.editingPoints);
    drawingByClicks = pointer.drawingPoints;
    editingPointsOf = pointer.editingPoints?.id ?? null;
  }

  /** A line action from the toolbar. */
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
    canvasChanged();
    doc.touch();
    autosave.changed();
  }

  // The opened scene's version and unknown top-level keys travel back with
  // the elements, so a save keeps what a newer Bava wrote.
  const currentScene = () => sceneToSave(doc.sceneExtra, history.current.elements);

  const autosave = createAutosave({
    settings: () => ({ mode: settingsState.autosave, delayMs: settingsState.autosaveDelayMs }),
    document: doc,
    save: async () => redrawAfterSave(await doc.save(currentScene())),
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
    canvasChanged();
  }

  /**
   * A save asked for by hand that Go refused (it answered, and wrote nothing)
   * says why in the status bar; otherwise the page stays unsaved with no word.
   * Autosave calls the document directly and pauses with its own notice.
   */
  function toldIfRefused<T extends { conflict: boolean; saved: boolean }>(outcome: T): T {
    if (!outcome.saved && !outcome.conflict && doc.error) notify(doc.error);
    return outcome;
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
      save: async (scene, options) => redrawAfterSave(toldIfRefused(await doc.save(scene, options))),
      saveAs: async (path, scene) => toldIfRefused(await doc.saveAs(path, scene)),
      close: () => {
        doc.close();
        loadScene([]);
      },
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

  // The open Space, and the last one, reopened at launch.
  const LAST_SPACE_KEY = 'bava.lastSpace';
  // Spaces that failed to open this session: the start screen marks them.
  let missingSpaces = $state.raw<string[]>([]);

  function rememberLastSpace(root: string | null) {
    try {
      if (root) localStorage.setItem(LAST_SPACE_KEY, root);
      else localStorage.removeItem(LAST_SPACE_KEY);
    } catch {
      // A convenience: launch shows the start screen instead.
    }
  }

  // The open page relative to its Space, or null for no page or a loose one.
  const openRel = $derived(doc.path ? space.relative(doc.path) : null);
  // Where the open page's images and videos load from: its Space, or the
  // folder of a page opened on its own.
  const mediaPlace = $derived.by(() => {
    if (!doc.path) return null;
    if (space.root && openRel !== null) return { root: space.root, here: openRel };
    const at = Math.max(doc.path.lastIndexOf('/'), doc.path.lastIndexOf('\\'));
    const folder = doc.path.slice(0, at);
    // A page at the root of a disk: the root keeps its separator (`/`, `C:\`).
    const root = folder === '' || /^[A-Za-z]:$/.test(folder) ? doc.path.slice(0, at + 1) : folder;
    return { root, here: doc.path.slice(at + 1) };
  });

  /**
   * Open a folder as a Space, closing the page first, and reopen its last
   * page. With `keepPage`, the loose page open now stays open and becomes
   * the Space's page instead.
   */
  async function openSpace(dir: string, keepPage = false): Promise<boolean> {
    if (!keepPage) {
      if (doc.isOpen && !(await fileActions.close())) return false;
      loadScene([]);
    }
    const error = await space.open(dir);
    if (error) {
      if (!missingSpaces.includes(dir)) missingSpaces = [...missingSpaces, dir];
      notify(error);
      return false;
    }
    missingSpaces = missingSpaces.filter((path) => path !== dir);
    recents.add(space.root!, 'space');
    rememberLastSpace(space.root);
    const kept = keepPage && doc.path ? space.relative(doc.path) : null;
    if (kept !== null) {
      space.rememberPage(kept);
      await showInTree(kept);
      return true;
    }
    const last = space.lastPage;
    if (last) await openPath(space.absolute(last));
    return true;
  }

  // Every way of opening a page ends here: the menu, recents, the tree.
  async function openPath(path: string) {
    if (recents.kindOf(path) === 'space') {
      await openSpace(path);
      return;
    }
    if (!(await fileActions.open(path))) return;
    recents.add(path, 'file');
    autosave.resume();
    const rel = space.relative(path);
    if (rel === null) {
      // A page on its own: no Space around it.
      space.close();
      rememberLastSpace(null);
      return;
    }
    space.rememberPage(rel);
    await showInTree(rel);
  }

  /** Open every folder a page is in, so its row shows. */
  async function showInTree(rel: string) {
    const parts = folderOf(rel).split('/').filter(Boolean);
    for (let i = 1; i <= parts.length; i += 1) await space.expand(parts.slice(0, i).join('/'));
  }

  // A new row is named in the tree, so the tree must be showing.
  function showFiles() {
    if (!view.showsFiles) view.toggleFiles();
    if (view.filesFolded) view.toggleFilesFolded();
  }

  async function openFile() {
    const chosen = await FileService.ChooseFileToOpen();
    if (chosen.path) await openPath(chosen.path);
  }

  // New Space: a name, and the place its folder is made in, which starts
  // beside the Space open now or the last one opened.
  let newSpaceOpen = $state.raw(false);
  let newSpaceLocation = $state.raw('');

  function openNewSpace() {
    const near = space.root ?? recents.spaces[0]?.path ?? '';
    newSpaceLocation = near ? near.replace(/[\\/][^\\/]*$/, '') : '';
    newSpaceOpen = true;
  }

  async function chooseNewSpaceLocation() {
    const chosen = await space.chooseFolder(t('space.chooseLocation'));
    if (chosen.error) notify(chosen.error);
    else if (chosen.path) newSpaceLocation = chosen.path;
  }

  /**
   * Makes the Space; a refusal goes back to the dialog, which shows it beside
   * the name. The dialog awaits this, so a call that fails outright answers
   * the same way rather than rejecting.
   */
  async function createNewSpace(name: string): Promise<string | null> {
    try {
      const made = await space.create(newSpaceLocation, name);
      if (made.error) return made.error;
      newSpaceOpen = false;
      await openSpace(made.root);
      return null;
    } catch (error) {
      void report(error, 'new-space');
      return t('space.newFailed');
    }
  }

  async function chooseSpace() {
    const chosen = await space.chooseFolder(t('space.open'));
    if (chosen.error) notify(chosen.error);
    else if (chosen.path) await openSpace(chosen.path);
  }

  async function afterSave(saved: boolean) {
    if (!saved) return;
    // A save by hand settles whatever paused autosave.
    autosave.resume();
    if (doc.path) recents.add(doc.path, 'file');
    await space.refresh();
  }

  /** ⌘N: a page beside the open one in a Space, else an untitled one. */
  async function newPage() {
    if (space.root) {
      showFiles();
      space.beginNew('page', folderOf(openRel));
    } else if (await fileActions.create()) loadScene([]);
  }

  function newFolder() {
    if (!space.root) return;
    showFiles();
    space.beginNew('folder', folderOf(openRel));
  }

  async function commitNew(name: string) {
    const kind = space.pending?.kind;
    const made = await space.commitNew(name);
    if (made.error) {
      notify(made.error);
      return;
    }
    if (kind === 'page') await openPath(space.absolute(made.path));
  }

  // One rename or move at a time: each rewrites links from the Space as its
  // own move left it, before the next begins.
  let relocating: Promise<void> = Promise.resolve();

  /** A rename or move in the tree; the open page follows its file. */
  function relocate(op: { kind: 'rename' | 'move'; path: string; name?: string; folder?: string; index?: number }): Promise<void> {
    const next = relocating.then(() => relocateNow(op));
    // A failed one never stops those after it.
    relocating = next.catch(() => {});
    return next;
  }

  async function relocateNow(op: { kind: 'rename' | 'move'; path: string; name?: string; folder?: string; index?: number }) {
    const rel = openRel;
    // Nothing may write to the old path once the file has moved.
    const release = rel && within(rel, op.path) ? await autosave.hold() : () => {};
    try {
      const result = await space.apply(op, {
        // The page follows its file before the tree is re-read.
        before: (outcome) => {
          recents.renamePrefix(space.absolute(op.path), space.absolute(outcome.path));
          space.followMove(op.path, outcome.path);
          const moved = rel ? followMove(rel, op.path, outcome.path) : null;
          if (!moved) return;
          doc.moved(space.absolute(moved));
          space.rememberPage(moved);
        },
      });
      if (result.error) {
        notify(result.error);
        return;
      }
      if (result.path !== op.path) await relinkAfter([{ from: op.path, to: result.path }], rel);
      await docPane?.refreshLinks();
    } finally {
      release();
    }
  }

  /**
   * After pages moved, every page's links follow them: the open page's in the
   * editor, as an edit; the others read with the Document's own reader and
   * written back only if unchanged since they were read. `open` is the open
   * page's path before the move.
   */
  async function relinkAfter(moves: Move[], open: string | null) {
    try {
      if (open) docPane?.followMoves(open, moves);
      const pages = await space.index(true);
      if (!pages) {
        notify(t('links.missedSpace'));
        return;
      }
      const { edits, unplaced } = relinkEdits(pages, moves, open);
      const written = edits.length > 0 ? await space.apply({ kind: 'relink', edits }, { refresh: false }) : { missed: [], error: '' };
      const missed = written.error ? edits.map((e) => e.path) : (written.missed ?? []);
      const message = linksMissedMessage([...new Set([...missed, ...unplaced])]);
      if (message) notify(message);
    } catch (error) {
      void report(error, 'relink');
      notify(t('links.missedSpace'));
    }
  }

  /** Follows a link from the open page: a heading on it, the browser, another page or a file. */
  async function followLink(href: string) {
    if (!doc.path) return;
    const inSpace = space.root !== null && openRel !== null;
    const folder = doc.path.replace(/[\\/][^\\/]*$/, '');
    const action = inSpace ? followAction(openRel!, href) : followBeside(href);
    if (!action) return;
    if (action.kind === 'anchor') {
      docPane?.goToAnchor(action.anchor);
    } else if (action.kind === 'external') {
      void Browser.OpenURL(action.url);
    } else if (action.kind === 'file') {
      if (inSpace) await revealPath(action.path);
    } else {
      await openPath(inSpace ? space.absolute(action.path) : joinFile(folder, action.path));
      await tick();
      if (action.anchor) docPane?.goToAnchor(action.anchor);
    }
  }

  async function trashPath(path: string) {
    // The open page, or the folder it is in, goes to the Trash closed.
    if (openRel && within(openRel, path)) {
      if (!(await fileActions.close())) return;
      loadScene([]);
      space.rememberPage(null);
    }
    const result = await space.apply({ kind: 'trash', path });
    if (result.error) notify(result.error);
    else recents.removePrefix(space.absolute(path));
    if (trashOpen) await refreshTrash();
    await docPane?.refreshLinks();
  }

  async function duplicatePath(path: string) {
    // The copy is made from disk, so unsaved edits are saved into it first.
    if (openRel === path && doc.dirty && !(await fileActions.save())) return;
    const result = await space.apply({ kind: 'duplicate', path });
    if (result.error) notify(result.error);
  }

  async function revealPath(path = '') {
    const error = await space.reveal(path);
    if (error) notify(error);
  }

  // The tree's right-click menu, and a rename it asks for.
  // The Files header's menu: a page or a folder beside the open page.
  let filesMenuAt = $state.raw<{ x: number; y: number } | null>(null);
  let treeMenuAt = $state.raw<{ path: string | null; anchor: { x: number; y: number } } | null>(null);
  let renameRequest = $state.raw<string | null>(null);
  const treeMenuKind = $derived.by(() => {
    const path = treeMenuAt?.path;
    if (!path) return null;
    return space.rows.find((row) => row.entry.path === path)?.entry.kind ?? null;
  });

  function onTreeMenu(id: string) {
    const target = treeMenuAt?.path ?? null;
    treeMenuAt = null;
    const folder = target === null ? '' : treeMenuKind === 'folder' ? target : folderOf(target);
    switch (id) {
      case 'tree.newPage':
        space.beginNew('page', folder);
        break;
      case 'tree.newFolder':
        space.beginNew('folder', folder);
        break;
      case 'tree.rename':
        renameRequest = target;
        break;
      case 'tree.duplicate':
        if (target) void duplicatePath(target);
        break;
      case 'tree.reveal':
        void revealPath(target ?? '');
        break;
      case 'tree.trash':
        if (target) void trashPath(target);
        break;
    }
  }

  // The Trash dialog.
  let trashOpen = $state.raw(false);
  let trashItems = $state.raw<TrashEntry[]>([]);
  let trashSize = $state.raw(0);

  async function refreshTrash() {
    const list = await space.trash();
    if (list.error) notify(list.error);
    trashItems = list.items ?? [];
    trashSize = list.size;
  }

  async function openTrash() {
    if (!space.root) return;
    trashOpen = true;
    await refreshTrash();
  }

  async function restoreItem(id: string) {
    const item = trashItems.find((entry) => entry.id === id);
    const result = await space.apply({ kind: 'restore', id });
    if (result.error) notify(result.error);
    // An attachment whose name was taken meanwhile comes back numbered: pages still reach the other.
    else if (item?.kind === 'attachment' && result.path && result.path !== item.path) {
      notify(t('media.restoredAs').replace('{name}', result.path.slice(result.path.lastIndexOf('/') + 1)));
    }
    await refreshTrash();
    await docPane?.refreshLinks();
    await refreshMedia();
  }

  async function deleteItem(id: string) {
    const item = trashItems.find((entry) => entry.id === id);
    const name = item ? (pageTitle(item.path) ?? item.path) : '';
    if (!(await confirm(t('trash.confirmDelete.title').replace('{name}', name), t('trash.confirmDelete.body')))) return;
    const result = await space.apply({ kind: 'deleteForever', id });
    if (result.error) notify(result.error);
    await refreshTrash();
  }

  async function emptyTrash() {
    if (!(await confirm(t('trash.confirmEmpty.title'), t('trash.confirmEmpty.body')))) return;
    const result = await space.apply({ kind: 'emptyTrash' });
    if (result.error) notify(result.error);
    await refreshTrash();
  }

  // A yes-or-no question: for what cannot be undone, or (`yes`) what else it asks.
  let confirming = $state.raw<{ title: string; body: string; yes: string; resolve: (yes: boolean) => void } | null>(null);
  function confirm(title: string, body: string, yes = t('trash.confirm')): Promise<boolean> {
    return new Promise((resolve) => {
      confirming = { title, body, yes, resolve };
    });
  }

  /**
   * Adds images and videos to the open page: copied into the Space's
   * attachments, then put where they were dropped (`at`) or at the caret. A
   * page opened on its own first offers to open its folder as a Space.
   */
  async function addMediaFiles(files: MediaFile[], at?: { x: number; y: number }) {
    if (!doc.path) return;
    await addMedia(files, {
      inSpace: () => space.root !== null && openRel !== null,
      offerSpace: async () => {
        const path = doc.path;
        if (!path || !(await confirm(t('media.needsSpace.title'), t('media.needsSpace.body'), t('tree.openAsSpace')))) return false;
        return openSpace(path.replace(/[\\/][^\\/]*$/, ''), true);
      },
      attach: async (file) => {
        const result = await space.apply('path' in file ? { kind: 'attach', source: file.path } : { kind: 'attachData', data: file.data }, { refresh: false });
        return result.error ? { error: result.error } : { name: result.name ?? '' };
      },
      insert: (names) => docPane?.insertMedia(names, at),
      notify,
    });
    await refreshMedia();
  }

  // Canvas embeds: what each embed on the page watches to redraw, the picker,
  // and how a frame's picture is read, drawn and written.
  let canvasWatchers: (() => void)[] = [];
  const canvasChanged = () => canvasWatchers.forEach((watch) => watch());
  let framePicker = $state.raw<{ at: { left: number; top: number; bottom: number }; groups: Awaited<ReturnType<typeof frameGroups>> } | null>(null);

  /** Another page's canvas, from its file; null when it cannot be read. */
  async function readScene(page: string): Promise<SceneData | null> {
    if (!space.root) return null;
    const result = await FileService.Open(space.absolute(page));
    return result.error ? null : { elements: (result.scene.elements ?? []) as unknown as SceneElement[] };
  }

  /** A frame's picture in the theme Bava has now; another page's code coloured on its own. */
  async function pictureOf(scene: SceneData, frame: string): Promise<Blob | null> {
    let runs = codeRuns.all();
    if (scene !== history.current) {
      const own = createCodeRuns();
      await own.update(scene);
      runs = own.all();
    }
    return framePicture(scene, frame, { theme: theme.resolved, codeRuns: runs }).catch((error: unknown) => {
      void report(error, 'embed-picture');
      return null;
    });
  }

  const embedIO: EmbedIO = {
    here: () => (space.root ? openRel : null),
    inSpace: () => space.root !== null && openRel !== null,
    offerSpace: async () => {
      const path = doc.path;
      if (!path || !(await confirm(t('media.needsSpace.title'), t('media.needsSpace.body'), t('tree.openAsSpace')))) return false;
      return openSpace(path.replace(/[\\/][^\\/]*$/, ''), true);
    },
    pages: async () => {
      const pages = await space.index(true);
      if (!pages) return null;
      const now = docPane?.currentMarkdown() ?? null;
      return pages.filter((page) => !page.unreadable).map((page) => (page.path === openRel && now !== null ? { ...page, text: now } : page));
    },
    scene: async (page) => (page === openRel ? history.current : readScene(page)),
    picture: pictureOf,
    save: async (name, data, replace) => {
      const result = await space.apply({ kind: 'savePicture', name, data: base64(await data.arrayBuffer()), replace }, { refresh: false });
      return result.error ? { error: result.error } : { name: result.name ?? name };
    },
    insert: (attrs) => docPane?.insertEmbed(attrs),
    notify,
  };

  /** How the page's embeds draw, watch the canvas and open their frame. */
  const embedContext = {
    draw: async (frame: string) => {
      const blob = await pictureOf(history.current, frame);
      return blob ? URL.createObjectURL(blob) : null;
    },
    watchCanvas: (redraw: () => void) => {
      canvasWatchers = [...canvasWatchers, redraw];
      return () => void (canvasWatchers = canvasWatchers.filter((watch) => watch !== redraw));
    },
    holds: async (page: string, frame: string) => {
      const scene = await readScene(page);
      return scene?.elements.some((element) => element.id === frame && element.type === 'frame') ?? false;
    },
    open: (frame: string, page: string | null) => void openEmbed(frame, page),
  };

  /** `/` Embed frame: the picker at the caret, once the page is in a Space. */
  async function pickFrame(at: { left: number; top: number; bottom: number }) {
    if (!embedIO.inSpace() && !(await embedIO.offerSpace())) return;
    const groups = await frameGroups(embedIO, {
      thumb: async (scene, frame) => {
        const blob = await pictureOf(scene, frame);
        return blob ? URL.createObjectURL(blob) : null;
      },
    });
    framePicker = { at, groups };
  }

  function closeFramePicker() {
    for (const group of framePicker?.groups ?? []) for (const frame of group.frames) if (frame.thumb) URL.revokeObjectURL(frame.thumb);
    framePicker = null;
  }

  /** A frame embedded in the open page: from the picker, or the canvas's right-click. */
  async function embedPicked(frame: string, page: string | null) {
    closeFramePicker();
    await embedFrame(frame, page, embedIO);
    await refreshMedia();
  }

  /** The selected frame embedded in the page: shown beside the canvas when it was hidden. */
  async function embedSelectedFrame() {
    const [id] = selection.ids;
    if (id === undefined) return;
    if (view.mode === 'canvas') {
      view.setMode('both');
      await tick();
    }
    await embedPicked(id, null);
  }

  /**
   * An embed clicked: its frame's page opened if it is another, the canvas
   * shown beside the page, and the frame selected and brought into view.
   */
  async function openEmbed(frame: string, page: string | null) {
    if (page !== null && page !== openRel) {
      await openPath(space.absolute(page));
      if (openRel !== page) return;
    }
    if (view.mode === 'document') view.setMode('both');
    await tick();
    const element = history.current.elements.find((each) => each.id === frame && each.type === 'frame');
    if (!element) return;
    selection.clear();
    selection.click(element.id);
    syncSelection();
    viewport.panToShow(element, { width: canvasHostEl?.clientWidth ?? 0, height: canvasHostEl?.clientHeight ?? 0 });
    applyView();
  }

  /** A save of the open page draws again every picture any page embeds of its frames, unless nothing changed. */
  let picturesDrawn: { page: string; scene: SceneData; theme: string } | null = null;
  function redrawAfterSave<T extends { saved: boolean }>(outcome: T): T {
    const page = space.root ? openRel : null;
    const scene = history.current;
    const drawn = picturesDrawn;
    if (outcome.saved && page && !(drawn && drawn.page === page && drawn.scene === scene && drawn.theme === theme.resolved)) {
      picturesDrawn = { page, scene, theme: theme.resolved };
      void redrawPictures(page, scene, embedIO)
        .then(refreshMedia)
        .catch((error: unknown) => {
          void report(error, 'embed-redraw');
          notify(t('embed.redrawFailed'));
        });
    }
    return outcome;
  }

  // Media: the Space's attachments, and the pages that use each, read again
  // when the Space opens and after anything is added, renamed or trashed.
  let mediaList = $state.raw<MediaItem[]>([]);
  // Whether every page was read: until then no file is called unused.
  let mediaUsageKnown = $state.raw(false);
  let mediaDialogOpen = $state.raw(false);
  let mediaReads = 0;

  /**
   * The Space's attachments and what is known of their use, read afresh: the
   * open page as it is now, saved or not. Null when the folder could not be
   * listed.
   */
  async function readMediaUsage(root: string): Promise<{ files: AttachmentFile[]; usage: ReturnType<typeof mediaUsage> } | null> {
    const listed = await SpaceService.Attachments(root);
    if (listed.error) return null;
    const files = listed.attachments ?? [];
    let pages = await space.index(true);
    const now = openRel !== null ? (docPane?.currentMarkdown() ?? null) : null;
    if (pages && now !== null) pages = pages.map((page) => (page.path === openRel ? { ...page, text: now, unreadable: false } : page));
    return { files, usage: mediaUsage(files, pages) };
  }

  async function refreshMedia() {
    const root = space.root;
    const asked = (mediaReads += 1);
    if (!root) {
      mediaList = [];
      mediaUsageKnown = false;
      return;
    }
    const read = await readMediaUsage(root);
    if (asked !== mediaReads || space.root !== root) return;
    // A folder that could not be listed keeps the list shown.
    if (!read) {
      notify(t('media.readFailed'));
      return;
    }
    mediaList = read.usage.items;
    mediaUsageKnown = read.usage.known;
  }

  $effect(() => {
    void space.root;
    untrack(() => void refreshMedia());
  });

  /** Where a Media item's picture loads from: the image, or a video's poster; null for an icon. */
  function mediaThumb(item: MediaItem): string | null {
    const root = space.root;
    const name = item.kind === 'image' ? item.name : item.kind === 'video' ? item.poster : null;
    return root && name ? `/bava-file/?${new URLSearchParams({ root, path: `.bava/attachments/${name}` })}` : null;
  }

  /**
   * Folds or unfolds Files or Media. The side pane is laid out anew (split,
   * or stacked with one folded), so focus goes back to the fold button.
   */
  async function foldSection(section: 'files' | 'media') {
    if (section === 'files') view.toggleFilesFolded();
    else view.toggleMediaFolded();
    await tick();
    document.querySelector<HTMLElement>(`.files-fold[data-section="${section}"]`)?.focus();
  }

  /** An attachment to the Trash: asked first when pages use it, which then show it missing. */
  async function deleteMediaItem(item: MediaItem) {
    // Asked afresh: the list shown may be older than the pages.
    const read = space.root ? await readMediaUsage(space.root) : null;
    const now = read?.usage.items.find((entry) => entry.name === item.name);
    if (!read || !read.usage.known || !now || !now.unused) {
      const pages = (now ?? item).usedBy.map((page) => page.name).join(t('list.separator'));
      const body = read?.usage.known && pages ? t('media.confirmDelete.body').replace('{pages}', pages) : t('media.confirmDelete.unknown');
      if (!(await confirm(t('media.confirmDelete.title').replace('{name}', item.name), body))) return;
    }
    const result = await space.apply({ kind: 'trashAttachment', attachment: item.name }, { refresh: false });
    if (result.error) notify(result.error);
    await refreshMedia();
    if (trashOpen) await refreshTrash();
  }

  /** Every attachment no page uses, to the Trash, asked first with how many and how large. */
  async function trashUnusedMedia() {
    // Asked afresh, and only when every page could be read.
    const read = space.root ? await readMediaUsage(space.root) : null;
    if (!read || !read.usage.known) {
      notify(t('media.usageUnknown'));
      await refreshMedia();
      return;
    }
    const unused = read.usage.items.filter((item) => item.unused);
    if (unused.length === 0) {
      await refreshMedia();
      return;
    }
    const title = unused.length === 1 ? t('media.confirmUnused.one') : t('media.confirmUnused.title').replace('{count}', String(unused.length));
    const size = formatBytes(unused.reduce((sum, item) => sum + item.size, 0));
    if (!(await confirm(title, t('media.confirmUnused.body').replace('{size}', size), t('media.trashUnused')))) return;
    for (const item of unused) {
      const result = await space.apply({ kind: 'trashAttachment', attachment: item.name }, { refresh: false });
      if (result.error) notify(result.error);
    }
    await refreshMedia();
    if (trashOpen) await refreshTrash();
  }

  /** Files added to the Space's attachments without placing them on a page. */
  async function addToMedia() {
    const chosen = await FileService.ChooseMedia('file');
    if (chosen.error) notify(chosen.error);
    for (const path of chosen.paths ?? []) {
      const result = await space.apply({ kind: 'attach', source: path }, { refresh: false });
      if (result.error) notify(result.error);
    }
    await refreshMedia();
  }

  /** A paste with no text: the clipboard's image, when it holds one. */
  async function pasteImage() {
    const image = await FileService.ClipboardImage();
    if (image) await addMediaFiles([{ data: image }]);
  }

  /** A medium's new file, picked and attached; its name, or null. */
  async function replaceMedia(kind: 'image' | 'video' | 'file'): Promise<string | null> {
    const chosen = await FileService.ChooseMedia(kind);
    const path = chosen.paths?.[0];
    if (chosen.error) notify(chosen.error);
    if (!path) return null;
    const result = await space.apply({ kind: 'attach', source: path }, { refresh: false });
    if (result.error) notify(result.error);
    return result.error ? null : (result.name ?? null);
  }

  /**
   * Renames an attachment, and every page's images and videos follow it.
   * Answers with Go's refusal, for the caller to show where it was asked; a
   * call that fails outright answers the same way rather than rejecting.
   */
  async function renameAttachment(name: string, next: string): Promise<string | null> {
    try {
      const result = await space.apply({ kind: 'renameAttachment', attachment: name, name: next }, { refresh: false });
      if (result.error) return result.error;
      const folder = '.bava/attachments/';
      await relinkAfter([{ from: folder + name, to: folder + (result.name ?? next) }], openRel);
      await refreshMedia();
      return null;
    } catch (error) {
      void report(error, 'rename-attachment');
      return t('media.renameFailed');
    }
  }

  /**
   * Opens what a card or an online video reaches: a web page in the browser,
   * a file of the opened folder in its own app (a program is shown instead).
   */
  async function openFromPage(href: string) {
    if (/^https?:\/\//i.test(href)) {
      void Browser.OpenURL(href);
      return;
    }
    const target = mediaPlace ? resolveLink(mediaPlace.here, href)?.target : undefined;
    if (!mediaPlace || !target) return;
    // A page of the Space opens here, as a link to it does.
    if (/\.md$/i.test(target)) {
      await followLink(href);
      return;
    }
    const error = await FileService.OpenFile(mediaPlace.root, target);
    // Go's words name the file, which is the user's content: not logged.
    if (error) notify(t('card.openFailed'));
  }

  async function chooseMedia(kind: 'image' | 'video' | 'file') {
    const chosen = await FileService.ChooseMedia(kind);
    if (chosen.error) notify(chosen.error);
    else if (chosen.paths?.length) await addMediaFiles(chosen.paths.map((path) => ({ path })));
  }

  // Taking a Space off the list: asked first, with the choice to delete its
  // .bava folder too; the open Space is closed first.
  let removing = $state.raw<{ name: string; missing: boolean; resolve: (answer: { remove: boolean; deleteData: boolean }) => void } | null>(null);

  async function removeSpace(path: string) {
    const name = path.replace(/[\\/]+$/, '').replace(/^.*[\\/]/, '');
    const missing = missingSpaces.includes(path);
    const answer = await new Promise<{ remove: boolean; deleteData: boolean }>((resolve) => {
      removing = { name, missing, resolve };
    });
    if (!answer.remove) return;
    if (space.root === path) {
      if (doc.isOpen && !(await fileActions.close())) return;
      loadScene([]);
      space.close();
    }
    if (answer.deleteData) {
      const refusal = await space.deleteData(path);
      if (refusal) notify(refusal);
    }
    recents.removePrefix(path);
    missingSpaces = missingSpaces.filter((each) => each !== path);
    let last: string | null = null;
    try {
      last = localStorage.getItem(LAST_SPACE_KEY);
    } catch {
      // Nothing to forget.
    }
    if (last === path) rememberLastSpace(null);
  }

  // Space settings.
  let spaceSettingsOpen = $state.raw(false);

  async function renameSpace(name: string) {
    const oldRoot = space.root;
    if (!oldRoot) return;
    const rel = openRel;
    // Nothing may write to the old path until the page knows its new one.
    const release = rel ? await autosave.hold() : () => {};
    try {
      // The old root is gone once this succeeds, so nothing re-reads it.
      const result = await space.apply({ kind: 'renameSpace', name }, { refresh: false });
      if (result.error) {
        notify(result.error);
        return;
      }
      const newRoot = result.root!;
      // The page follows at once, whether or not the Space reopens.
      if (rel && doc.path) doc.moved(newRoot + doc.path.slice(oldRoot.length));
      space.carryTo(newRoot);
      recents.renamePrefix(oldRoot, newRoot);
      rememberLastSpace(newRoot);
      const error = await space.open(newRoot);
      if (error) notify(error);
      else if (rel) space.rememberPage(rel);
    } finally {
      release();
    }
  }

  async function setSpacePageWidth(width: string) {
    const error = await space.setPageWidth(width);
    if (error) notify(error);
  }

  // Reopen the last Space at launch; a folder that is gone falls
  // back to the start screen, marked missing there.
  void (async () => {
    let last: string | null;
    try {
      last = localStorage.getItem(LAST_SPACE_KEY);
    } catch {
      last = null;
    }
    if (!last) return;
    const opened = await openSpace(last);
    if (launchTarget(last, opened) === 'start') rememberLastSpace(null);
  })();


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
    // width, turned with it.
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
    // will land: its side the arrow points at on the tip.
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
        // to it; anywhere else, free text where it was clicked.
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
   * The source editor with focus (the Diagram from Code dialog's). An edit
   * command acts on the one the user is typing in, never on one they cannot see.
   */
  function focusedSource(): SourcePane | null {
    return SourcePane.containing(document.activeElement);
  }

  async function routeEdit(actions: {
    source: () => void | Promise<void>;
    /** The page's Document editor. */
    document: () => void | Promise<void>;
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
        source: () => Clipboard.SetText(focusedSource()?.selectedText() ?? '').then(() => {}),
        document: () => Clipboard.SetText(docPane?.selectedText() ?? "").then(() => {}),
        code: () => Clipboard.SetText(codeEditor?.selectedText() ?? '').then(() => {}),
        field: () => Clipboard.SetText(fieldSelection(document.activeElement)).then(() => {}),
        canvas: () => void canvasCommands.copy(),
      }),
    cut: () =>
      routeEdit({
        source: async () => {
          const editor = focusedSource();
          await Clipboard.SetText(editor?.selectedText() ?? '');
          editor?.replaceSelection('');
        },
        document: async () => {
          await Clipboard.SetText(docPane?.selectedText() ?? "");
          docPane?.deleteSelection();
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
          const text = await Clipboard.Text();
          editor?.replaceSelection(text);
        },
        document: async () => {
          const text = await Clipboard.Text();
          if (text) docPane?.paste(text);
          else await pasteImage();
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
    'file.new': newPage,
    'file.newFolder': newFolder,
    'file.openSpace': chooseSpace,
    'file.open': openFile,
    'space.trash': openTrash,
    'file.spaceSettings': () => {
      if (space.root) spaceSettingsOpen = true;
    },
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
        source: () => focusedSource()?.undo(),
        document: () => docPane?.undo(),
        code: () => codeEditor?.undo(),
        field: fieldCommand('undo'),
        // Not mid-gesture, a line drawn by clicks included.
        canvas: () => {
          if (!pointer.holdsHistory) canvasEdit(canvasCommands.undo)();
        },
      }),
    'edit.redo': () =>
      routeEdit({
        source: () => focusedSource()?.redo(),
        document: () => docPane?.redo(),
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
        source: () => focusedSource()?.selectAll(),
        document: () => docPane?.selectAll(),
        code: () => codeEditor?.selectAll(),
        field: fieldCommand('selectAll'),
        canvas: () => {
          // In point editing, Select All does nothing, as in Excalidraw.
          if (pointer.selectAll()) return;
          canvasCommands.selectAll();
          syncSelection();
        },
      }),
    // Find in the page, when a page shows in the Document.
    'edit.find': () => {
      if (doc.isOpen && view.showsDocument) docPane?.openFind();
    },
    'edit.replace': () => {
      if (doc.isOpen && view.showsDocument) docPane?.openFind(true);
    },
    'edit.delete': () =>
      routeEdit({
        source: fieldCommand('delete'),
        document: () => docPane?.deleteSelection(),
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
    // Edit the selected line's or arrow's points; not an elbow's.
    'canvas.editPoints': () => {
      const [id] = selection.ids;
      if (!canvasShown() || selection.ids.length !== 1 || id === undefined) return;
      if (pointer.editPoints(id)) syncSelection();
    },
    // In point editing, the selected points; otherwise the selection.
    'canvas.duplicate': () => {
      if (canvasShown() && pointer.duplicatePoints()) {
        commit();
        return;
      }
      canvasEdit(canvasCommands.duplicate)();
    },
    'canvas.lock': canvasEdit(canvasCommands.lock),
    'canvas.unlockAll': canvasEdit(canvasCommands.unlockAll),
    // Alt+S, or Canvas ▸ Snap to Objects: the setting, saved.
    'canvas.snapToObjects': () => void settingsState.setObjectSnap(!settingsState.objectSnap).then(reportSettingsError),
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

  // The Document pane: the page's editor and its menus.
  let docPane: DocumentPane | undefined = $state();
  let canvasHost: HTMLDivElement;

  // What is on the canvas: every element, as the status bar counts it.
  const nodeCount = $derived(published.elements.length);

  // The status bar describes the side being worked on: the one last pressed
  // or focused, when both show.
  let lastWorkedIn = $state.raw<StatusSide>('document');
  const statusSide = $derived(statusContext(view.mode, lastWorkedIn));
  // The page's words and characters, or the selection's.
  let docCounts = $state.raw({ words: 0, characters: 0 });
  // Where the open page is, for the page header: its folders, then its name.
  const pageCrumbs = $derived(
    !doc.isOpen ? [] : openRel ? openRel.replace(/\.md$/i, '').split('/') : [pageTitle(doc.path) ?? t('file.untitled')],
  );
  const documentCounts = $derived(docCounts);
  $effect(() => {
    const note = (event: Event) => {
      const side = (event.target as Element | null)?.closest?.('[data-side]')?.getAttribute('data-side');
      if (side === 'document' || side === 'canvas') lastWorkedIn = side;
    };
    document.addEventListener('pointerdown', note, true);
    document.addEventListener('focusin', note, true);
    return () => {
      document.removeEventListener('pointerdown', note, true);
      document.removeEventListener('focusin', note, true);
    };
  });

  onMount(() => {
    // Captured: `bind:this` is nulled when the snippet's DOM is torn down,
    // which happens before this cleanup runs.
    const diagramHost = canvasHost;
    canvasHostEl = diagramHost;

    // A save reads the page's text from the editor, not on every keystroke.
    const unbindSource = doc.bindSource(() => docPane?.markdown() ?? doc.source);
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
      canvas.setSnapGuides(pointer.snapGuides);
      // The shapes this arrow would attach to, shown while it is drawn.
      canvas.setBindingCandidates(pointer.bindingCandidates, pointer.snapSpots);
    });
    const drawPan = frameThrottle(() => applyView());
    // What the pointer is over, looked up once a frame: a disc under the
    // handle it is on (none while dragging), and the cursor.
    const drawHover = frameThrottle((point: { x: number; y: number }, alt: boolean, shift: boolean) => {
      canvas.setHoverHandle(pointer.hoveredHandle(point));
      // In point editing, Alt shows the point an Alt-click would add.
      if (pointer.editingPoints && !pointer.dragging) canvas.render((alt ? pointer.appendPreview(point, { shift }) : null) ?? history.current);
      updateCursor();
      // With the Arrow tool, the shape a press would start on.
      if (!pointer.dragging && !pointer.drawingPoints) canvas.setBindingCandidates(pointer.bindingCandidates);
      // With a tool that places a box, where its start would snap.
      if (!pointer.dragging) canvas.setSnapGuides(pointer.snapGuides);
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
        // Placed where the click snaps, as a drawn box starts.
        const point = pointer.snapPlacement(scenePoint(event), { mod: event.metaKey || event.ctrlKey });
        canvas.setSnapGuides([]);
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
      canvas.setSnapGuides([]);
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
      const hit = rightClickHit(history.current, scenePoint(event as PointerEvent));
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
      // before it could open the label editor. On a bend it removes nothing,
      // as in Excalidraw.
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
      const menuOpen = contextMenu !== null || filesMenuAt !== null || treeMenuAt !== null;
      if (canvasKeyStandsDown(event.target as Element | null, event.key, event.defaultPrevented, menuOpen)) return;
      if (editTarget(event.target as Element | null, { canvasVisible: canvasShown() }) !== 'canvas') return;
      spaceHeld = true;
      updateCursor();
      event.preventDefault();
    };
    const releaseSpace = () => (spaceHeld = false);
    diagramHost.addEventListener('pointerdown', onDown);
    diagramHost.addEventListener('pointermove', onMove);
    // Leaving the canvas, nothing on it is hovered any more: without this the
    // disc drawn by the last move inside (on a handle) stays until the next.
    const onLeave = () => {
      drawHover.cancel();
      canvas.setHoverHandle(null);
    };
    diagramHost.addEventListener('pointerleave', onLeave);
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
    // cut, copy or paste; the canvas opens Bava's menu itself.
    const onAnyContextMenu = (event: MouseEvent) => {
      if (!keepsBrowserMenu(event.target as Element | null)) event.preventDefault();
    };
    window.addEventListener('contextmenu', onAnyContextMenu);
    // Files may have changed outside Bava (Finder, sync): re-read the tree,
    // and which links reach a page.
    const onWindowFocus = () => {
      void space.refresh();
      void docPane?.refreshLinks();
    };
    window.addEventListener('focus', onWindowFocus);

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
      const menuOpen = contextMenu !== null || filesMenuAt !== null || treeMenuAt !== null;
      if (canvasKeyStandsDown(event.target as Element | null, event.key, event.defaultPrevented, menuOpen)) return;
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
          // An attached arrow whose shape is not selected stays put.
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
    // Files dragged from the desktop onto the Document, added where they land.
    const offDrop = Events.On('files:dropped', (event) => {
      const drop = event.data as { paths: string[]; x: number; y: number };
      void addMediaFiles(drop.paths.map((path) => ({ path })), { x: drop.x, y: drop.y });
    });
    // Told once: the previous session ended unexpectedly, or the webview was
    // reloaded after its process died.
    void LogService.TakeNotices()
      .then((notices) => (notices ?? []).forEach((notice) => errors.notice(notice as GoNotice)))
      .catch((error: unknown) => void report(error, 'notices'));

    return () => {
      removeErrorHandlers();
      offAppError();
      offDrop();
      offMenu();
      window.removeEventListener('keydown', onShortcut, true);
      clearTimeout(noticeTimer);
      window.removeEventListener('blur', onBlur);
      autosave.destroy();
      diagramHost.removeEventListener('pointerdown', onDown);
      diagramHost.removeEventListener('pointermove', onMove);
      diagramHost.removeEventListener('pointerleave', onLeave);
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
      window.removeEventListener('focus', onWindowFocus);
      window.removeEventListener('keydown', onSpace);
      window.removeEventListener('keyup', onSpace);
      window.removeEventListener('keydown', onModifier);
      window.removeEventListener('keyup', onModifier);
      window.removeEventListener('blur', releaseSpace);
      sizeObserver?.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      unbindSource();
      canvas.destroy();
      theme.destroy();
    };
  });

  // Effects belong at initialisation, not inside onMount: an effect created in
  // a mount callback is orphaned and Svelte throws.
  //
  // Each page that arrives is handed to the Document editor once: opening,
  // reloading, a new page, closing. Never while it is being typed in. A pane
  // mounted again (after a failure) is handed the page too; until then saving
  // reads the file's text, never an empty editor.
  $effect(() => {
    const pane = docPane;
    void doc.generation;
    untrack(() => pane?.setPage(doc.source, doc.path));
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
      hasSpace: space.root !== null,
      objectSnap: settingsState.objectSnap,
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
    untrack(canvasChanged);
  });

  // Repaint when a new snapshot is published.
  $effect(() => {
    canvas.render(published);
    void highlightBlocks(published);
  });
</script>

{#snippet filesSection()}
    <div class="files-header">
      <button type="button" class="files-fold" data-section="files" aria-expanded={!view.filesFolded} onclick={() => foldSection('files')}>
        <span class="files-chevron" class:folded={view.filesFolded}><ToolIcon id="chevronDown" size="sm" /></span>
        <span class="files-title">{t('pane.files')}</span>
      </button>
      <button
        type="button"
        class="bava-icon-button files-button"
        aria-label={t('tree.add')}
        title={t('tree.add')}
        aria-haspopup="menu"
        onclick={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          filesMenuAt = { x: box.left, y: box.bottom };
        }}
      >
        <ToolIcon id="more" size="sm" />
      </button>
    </div>
    {#if !view.filesFolded}
      <div class="side-scroll">
      <SpaceTree
        folders={space.folders}
        rows={space.rows}
        expanded={space.expanded}
        pending={space.pending}
        activePath={openRel}
        unsavedPath={doc.dirty ? openRel : null}
        {renameRequest}
        menuPath={treeMenuAt?.path ?? null}
        onRenameStarted={() => (renameRequest = null)}
        onToggle={(folder) => void space.toggle(folder)}
        onOpen={(path) => void openPath(space.absolute(path))}
        onRename={(path, name) => void relocate({ kind: 'rename', path, name })}
        onCommitNew={(name) => void commitNew(name)}
        onCancelNew={() => space.cancelNew()}
        onMove={(path, folder, index) => void relocate({ kind: 'move', path, folder, index })}
        onTrash={(path) => void trashPath(path)}
        onContextMenu={(path, anchor) => (treeMenuAt = { path, anchor })}
      />
      </div>
    {/if}
{/snippet}

{#snippet mediaSection()}
  <div class="files-header">
    <button type="button" class="files-fold" data-section="media" aria-expanded={!view.mediaFolded} onclick={() => foldSection('media')}>
      <span class="files-chevron" class:folded={view.mediaFolded}><ToolIcon id="chevronDown" size="sm" /></span>
      <span class="files-title">{t('pane.media')}</span>
    </button>
  </div>
  {#if !view.mediaFolded}
    <MediaSection
      items={mediaList}
      thumb={mediaThumb}
      onAdd={() => void addToMedia()}
      onOpenDialog={() => {
        mediaDialogOpen = true;
        void refreshMedia();
      }}
      onPlace={(name) => {
        // Only into a page shown in the Document.
        if (!doc.isOpen || openRel === null || !view.showsDocument) return;
        docPane?.insertMedia([name]);
        void refreshMedia();
      }}
    />
  {/if}
{/snippet}

{#snippet filesSettings()}
  <FilesSection
    mode={settingsState.autosave}
    delayMs={settingsState.autosaveDelayMs}
    onModeChange={(mode) => void settingsState.setAutosave(mode).then(reportSettingsError)}
    onDelayChange={(ms) => void settingsState.setAutosaveDelay(ms).then(reportSettingsError)}
  />
{/snippet}

{#snippet canvasSettings()}
  <CanvasSection
    arrowBinding={settingsState.arrowBinding}
    midpointSnap={settingsState.midpointSnap}
    objectSnap={settingsState.objectSnap}
    onArrowBindingChange={(on) => void settingsState.setArrowBinding(on).then(reportSettingsError)}
    onMidpointSnapChange={(on) => void settingsState.setMidpointSnap(on).then(reportSettingsError)}
    onObjectSnapChange={(on) => void settingsState.setObjectSnap(on).then(reportSettingsError)}
  />
{/snippet}

{#snippet advancedSettings()}
  <AdvancedSection
    verbose={settingsState.verboseLogging}
    onVerboseChange={(on) => void settingsState.setVerboseLogging(on).then(reportSettingsError)}
  />
{/snippet}

<!-- Inert while the splash covers it: no focus or reading behind the cover. -->
<div class="app" inert={!launch.ready}>
<Shell
  open={doc.isOpen || space.root !== null}
  pageOpen={doc.isOpen}
  {...statusLocation({ spaceRoot: space.root, spaceName: space.name, pagePath: openRel, filePath: doc.path ?? null })}
  hints={noFileHints}
  title={pageTitle(doc.path) ?? t('file.untitled')}
  dirty={doc.dirty}
  engine={doc.isOpen && statusSide === 'canvas' ? settingsState.layoutEngine : undefined}
  nodes={doc.isOpen && statusSide === 'canvas' ? nodeCount : undefined}
  words={doc.isOpen && statusSide === 'document' ? documentCounts.words : undefined}
  characters={doc.isOpen && statusSide === 'document' ? documentCounts.characters : undefined}
  status={notice ??
    (autosave.pauseReason === 'conflict'
      ? t('status.autosavePaused')
      : autosave.pauseReason === 'error'
        ? t('status.autosaveFailed')
        : undefined)}
  themeChoice={theme.choice}
  onChooseTheme={(choice) => theme.set(choice)}
  pageWidth={settingsState.pageWidth}
  onPageWidth={(width) => void settingsState.setPageWidth(width)}
  {view}
  bind:settingsOpen
  settings={[
    { value: 'files', label: t('settings.files'), icon: 'folder', content: filesSettings },
    { value: 'canvas', label: t('settings.canvas'), icon: 'grid', content: canvasSettings },
    { value: 'advanced', label: t('settings.advanced'), icon: 'code', content: advancedSettings },
  ]}
  onPanelError={(panel, error) => void report(error, `panel:${panel}`)}
>


  {#snippet start()}
    <StartScreen
      recents={spaceChoices(recents.entries, missingSpaces).map((choice) => ({
        path: choice.path,
        name: choice.name,
        when: choice.openedAt ? new Date(choice.openedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '',
        missing: choice.missing,
      }))}
      onNewSpace={openNewSpace}
      onOpenSpace={() => void chooseSpace()}
      onOpenFile={() => void openFile()}
      onOpenRecent={(path) => void openPath(path)}
      onRemoveRecent={(path) => void removeSpace(path)}
    />
  {/snippet}

  {#snippet files()}
    {#if space.root}
      <SpaceSwitcher
        name={space.name}
        root={space.root}
        recents={spaceChoices(recents.entries, []).map(({ path, name }) => ({ path, name }))}
        onSelect={(id) => {
          if (id.startsWith('recent:')) void openSpace(id.slice('recent:'.length));
          else if (id === 'space.new') openNewSpace();
          else if (id === 'space.open') void chooseSpace();
          else if (id === 'file.open') void openFile();
          else if (id === 'space.trash') void openTrash();
          else if (id === 'space.settings') spaceSettingsOpen = true;
          else if (id === 'space.remove' && space.root) void removeSpace(space.root);
        }}
      />
      <div class="side-sections">
        {#if view.filesFolded || view.mediaFolded}
          <div class="side-section" class:grow={!view.filesFolded}>{@render filesSection()}</div>
          <div class="side-section" class:grow={view.filesFolded && !view.mediaFolded}>{@render mediaSection()}</div>
        {:else}
          <Splitter
            orientation="vertical"
            panels={[
              { id: 'files', size: 100 - view.mediaShare, minSize: MEDIA_SHARE.files },
              { id: 'media', size: view.mediaShare, minSize: MEDIA_SHARE.min },
            ]}
            onSizeChange={(sizes) => view.setMediaShare(sizes[1])}
          >
            {#snippet panel(id)}
              <div class="side-section grow">
                {#if id === 'files'}{@render filesSection()}{:else}{@render mediaSection()}{/if}
              </div>
            {/snippet}
          </Splitter>
        {/if}
      </div>
    {:else if doc.path}
      <div class="not-in-space">
        <EmptyState title={t('tree.notInSpace')} body={t('tree.notInSpaceBody')} />
        <button type="button" class="bava-button" onclick={() => void openSpace(doc.path!.replace(/[\\/][^\\/]*$/, ''), true)}>{t('tree.openAsSpace')}</button>
      </div>
    {:else}
      <EmptyState title={t('file.noFolder')} body={t('file.noFolderBody')} mark />
    {/if}
  {/snippet}
  {#snippet document()}
    <DocumentPane
      bind:this={docPane}
      crumbs={pageCrumbs}
      spaceWidth={space.pageWidth}
      appWidth={settingsState.pageWidth}
      onEdit={() => {
        doc.touch();
        autosave.changed();
      }}
      onCounts={(counts) => (docCounts = counts)}
      onDuplicatePage={() => openRel && void duplicatePath(openRel)}
      onTrashPage={() => openRel && void trashPath(openRel)}
      onCopyText={(text) => void Clipboard.SetText(text)}
      here={space.root ? openRel : null}
      {mediaPlace}
      readIndex={(withText) => space.index(withText)}
      onFollow={(href) => void followLink(href)}
      onOpenPage={(path) => void openPath(space.absolute(path))}
      onChooseMedia={(kind) => void chooseMedia(kind)}
      onOpenFile={(href) => void openFromPage(href)}
      fileDetails={(root, path) => FileService.FileDetails(root, path)}
      fetchCard={async (address) => {
        // Pictures are kept only in the Space the page is in.
        const details = await SpaceService.FetchCard(space.root !== null && openRel !== null ? space.root : '', address);
        return details.error ? null : details;
      }}
      onPasteImage={() => void pasteImage()}
      onReplaceMedia={replaceMedia}
      onRenameAttachment={(name, next) =>
        void renameAttachment(name, next).then((refusal) => {
          if (refusal) notify(refusal);
        })}
      onRevealFile={(path) => void revealPath(path)}
      onAttachPoster={async (data, name) => {
        const result = await space.apply({ kind: 'attachData', data, name }, { refresh: false });
        if (result.error) notify(result.error);
        return result.error ? null : (result.name ?? null);
      }}
      onNotify={notify}
      embeds={embedContext}
      onCanvas={(what, at) => {
        if (what === 'embed') void pickFrame(at);
        else void openDiagramForPage();
      }}
    />
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
              // the same step.
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
      if (id === EMBED_IN_DOCUMENT) {
        void embedSelectedFrame();
        return;
      }
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

{#if framePicker}
  <FramePicker at={framePicker.at} groups={framePicker.groups} onPick={(frame, page) => void embedPicked(frame, page)} onClose={closeFramePicker} />
{/if}

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
    title={errorTitle[errors.current.kind]}
    body={t(bodyKeyFor(errors.current))}
    details={errors.current.details}
    onCopyDetails={(details) => void copyText(details, t('error.detailsCopied'))}
    onOpenLogs={() => void openLogsFolder()}
    onClose={() => errors.dismiss()}
  />
{/if}
{/key}

<AboutDialog bind:open={aboutOpen} onOpenChange={(open) => (aboutOpen = open)} />

{#if space.root}
  <MediaDialog
    open={mediaDialogOpen}
    items={mediaList}
    usageKnown={mediaUsageKnown}
    thumb={mediaThumb}
    onOpenChange={(open) => {
      mediaDialogOpen = open;
      if (open) void refreshMedia();
    }}
    onAdd={() => void addToMedia()}
    onRename={(name, next) => renameAttachment(name, next)}
    onDelete={(item) => void deleteMediaItem(item)}
    onReveal={(name) => void revealPath(`.bava/attachments/${name}`)}
    onOpenPage={(path) => {
      mediaDialogOpen = false;
      void openPath(space.absolute(path));
    }}
    onTrashUnused={() => void trashUnusedMedia()}
  />
{/if}

<TrashDialog
  bind:open={trashOpen}
  items={trashItems.map((item) => ({ ...item, size: formatBytes(item.size) }))}
  total={formatBytes(trashSize)}
  onRestore={(id) => void restoreItem(id)}
  onDelete={(id) => void deleteItem(id)}
  onEmpty={() => void emptyTrash()}
  onOpenChange={(open) => (trashOpen = open)}
/>

{#if space.root}
  <SpaceSettingsDialog
    bind:open={spaceSettingsOpen}
    name={space.name}
    root={space.root}
    pageWidth={(space.pageWidth as '' | 'narrow' | 'wide' | 'full') ?? ''}
    onSave={(changes) => void saveSpaceSettings(changes, { setWidth: setSpacePageWidth, rename: renameSpace })}
    onReveal={() => void revealPath()}
    onOpenChange={(open) => (spaceSettingsOpen = open)}
  />
{/if}

<NewSpaceDialog
  bind:open={newSpaceOpen}
  location={newSpaceLocation}
  onChooseLocation={() => void chooseNewSpaceLocation()}
  onCreate={(name) => createNewSpace(name)}
  onOpenChange={(open) => (newSpaceOpen = open)}
/>

<ContextMenu
  items={treeMenu(null, (key) => t(key as MessageKey))}
  open={filesMenuAt !== null}
  anchor={filesMenuAt}
  onSelect={(id) => {
    filesMenuAt = null;
    if (id === 'tree.newPage') void newPage();
    else if (id === 'tree.newFolder') newFolder();
  }}
  onOpenChange={(open) => {
    if (!open) filesMenuAt = null;
  }}
/>

<ContextMenu
  items={treeMenu(treeMenuKind, (key) => t(key as MessageKey))}
  open={treeMenuAt !== null}
  anchor={treeMenuAt?.anchor ?? null}
  onSelect={onTreeMenu}
  onOpenChange={(open) => {
    if (!open) treeMenuAt = null;
  }}
/>

{#if confirming}
  <ConfirmDialog
    open
    title={confirming.title}
    body={confirming.body}
    options={[
      { value: 'cancel', label: t('file.cancel') },
      { value: 'yes', label: confirming.yes, primary: true },
    ]}
    onChoose={(choice) => {
      const pending = confirming;
      confirming = null;
      pending?.resolve(choice === 'yes');
    }}
  />
{/if}

{#if prompt?.kind === 'unsaved'}
  <ConfirmDialog
    open
    title={t('file.unsaved.title')}
    body={unsavedBody(doc.path)}
    options={[
      { value: 'cancel', label: t('file.cancel') },
      { value: 'discard', label: t('file.unsaved.discard') },
      { value: 'save', label: t('file.unsaved.save'), primary: true },
    ]}
    onChoose={answer}
  />
{:else if removing}
  <ConfirmDialog
    open
    title={t('space.remove.title').replace('{name}', removing.name)}
    body={t('space.remove.body')}
    options={[
      { value: 'cancel', label: t('file.cancel') },
      { value: 'remove', label: t('space.remove.confirm'), primary: true },
    ]}
    check={removing.missing ? undefined : { label: t('space.remove.deleteData'), hint: t('space.remove.deleteDataHint') }}
    onChoose={(choice, checked) => {
      const pending = removing;
      removing = null;
      pending?.resolve({ remove: choice === 'remove', deleteData: checked });
    }}
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
  /* The Files section's heading in the side pane, with its Add menu. */
  .files-header {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-2) var(--space-4) var(--space-1);
  }

  .files-fold {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--color-text-muted);
    font: inherit;
    border-radius: var(--radius-sm);
  }

  .files-fold:hover:not(:disabled) {
    background: var(--color-control-hover);
  }

  .files-fold:active:not(:disabled) {
    background: var(--color-control-active);
  }

  .files-fold:focus-visible {
    outline: var(--focus-ring-width) solid var(--color-focus-ring);
  }

  .files-chevron {
    display: inline-flex;
    transition: transform var(--duration-fast) var(--ease-out);
  }

  .files-chevron.folded {
    transform: rotate(-90deg);
  }

  .files-title {
    font-size: var(--text-label);
    font-weight: var(--weight-semibold);
    letter-spacing: var(--tracking-label);
    text-transform: uppercase;
    color: var(--color-text-muted);
  }

  /* Files and Media share the side pane's height, either folding away. */
  .side-sections {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
  }

  .side-section {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }

  .side-section.grow {
    flex: 1;
    height: 100%;
  }

  .side-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .files-button {
    width: var(--size-row);
    height: var(--size-row);
    margin-inline-start: auto;
  }

  /* A loose page: the prompt to open its folder as a Space. */
  .not-in-space {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-3);
    padding-block-end: var(--space-6);
  }

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
