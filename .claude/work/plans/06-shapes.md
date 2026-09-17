# 06: Shapes that look right

**Goal:** Everything drawn on the canvas is visible, styled, selectable and
saved intact, with the shape set diagrams need.

**Specs:**
- `.claude/work/specs/diagrams-as-shapes.md` — decisions made 2026-09-17
  (shape set, palette, labels)
- `.claude/work/specs/canvas-architecture.md` — the parts not superseded
  (element model, free placement, Konva, text measurement)
- `docs/file-format.md` — preservation, measured text, pretty-printing
- `.ai/rules/canvas.md`, `.ai/rules/file-format.md`,
  `.ai/rules/design-system.md`, `.ai/rules/svelte.md`
- `.claude/plan/roadmap.md` — Milestone 6

**File format impact:**
- New element types: `diamond`, `cylinder`, `hexagon`, `parallelogram`,
  `document`, `person`, `cloud`.
- New optional keys on shapes: `label`, `fill`, `stroke`, `color`.
- Line and arrow keep `points`.

All of it is specified in `docs/file-format.md` (Task 2) before any code writes
it, with a round-trip test.

**UI impact:**
- Added:
  - `StyleBar` (selection toolbar with swatch pickers, wrapping Ark Popover)
  - a shapes menu on the tool rail (wrapping Ark Menu)
  - a label editor overlay
- Tokens added:
  - `--swatch-<name>-fill/-stroke/-text` in both themes
  - `--color-shape-fill`, `--color-shape-stroke`, `--color-shape-text` for
    the unstyled default
  - `--color-selection-handle`
- Reused: `CanvasControls`, `Icon`, `Dialog` patterns.

## Constraints

- **Files are the source of truth.** An element is written back with every key
  it had, known or not. Any path from disk to the frontend and back to disk
  must preserve them (`docs/file-format.md`, "Unknown keys and unknown element
  types are preserved").
- **The canvas is not a Svelte component.** Konva nodes are created and
  patched by `CanvasStage`; no per-element Svelte components; no reactive
  geometry (`.ai/rules/canvas.md`).
- **Every mutation goes through `history.mutate`**, one step per gesture
  (a drag, a resize, a recolour, a label edit).
- **Tokens only.** `no-literals.test.ts` rejects hex, rgb and px anywhere in
  `src/` outside `styles/tokens/`, comments included. Konva needs concrete
  colours, so the stage resolves CSS variables at render time and re-renders
  on theme change.
- **Shape colours are scene data, not tokens** (decision 2026-09-17): the file
  stores a swatch *name*; the swatch's light and dark values are tokens.
- **Canvas text is measured in the frontend and stored** (`measuredWidth`,
  `measuredHeight` on text elements). A shape label wraps inside its shape's
  box and is not separately measured; see Task 2.
- Shape set, verbatim from the decision: rectangle, ellipse, diamond,
  cylinder, hexagon, parallelogram, document, person, cloud.
- Ark UI wrapped in `components/`, never imported by screens.

## Tasks

### Task 1: Elements survive the trip through the frontend
**Found while planning** — a data-loss bug in shipped code.

`format.Element` keeps unknown keys in `Raw json:"-"`. Wails encodes an opened
scene for the frontend without them, and decodes a saved scene from the
frontend into known fields only. Saving from the app therefore drops `points`,
`text`, `children` and every unknown key. A probe confirmed a stroke saved
with no points.

**Files:**
- modify `internal/format/file.go`
- create `internal/format/element_json_test.go`
- modify `internal/format/roundtrip_test.go`

**Behavior:** `Element` implements `MarshalJSON` and `UnmarshalJSON`, carrying
every key in both directions. Known fields are merged over the raw object,
exactly as `encodeElement` does today.
- [ ] Failing test: `TestElementJSONKeepsEveryKey` — decode then encode keeps
      `points`, `text` and an unknown key. Expected failure: they are dropped.
- [ ] Failing test: `TestSceneSurvivesTheFrontendBridge` — `Read` a file, send
      the scene through `json.Marshal`/`json.Unmarshal` (what Wails does), then
      `Write`: byte-identical. Expected failure: the canvas block loses keys.
- [ ] Implement
- [ ] Green: `go test ./internal/format`

### Task 2: Specify the shapes in the file format
**Files:**
- modify `docs/file-format.md`
- modify `internal/format/roundtrip_test.go` (fixture with every new shape)

**Behavior:** the format document gains a "Shapes" section:
- the nine shape types (`rect` and `ellipse` keep their names; seven are new)
- `label` (plain text, wraps inside the shape's box, not separately measured —
  a label reflowing by a glyph between platforms stays inside its box)
- `fill`, `stroke`, `color` as swatch names, where absent means the theme
  default and an unknown name renders as the default but is written back
  unchanged
- `points` on `line` and `arrow` relative to `x, y`
- the swatch names

- [ ] Write the section
- [ ] Failing test: `TestRoundTripEveryShapeWithLabelAndColours` — expected
      failure before Task 1 lands; after it, passes as a guard
- [ ] Green: `go test ./internal/format -run RoundTrip`

### Task 3: The swatch palette
**Files:**
- create `frontend/src/styles/tokens/_swatches.scss`
- create `frontend/src/canvas/palette.ts` and its test
- modify `frontend/src/styles/tokens.test.ts`

**Behavior:**
- Eight swatches: `gray`, `blue`, `green`, `yellow`, `orange`, `red`,
  `purple`, `pink`.
- Each has `-fill`, `-stroke` and `-text` values in light and dark, chosen so
  text on fill stays readable in each theme.
- `palette.ts` resolves a swatch name, or none, to concrete colours through an
  injected `(cssVar) => string` reader: `getComputedStyle` in the app, a map in
  tests.
- An unknown name resolves to the default.
- [ ] Failing test: every swatch defines fill, stroke and text in both themes
- [ ] Failing test: `resolveStyle` returns defaults for no swatch and for an
      unknown one
- [ ] Implement
- [ ] Green: `cd frontend && npx vitest run src/styles src/canvas/palette.test.ts`

### Task 4: Shape geometry
**Files:**
- create `frontend/src/canvas/shapes.ts` and its test

**Behavior:** a pure function per shape draws its outline into a path sink
(`moveTo`, `lineTo`, `bezierCurveTo`, `closePath`) for a given `w, h`. Konva's
`sceneFunc` calls it with the canvas context; tests call it with a recorder.
Every point stays inside `[0,w]×[0,h]`, and the diamond and hexagon hit their
defining vertices.
- [ ] Failing test: each of the seven new shapes stays within bounds at
      several sizes
- [ ] Failing test: diamond vertices at the edge midpoints; hexagon symmetric
- [ ] Implement
- [ ] Green: `cd frontend && npx vitest run src/canvas/shapes.test.ts`

### Task 5: The stage draws what the scene says
**Files:**
- modify `frontend/src/canvas/stage.ts`
- modify `frontend/src/canvas/stage.test.ts`
- modify `frontend/src/canvas/pointer.ts` and its test

**Behavior:**
- **Styles:**
  - every shape gets stroke, fill and stroke width from `palette.ts`
  - lines, arrows and pen strokes get a stroke
  - arrows get an arrowhead (`Konva.Arrow`)
  - frames draw a border and their label
  - text elements draw their text in the text colour
- **Labels:** a label draws centred and wrapped inside its shape.
- **Drawn lines and arrows:** the pointer creates them with `points` from drag
  start to end, relative to `x, y`.
- **Theme changes:** the stage re-resolves colours on a theme change
  (`restyle()`), without recreating nodes.
- [ ] Failing test: a rect node has a non-empty stroke and fill after render —
      expected failure: none set (the bug seen at the window)
- [ ] Failing test: a drawn arrow has two points and is a `Konva.Arrow`
- [ ] Failing test: a label renders as text inside the shape's bounds
- [ ] Failing test: `restyle()` changes colours on existing nodes, same node
      identity
- [ ] Implement
- [ ] Green: `cd frontend && npx vitest run src/canvas`

### Task 6: The new shapes as tools
**Files:**
- modify:
  - `frontend/src/canvas/tools.svelte.ts`
  - `frontend/src/components/CanvasControls.svelte`
  - `internal/app/menu/spec.json`
  - `frontend/src/shell/commands.ts`
  - `frontend/src/App.svelte`
  - `frontend/src/i18n/messages.ts`
- create `frontend/src/components/ShapeMenu.svelte` (wraps Ark Menu)

**Behavior:**
- **Rail:** one Shapes button opens a menu of the nine shapes. The rectangle
  keeps `R` and the ellipse `O`; the new shapes get no single-key hints, which
  keeps the letters free. The button shows the last shape chosen.
- **Menu:** Canvas ▸ Tools gains the seven shapes as radio items.
- **Drawing:** dragging with a shape tool creates that element type.
- [ ] Failing test: activating `diamond` then dragging creates a `diamond`
      element
- [ ] Failing test (spec guards, existing): every new menu id has a handler
- [ ] Implement
- [ ] Green: `go test ./internal/app/menu && cd frontend && npm test`
- [ ] Keyboard pass on the shape menu: arrows, Enter, Escape

### Task 7: Selection outline and resize
**Files:**
- modify `frontend/src/canvas/stage.ts`
- modify `frontend/src/App.svelte`
- create `frontend/src/canvas/resize.ts` and its test

**Behavior:**
- A `Konva.Transformer` outlines the selection with handles, in
  `--color-selection-handle`.
- Dragging a handle resizes; release commits one history step through
  `resize.ts`, a pure function from a handle drag to new geometry (minimum
  size, shift keeps aspect ratio).
- Lines and arrows scale their points.
- Rotation is out of scope.
- [ ] Failing test: `resize` from the bottom-right handle grows w and h and
      keeps x, y
- [ ] Failing test: a resize is one undo step
- [ ] Failing test: the stage attaches the transformer to the selected nodes
      only
- [ ] Implement
- [ ] Green: `cd frontend && npx vitest run src/canvas`

### Task 8: Zoom and pan reach the stage
**Files:**
- modify `frontend/src/canvas/stage.ts`
- modify `frontend/src/canvas/viewport.ts` and its test
- modify `frontend/src/App.svelte`

**Behavior:**
- **Transform:** the stage's scale and position follow the viewport.
- **Zoom:** ⌘/Ctrl + wheel and pinch zoom around the pointer. The menu's Zoom
  In, Zoom Out and Actual Size zoom around the centre.
- **Pan:** wheel scrolls, and space-drag or middle-drag pans.
- **Pointer:** coordinates stay correct under zoom, as the viewport already
  computes.
- [ ] Failing test: `zoomAt(point, factor)` keeps the scene point under the
      pointer fixed
- [ ] Failing test: after a zoom, the stage's scale equals the viewport's zoom
- [ ] Implement
- [ ] Green: `cd frontend && npx vitest run src/canvas`

### Task 9: Labels and text you can type
**Files:**
- create `frontend/src/canvas/label-editor.ts` and its test
- modify `frontend/src/App.svelte`

**Behavior:**
- **Opening:** double-clicking a shape, or pressing Enter with one shape
  selected, opens a textarea overlay positioned over the shape through the
  viewport transform. The same happens for text elements.
- **Committing:** Escape or a click away commits; the label is one history
  step. An empty label removes the key; an empty text element is deleted.
- **Measuring:** text elements are measured on commit and store
  `measuredWidth` and `measuredHeight`.
- **The overlay** is plain DOM, owned imperatively like the stage, not a
  Svelte component per element.
- [ ] Failing test: committing sets `label` in one history step
- [ ] Failing test: committing text stores its measurement
- [ ] Failing test: while the overlay is open, canvas keys stand down (typing
      "r" does not switch tools)
- [ ] Implement
- [ ] Green: `cd frontend && npm test`

### Task 10: Recolour a selection
**Files:**
- create `frontend/src/components/StyleBar.svelte` (wraps Ark Popover)
- create `frontend/src/canvas/style.ts` and its test
- modify `App.svelte` and `messages.ts`

**Behavior:**
- **The bar:** a floating bar under the canvas while something is selected,
  with fill, border and text pickers.
- **Swatches:** each picker is a grid of the eight swatches plus "default".
- **Applying:** choosing a swatch sets that key on every selected element in
  one history step. A mixed selection shows no swatch as current.
- **Scope:** only elements that have that property change (a pen stroke has no
  fill).
- [ ] Failing test: `applyStyle(selection, 'fill', 'blue')` is one step and
      skips elements without fill
- [ ] Failing test: `currentStyle` of a mixed selection is `mixed`
- [ ] Implement
- [ ] Green: `cd frontend && npm test`
- [ ] Keyboard pass: tab into the bar, arrows through swatches, Enter applies,
      Escape closes

## Artifacts

- `docs/file-format.md` — the Shapes section (Task 2)
- `.ai/rules/file-format.md` — preservation must be tested through the
  frontend bridge, not only Go read/write (Task 1's lesson)
- `.ai/rules/canvas.md`:
  - the stage resolves colours through CSS variables and re-styles on theme
    change
  - tests inspect Konva nodes, not only scene data
- `.ai/rules/design-system.md` — inventory: `StyleBar`, `ShapeMenu`; the
  swatch tokens
- `docs/shortcuts.md` — zoom gestures, pan, Enter to edit a label, the shape
  menu (checked against the spec by the existing test)
- `docs/decisions.md` — the swatch names; labels not separately measured; the
  Task 1 bug and its fix
- `docs/ipc.md` — `Scene` elements now carry every key both ways
- Build-loop repo-state, and roadmap Milestone 6 status

## Out of scope

- **Milestone 6.5:** arrows attached to shapes, and containers owning their
  contents.
- **Milestone 6.6:** D2 conversion and the Diagram from code dialog.
- **Milestone 7:** snapping arrow ends onto shapes.
- **Milestone 7:** rotation, stroke width and dash options (added to its
  scope in the roadmap in the same change as this plan).
- **Milestone 15:** arbitrary hex colours, with export, where exact colours
  matter most.
- **Milestone 9:** icons.
- **Milestone 15:** SQL table, UML class and code-block shapes.
