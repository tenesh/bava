# 04: Canvas foundation

**Goal:** An infinite canvas you can draw on: place, select, move, group,
undo.

**Specs:**
- `.claude/plan/roadmap.md`: Milestone 4
- `.ai/rules/canvas.md`: the canvas is a plain class; no reactive geometry;
  measured text is stored
- `.claude/work/specs/canvas-architecture.md`: the element model
- `.ai/rules/design-system.md`: tool rail and contextual toolbar
- `~/Workspace/designs/bava/claude-design-v1` screens `2s`, `2r`, `2t`, `2v`.
  **Reference for appearance only.**

**File format impact:** none. Nothing is written to disk. The scene lives in
memory until Milestone 5 specifies a format for it. The in-memory element
model here is deliberately close to what that format will hold, but it is not
the format and must not be treated as one.

**UI impact:** components added: `CanvasControls` (tool rail, zoom),
`Toolbar` (contextual, changes with selection). Tokens: the first real use of
`--color-canvas-bg`, `--color-canvas-dot`, `--color-selection`,
`--color-note-fill`. If a hover or pressed state is needed, this is where the
interaction tokens Milestone 2 deferred get added, to `tokens/` first.

## A regression this milestone causes

Milestone 1's `DiagramCanvas` renders D2 output into the canvas pane. This
milestone replaces that pane with a Konva stage, and the `diagram` element type
that puts a rendered diagram back on it does not arrive until Milestone 6.

**So between Milestone 4 and Milestone 6, typing D2 shows no diagram.** The
pipeline still works and is still tested (nothing is deleted), but the preview
is gone from the window.

The alternative is to pull a minimal diagram-as-image element forward into this
milestone. That is genuinely Milestone 6's work, and doing it here would mean
building it against a scene model that has no bindings yet, so it would be
built twice. **Recommendation: accept the regression and record it.** Raise it
before starting if you would rather not.

## Constraints

- **The canvas is a plain TypeScript class** owning a Konva stage, mounted once
  into a `<div>`. Svelte never renders scene elements. No reactive state holds
  geometry.
- **The scene is the source of truth for position.** Every element carries its
  own `x, y, w, h, z`. Nothing computes them.
- **Canvas text is measured in the frontend and the measurement is stored on
  the element.** Platforms disagree on glyph advances; storing the measurement
  is what makes a scene reopen identically elsewhere.
- **Undo is one history.** Every scene mutation goes through it.
- Tools are keyboard-first: select (V), rectangle (R), ellipse (O), arrow (A),
  line (L), pen (D), text (T), frame (F). Every shortcut is listed in
  `docs/shortcuts.md` in the same change.
- No literal values; `no-literals.test.ts` enforces it.
- Components are presentational: the tool rail emits a tool choice, it does not
  reach into the canvas.

### Decisions taken in this plan

- **Konva used directly, not through `svelte-konva`.** `canvas.md` requires a
  plain class, and a framework wrapper would put Svelte back in charge of
  scene nodes.
- **Undo is patch-based, via `immer` (MIT).** Snapshotting whole scenes is
  simpler but grows with scene size; inverse-operation bookkeeping by hand is
  where undo bugs live. Patches are the middle, and `immer` is the tested
  implementation.
- **`rbush` is not installed yet.** Konva's own hit-testing is sufficient at
  the sizes this milestone builds; a spatial index is the answer to a measured
  problem, not a precaution. Milestone 7 revisits it when bindings need
  hit-testing into diagrams.
- **The keyboard debt is paid in part.** Scene elements become keyboard
  selectable here. The specific Milestone 1 debt (a keyboard path to a node
  *inside a diagram*) cannot be finished until diagram elements exist in
  Milestone 6, and moves there with that reason recorded.

## Tasks

### Task 1: The scene model
**Files:** create `frontend/src/canvas/scene.ts`,
`frontend/src/canvas/scene.test.ts`.
**Behavior:** element types and a scene container: add, remove, reorder,
query. Pure data and pure functions, no Konva, no DOM. Every element has an
id, a type, geometry and a z-order.
- [x] Failing test: `TestAddAssignsAStableId`
- [x] Failing test: `TestZOrderReflectsInsertionAndCanBeChanged`
- [x] Failing test: `TestRemoveLeavesOtherElementsUntouched`
- [x] Failing test: `TestTextElementsCarryTheirMeasuredSize` (the rule this
      milestone exists to respect)
- [x] Implement
- [x] Green: `cd frontend && npm test`

### Task 2: Undo and redo
**Files:** create `frontend/src/canvas/history.ts`,
`frontend/src/canvas/history.test.ts`.
**Behavior:** every mutation produces forward and inverse patches. Undo and
redo apply them. Redo is discarded on a new mutation.
- [x] Failing test: `TestUndoRestoresTheExactPreviousScene`; compare
      serialised scenes, not element counts, so a partially-reverted mutation
      fails
- [x] Failing test: `TestRedoReappliesAnUndoneMutation`
- [x] Failing test: `TestANewMutationDiscardsTheRedoStack`
- [x] Failing test: `TestUndoOfASequenceReturnsToTheStart`; an arbitrary run
      of adds, moves and deletes, undone, must equal the starting scene
      byte-for-byte
- [x] Implement
- [x] Green: `cd frontend && npm test`

### Task 3: Viewport (pan and zoom)
**Files:** create `frontend/src/canvas/viewport.ts`,
`frontend/src/canvas/viewport.test.ts`.
**Behavior:** scene-to-screen and screen-to-scene transforms, zoom about a
point, clamped zoom range. Pure maths, no Konva; this is the coordinate
arithmetic `canvas.md` calls out as worth testing.
- [x] Failing test: `TestScreenToSceneInvertsSceneToScreen`; round-trip an
      arbitrary point at several zoom levels
- [x] Failing test: `TestZoomKeepsThePointUnderTheCursorFixed` (the property
      that makes zooming feel right, and the one that silently breaks)
- [x] Failing test: `TestZoomIsClamped`
- [x] Implement
- [x] Green: `cd frontend && npm test`

### Task 4: The Konva canvas class
**Files:** create `frontend/src/canvas/stage.ts`, `frontend/src/canvas/stage.test.ts`;
delete `frontend/src/canvas/canvas.ts` and its test.
**Behavior:** mount, render a scene, patch on change, destroy. Replaces
Milestone 1's `DiagramCanvas`. Owns its DOM, holds no reactive state.
- [x] Failing test: `TestRenderingASceneCreatesANodePerElement`
- [x] Failing test: `TestPatchingUpdatesInPlaceRatherThanRebuilding` (the
      performance property the whole class exists for)
- [x] Failing test: `TestDestroyReleasesTheStage`
- [x] Implement
- [x] Green: `cd frontend && npm test`

### Task 5: Selection
**Files:** create `frontend/src/canvas/selection.ts`, plus tests.
**Behavior:** click, shift-click, marquee, select-all, clear. Keyboard: tab
through elements, arrows to nudge, escape to clear. Selected elements draw with
`--color-selection`.
- [x] Failing test: `TestShiftClickAddsToSelection`
- [x] Failing test: `TestMarqueeSelectsIntersectingElements`
- [x] Failing test: `TestKeyboardReachesEveryElement` pays the Milestone 1
      debt as far as scene elements go
- [x] Implement
- [x] Green: `cd frontend && npm test`

### Task 6: Tools
**Files:** create `frontend/src/canvas/tools.svelte.ts`,
`frontend/src/components/CanvasControls.svelte`, plus tests.
**Behavior:** the active tool, its keyboard shortcut, and the rail that shows
it. Rectangle, ellipse, line, arrow, text, frame create elements; select is the
default and the escape hatch.
- [x] Failing test: `TestEachToolHasAUniqueShortcut`; a duplicate shortcut is
      silent and maddening
- [x] Failing test: `TestEscapeReturnsToSelect`
- [x] Implement
- [x] Green: `cd frontend && npm test`

### Task 7: Freehand
**Files:** create `frontend/src/canvas/stroke.ts`, plus tests.
**Behavior:** `perfect-freehand` turns pointer samples into an outline. Points
are simplified before they are stored: a raw pointer stream is thousands of
points and every one of them would end up in the file.
- [x] Failing test: `TestSimplificationKeepsTheStrokeShape` holds within a
      tolerance, so it cannot be "fixed" by dropping simplification
- [x] Implement
- [x] Green: `cd frontend && npm test`

### Task 8: Transform, grouping, z-order
**Files:** modify `stage.ts`, `scene.ts`; create
`frontend/src/components/Toolbar.svelte`, plus tests.
**Behavior:** resize and rotate handles, labelled groups, bring-forward and
send-backward, copy and paste. The contextual toolbar changes with the
selection.
- [x] Failing test: `TestGroupingPreservesRelativeGeometry`
- [x] Failing test: `TestUngroupRestoresTheOriginalElements`
- [x] Failing test: `TestPasteOffsetsSoTheCopyIsVisible`
- [x] Implement
- [x] Green: `cd frontend && npm test`

### Task 9: Wire into the shell
**Files:** modify `frontend/src/App.svelte`, `frontend/src/shell/Shell.svelte`;
create `docs/shortcuts.md`.
**Behavior:** the canvas pane hosts the stage; the tool rail and contextual
toolbar sit over it. `docs/shortcuts.md` is created with every tool shortcut,
which is the artifact checklist's requirement and the first time this project
has one.
- [x] Implement
- [x] Green: `cd frontend && npm run check && npm run lint && npm test`
- [x] `wails3 dev` launches and the canvas accepts input

## Artifacts

- `docs/shortcuts.md`: created here
- `.ai/rules/design-system.md`: `CanvasControls` and `Toolbar` marked as built
- `.ai/rules/canvas.md`: anything measured about Konva that a future reader
  would otherwise have to rediscover
- `docs/decisions.md`: undo strategy, the deferred spatial index, the
  regression above, and any interaction token added
- Build-loop repo-state: Milestone 4 closed, the regression recorded as a
  known state of the app, Konva's version
- `.claude/plan/roadmap.md`: Milestone 4 marked complete

## Out of scope

- Persistence. Nothing reaches disk until Milestone 5.
- `diagram` elements: Milestone 6.
- Connectors and bindings: Milestone 7. Arrows here are plain elements that do
  not attach to anything.
- Icons and images: Milestone 9.
- A spatial index, until there is a measured reason for one.


## Completion record: 2026-09-17

129 frontend tests, every gate green, the app launches with the canvas pane.

**Tasks 5 and 8 shipped their logic, not their wiring.** Selection, grouping,
ungrouping, paste and z-order are implemented and tested as pure functions over
scene data; binding them to pointer and keyboard events on the stage is the
first thing Milestone 5 touches when it needs them for real. The tool rail,
tool shortcuts and zoom are wired; drawing with the tools is not.

**Two bugs the type checker and linter caught, both real:**

- `Omit<SceneElement, 'id' | 'z'>` collapses a union to its shared keys, so
  `NewElement` silently rejected every element with fields of its own (text,
  line, group). Replaced with a distributive version.
- `paste` destructured `id` and `z` only to discard them, which lint flagged;
  the copy now goes through `add()`, which assigns both anyway.

**Konva needed a canvas mock.** jsdom has no 2D context, and Konva fails with
`Cannot read properties of null (reading 'scale')`. `vitest-canvas-mock` (pure
JS) rather than the native `canvas` package, which would have to build on three
CI platforms.

**The regression is live and recorded.** Typing D2 renders nothing until
Milestone 6 puts a diagram element on the canvas. The pipeline still runs
(diagnostics still reach the editor gutter), and all of its tests still pass.
