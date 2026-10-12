# Canvas

Traps in the Konva scene. The class-not-component rule, bindings by id, stored
text sizes and the single history are in CLAUDE.md.

## Scene and history
- **No reactive state holds geometry.** Elements carry `x, y, w, h, z`; once
  Diagram from Code converts a layout, nothing moves them.
- **Every change goes through `history.mutate`.** A no-op records no step.
  `reroute` runs in the same recipe, so attached arrows follow every edit.
- **A drag previews without touching history**: `pointer.preview(point)` uses
  the commit's function; release commits one step; the new element keeps one id.
- **Modifiers are read on every move and release**, never captured in `down()`.
- **A click on a selected element is decided on release**, within the drag
  threshold, so a drag from inside a selection keeps it.
- **`Omit` does not distribute over `SceneElement`**: use the helper in `scene.ts`.

## Drawing
- **Each element is a Konva group** at `x, y`, its body in local `0..w, 0..h`
  (an ellipse centred at `w/2, h/2`). `points` are element-relative.
- **Colours come through an injected token reader**; `restyle()` re-reads on a
  theme change. Swatch names resolve in `palette.ts`. Tests inject a reader.
- **Sizes are tokens; curve ratios are constants** (`ROUND_SHARE`,
  `LINE_TENSION`, `SEGMENT_SAMPLES`, `CORNER_STEPS`).
- **Absent keys mean `PROPERTY_DEFAULTS`** (`style.ts`), never a token.
- **Export draws through the same code**: `paint.ts`, `shapes.ts`, `arrows.ts`
  through sinks; the PNG is an offscreen `CanvasStage`. Never a second set.
- **Lines are broken once**: text by `text-layout.ts` (Konva gets
  `wrap: 'none'`), code by `code/wrap.ts`, curves by `curves.ts` (Konva
  `tension` stays 0).
- **A shape's label is placed by `placeLabel`** (`label-box.ts`) in the stage,
  the SVG export and the label editor's box; any change that can leave a
  label without room runs `growToLabel` in the same `history.mutate`.
- **Render skips unchanged elements, except arrows** (detachment depends on
  others). Outside state gets its own setter (`setCodeRuns`, `setEditing`).
- **Drawing is once per frame (`frameThrottle`); input is not.**
- **Test what Konva draws** (stroke, fill, points, text), not only scene data.
- **The dot grid** (`grid.ts`, its own layer) never listens, is never saved,
  never exported.
- **jsdom needs `vitest-canvas-mock`**; without it Konva throws `Cannot read
  properties of null (reading 'scale')`.

## Pointer and selection
- **One pointer path**: DOM events in scene coordinates. No Konva Transformer;
  the overlay layer does not listen.
- **Lines, arrows and strokes are hit by path** (`hit.ts`, `nearElement`).
- **Rotated elements are tested where drawn** (`rotate.ts`: `containsPoint`,
  `rotatedBounds`, `toLocal`), never by the stored box.
- **Resize and rotate work in the selection's frame** (`selectionFrame`,
  `pointInFrame`, `deltaInFrame`, `placeResized`).
- **Selection chrome is decided once** (`selection-chrome.ts`): the stage draws
  and the pointer presses the same handles.
- **Cursors come only from `cursorFor`** (`cursor.ts`).
- **Point editing and click drawing are pointer modes** (`editingPoints`,
  `drawingPoints`), never Svelte state.
- **The eraser marks, then deletes on release** in one step. A group is hit
  only through its children.
- **Locked elements are skipped by everything that selects** (`elementsAt`,
  marquee, Select All, `erasableAlong`); they still draw and export.
- **Canvas shortcuts are `scope: "canvas"`** in the menu spec.
- **Snapping is pure** (`snapping.ts`); targets are gathered once per drag
  (`Drag.snap`) and kept sorted.
- **New elements take the last-used style** (`current-style.ts`), memory only.

## Groups and frames
- **A group is one id for its children**; the wrapper draws nothing.
- **Moving, mirroring, copying and restacking expand through `withContents`**
  (`edit.ts`), never `withDescendants` alone, which leaves frame contents
  behind. A frame resizes alone. Locked members still go with their frame.
- **Containment lives on the child** (`frame`), set only when wholly inside.
  Wrapper and children both record it, so a second expansion doubles a move.

## Arrows and lines
- **Targets are found front to back by outline** (`targetAt`): a shape hides
  what is behind it; frames attach from outside only; the gap is `gapOf(shape)`.
- **Binding, anchor and `mode: "inside"` are written and removed together.**
  An end aims from its anchor at its neighbour. Elbows are never pinned.
- **`routePoints` is the one place a kind becomes a path.**
- **Elbows store their route**, computed in `reroute` (`elbow.ts`).
  `fixedSegments` keep the interior (`elbow-segments.ts`), rewritten from the
  points. Leaving elbow keeps only the ends and drops fixed segments.
- **A turned line is edited unturned** (`unturned`, handles on `drawnPoints`).
- **Closed lines stay closed** via `closed.ts` or `settleLine`; under four
  points one opens, and `fill` draws only while closed.
- **Heads come from `drawHead`** (`arrows.ts`); dashes from `dashFor`, in scene
  units, not tokens. Labels from `labelLayout`, shared with `labelField`.
- **The label editor takes its look from `paintFor`**; no stylesheet font, size
  or colour on `.bava-label-editor`.

## Code blocks and conversion
- **Highlighting comes only from `code/highlight.ts`**, handed to the stage
  async. Absent size means 13 (`CODE_FONT_SIZE`); a size change re-fits.
- **`canvas/import/` is pure** and makes ordinary elements
  (`import/ordinary.test.ts`).
