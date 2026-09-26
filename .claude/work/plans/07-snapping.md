# 07: Snapping and detached arrows

**Goal:** close Milestone 7: pin its three exit behaviours with tests, and add
Excalidraw's object snapping (edges, centres and equal spacing, with guides).

**Specs:**
- `.claude/plan/roadmap.md`, Milestone 7 (scope and exit criterion).
- `.claude/work/specs/excalidraw-object-snapping.md` (Excalidraw at `5db42c3`:
  rules, values, and the design for Bava this plan follows).
- The user's answers (2026-09-27): off by default; Alt+S toggles it; every
  element snaps by its box ("use the box rule"), a departure from Excalidraw.
- `.claude/work/specs/06.12-arrows-and-code.md`, decision 12 (Excalidraw wins
  unless the user says otherwise).
- `docs/decisions.md`, `docs/ipc.md`, `docs/shortcuts.md`
- `.ai/rules/canvas.md`, `.ai/rules/design-system.md`, `.ai/rules/wails.md`

**File format impact:** none. Snapping moves elements to positions the file
already stores; the setting lives in Bava's settings file, not in documents.

**UI impact:** no new component. Settings ▸ Canvas gains a third row, "Snap to
objects" (the existing Off/On `Segments`). The Canvas menu gains a "Snap to
Objects" checkbox. Tokens added: `--size-snap-distance` 8px,
`--size-snap-guide` 1px, `--size-snap-cross` 4px, `--size-snap-gap-tick` 16px,
`--size-snap-gap-mark` 8px, `--color-snap-guide` (light `#ff6b6b`, dark
`#ff9090`).

## What is already done

Milestone 7's scope was mostly built early: attaching with a visible target,
choosing the side, and freezing a detached end (6.5, 6.15, 6.16). Tests exist
for dropping an end on a shape attaching it (`pointer.test.ts:875`) and for a
lost target freezing as detached (`binding.test.ts:102`). Missing: deleting
the shape through the Delete command, and undo restoring the attachment.

## Constraints
- Threshold 8 screen px over the zoom, inclusive; X and Y decided separately;
  on each axis the nearest wins, point snaps first, then gap snaps on the same
  distance.
- Guides show exact alignments only: a second pass at distance 0 after the
  snap.
- Snap targets: elements in the viewport, not moving. **The box rule:**
  every element, whatever it draws, offers the nine points of its box: four
  corners, four side middles and the centre, turned with the element. A group
  is one box. A container's text joins its container. The moving selection
  offers the same nine points of its own box.
- Gap snaps for drags only. Resize: the handle's moving corners, never a single
  turned element, aspect lock applied after. Drawing a box shape (rectangle,
  ellipse, diamond, the other box shapes, frame, code, text): the origin snaps
  on hover and press, then the dragged corner.
- Never snaps: drawing lines, arrows or pen strokes, moving points, bends, segments, labels,
  rotation, arrow-key nudges.
- Holding ⌘ (macOS) or Ctrl inverts the setting, read on every move.
- Guides: solid, 1 screen px, crosses 2 px each way, gap ticks 8 px each way,
  two middle marks 4 px each way set 2 px either side of the middle, no
  distance labels. Cleared on release, press and tool change.
- Everything in the setting and toolbar path stays off the Svelte canvas: the
  stage draws guides on its non-listening overlay.

## The box rule, the user's departure from Excalidraw (2026-09-27)
Excalidraw gives a rectangle its corners and centre, and an ellipse or diamond
its side middles and centre. Bava gives every element all nine points of its
box, so there is one rule matching the selection box, a rectangle can line up
by its side middles, and new element types (images, icons) need nothing. A
guide may end at a box corner with nothing drawn there (an ellipse's, a
cloud's); the line itself is exact.

## Choices made by following Excalidraw (decision 12), flagged
- **Kept:** no distance labels; the text tool's click snaps its origin;
  snapping is off by default.
- **Two departures, both Excalidraw quirks:** a dragged frame's contents and
  the arrows attached to a moving shape are not snap targets. Excalidraw
  snaps to them at their old positions, which draws guides to places nothing
  is.
- **Not copied:** Excalidraw's grid (Bava has none), and "a press with ⌘ never
  drags" (Bava's press with ⌘ keeps what it does today).

## Tasks

### Task 1: The exit tests
**Files:** test `frontend/src/canvas/commands.test.ts`.
**Behavior:** deleting a shape with `commands.deleteSelection()` keeps an
arrow attached to it, frozen where it was and marked detached; one undo brings
the shape back and the arrow attached to it again.
- [x] Tests: "deleting a shape detaches its arrows rather than deleting them";
  "undo restores the attachment". These pin existing behaviour, so they may
  pass at once; each is checked by breaking the code it guards (skipping the
  freeze in `binding.ts`) and seeing it fail, then restoring.
- [x] Green: `(cd frontend && npx vitest run src/canvas/commands.test.ts)`

### Task 2: The setting
**Files:** `internal/config/config.go`, `config_test.go`,
`frontend/src/settings/settings.svelte.ts`, `settings.test.ts`,
`CanvasSection.svelte`, the translation file, `App.svelte`, the generated
bindings.
**Behavior:** `objectSnap`, off by default; an older settings file without it
reads as off; Settings ▸ Canvas shows "Snap to objects" with the hint "Hold ⌘
or Ctrl while dragging to do the opposite" (Ctrl alone off macOS).
- [x] Failing tests: the default, a round trip, an older file; Go and TS
  defaults agree. Implement. Green: `go test ./internal/config` and
  `(cd frontend && npx vitest run src/settings)`

### Task 3: Tokens
**Files:** `frontend/src/styles/tokens/_space.scss`, `_swatches.scss`.
- [x] Add the six tokens above, the colour in both themes. Green: `npm run check`.

### Task 4: The snapping rules
**Files:** create `frontend/src/canvas/snapping.ts`, `snapping.test.ts`.
**Behavior:** pure functions on scene data, as the spec's section 7:
`snapReferences(scene, moving, visible)`, `snapMove`, `snapCorners`,
`snapPointer`, and a `Guide` type (points, gap, pointer), in scene units.
- [x] Failing tests (spec tests 1 to 10, plus): a box within 8 of an edge at
  zoom 1 snaps flush, at 9 it does not, at zoom 2 the reach is 4; axes snap
  separately and the nearer wins; centres align; a rectangle, an ellipse and
  a cloud each offer the same nine box points; side middles align to side
  middles; a turned element offers its turned box points; a group is one box; the
  moving set, a dragged frame's contents and arrows attached to the moving
  shapes are never targets; off-screen elements are not targets; equal
  spacing matches a gap on either side and centres in a wider gap; guides
  list every exact alignment and nothing merely near; an east-handle resize
  snaps X only from the two east corners. Implement. Green:
  `(cd frontend && npx vitest run src/canvas/snapping.test.ts)`

### Task 5: Snapping while dragging, resizing and drawing
**Files:** `frontend/src/canvas/pointer.ts`, `pointer.test.ts`.
**Behavior:** new options `objectSnap`, `snapDistance`, `visibleBox`; a
`snapping()` helper (`objectSnap() !== mod`); targets gathered at the first
move past the drag threshold and dropped on release. A drag adds the snap
after the Shift lock; an Alt-copy snaps against targets that include the
originals; a resize snaps its moving corners when the element is upright; a
box tool snaps its origin on hover and press and its dragged corner while
drawing. A `snapGuides` getter.
- [x] Failing tests (spec 11 to 16): with the setting on a drag's preview
  lands flush and with ⌘ held it does not; with it off and ⌘ held it snaps; a
  Shift-locked drag still snaps; a single turned element's resize never snaps;
  drawing a rectangle snaps its origin and corner; the text tool's click
  snaps; lines, arrows, points, rotation and nudges never snap; the preview
  equals the release; `snapGuides` is empty after release. Implement. Green:
  `(cd frontend && npx vitest run src/canvas/pointer.test.ts)`

### Task 6: Drawing the guides
**Files:** `frontend/src/canvas/stage.ts`, `stage.test.ts`, `App.svelte`.
**Behavior:** `CanvasStage.setSnapGuides(guides)` draws them on the overlay,
lengths over the zoom, in `--color-snap-guide`, re-read on a theme change;
App passes `pointer.snapGuides` on drag and hover and clears them on release,
press and tool change.
- [x] Failing tests (spec 17): lines, crosses and gap marks at their token
  sizes over the zoom, in the guide colour; nothing after `setSnapGuides([])`.
  Implement. Green: `(cd frontend && npx vitest run src/canvas/stage.test.ts)`

### Task 7: Alt+S and the menu
**Files:** `internal/app/menu/spec.json`, `internal/app/menu/*` (state),
`frontend/src/shell/commands.ts`, the menu-state reporter, their tests,
`docs/shortcuts.md`, `docs/ipc.md`.
**Behavior:** Canvas ▸ "Snap to Objects", a checkbox with the page-matched
shortcut Alt+S scoped to the canvas (so Alt+S still types in text fields;
the key is matched by position, so macOS's ß does not matter). `SetState`
gains `objectSnap` and the checkbox follows the setting.
- [x] Failing tests: the spec has a handler for the id; Alt+S matches it on
  each platform; the checkbox reflects the state; the command flips the
  setting. Implement. Green: `go test ./internal/app/...` and
  `(cd frontend && npx vitest run src/shell)`

### Task 8: A spatial index, only if measured
**Files:** create `frontend/src/canvas/scale.bench.test.ts` (a timing test,
skipped by default, run by hand).
**Behavior:** time one drag move with snapping, one `targetAt` and one hover
on a 2,000-element scene. If any takes more than 4 ms (a quarter of a
frame), stop and raise adding an index with the numbers; otherwise record
"not needed" with the numbers in `docs/decisions.md`.
- [x] Measure, record.

### Task 9: Gates
- [x] `npm run check`, `npm run lint`, `npm test` (exit code); `go vet
  ./internal/... .`, `go test ./internal/... .`
- [x] `spec-reviewer` on the working-tree diff.

## Artifacts
- `docs/decisions.md`: snapping off by default, Alt+S, the box rule, the
  two departures, the index measurement.
- `docs/shortcuts.md`: Alt+S, ⌘/Ctrl while dragging.
- `docs/ipc.md`: `Settings()` gains `objectSnap`; `SetState` gains `objectSnap`.
- `.ai/rules/design-system.md`: the `CanvasSection` row.
- `.ai/rules/canvas.md`: "Snapping is pure in `snapping.ts`; the pointer
  gathers targets once per drag."
- Translation file: the setting, its hint, the menu item.
- Repo-state section of `build-step/SKILL.md`: a Milestone 7 line.
- `.claude/plan/roadmap.md`: Milestone 7's scope notes object snapping.

## Out of scope
A grid; distance labels on guides; snapping lines, arrows, points or
rotation; snapping to D2 diagram nodes inside a diagram element; guides in
exports.

## Verification at the window (owed by a human)
With snapping off, drag with ⌘ held: shapes snap, guides show. Turn it on
with Alt+S (the menu tick follows): drag, resize and draw rectangles against
others, see edge, centre and equal-spacing guides; hold ⌘ to move freely.
Zoom in and out: the reach feels the same on screen. Delete a shape with an
arrow on it: the arrow stays; undo: it is attached again. Both themes.

## As built (2026-09-27)

Every task was tested first. Task 1's two tests pin behaviour that already
worked, so each was checked by breaking `deleteSelection` (deleting the
arrows; detaching in a second history step) and seeing it fail. Several tests
passed at once and were checked the same way; two could not fail and were
rewritten until they could: the turned resize (a half turn, not a quarter)
and the loop arrow (a target only its own centre lines up with).

**Deviations:**
- **Equal spacing counts neighbours only** (the user's choice, raised by
  Task 8): Excalidraw's every-pair scan cost 152 ms to start and 8.3 ms a
  move on 2,000 shapes seen at once.
- **No spatial index.** The cost was the number of pairs and of point
  comparisons, not finding shapes. Snapping keeps its targets' x and y sorted
  (`References.lines`) and gathers gaps with a merged cover
  (`createCover`). Final numbers in `docs/decisions.md`.
- Hovering and resizing gather no gaps (`snapReferences(…, false)`).
- The moving selection's points leave out arrows carried because they are
  attached to what moves (a self-loop), as the targets do.
- The timing test (`canvas/scale.bench.test.ts`) writes its numbers to the
  file `BAVA_BENCH` names, since the test runner hides console output.

**Spec review:** FAIL with one blocker, fixed with a test. A click with a box
tool near an element snapped its start, then measured the click from there,
and wrote an invisible 0-by-0 shape; the click is now measured from where
the press landed, and a box snapped flat is not drawn. Warnings fixed, each
with a test seen failing: gaps inside a frame or on a larger shape behind a
row were all blocked by it; gathering was slow with a shape along a whole
side (239 ms), now a merged cover and plain number arrays (15 ms); a
self-loop arrow changed a shape's snap points; the release left guides set
while the tool stayed on; guides kept their old size after a zoom; two
shapes starting at one place lost one as a neighbour; the Shift test now
shows the snap off its axis. Also: the box tools are an allow-list; the
shortcuts row says a selected line or arrow snaps when dragged by its body.
Declined: considering every fit of a gap rather than the first that matches,
which is Excalidraw's rule as the research spec records it (`SN:480-542`).
