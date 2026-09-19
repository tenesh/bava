# Canvas

## The canvas is not a Svelte component
It is a plain TypeScript class owning a Konva stage, mounted once into a
`<div ref>`. Svelte never renders scene elements.

This is a performance constraint, not a style preference. A scene rendered as
per-element Svelte components means every pan, zoom, drag or keystroke
reconciles the whole tree, and the app stutters at a few hundred elements. When
that happens the instinct is to blame the webview; it is this.

Data flows in, events flow out. **No reactive state holds geometry.**

## The scene is the source of truth for position
Every element carries its own `x, y, w, h, z`. Nothing computes them. The one
exception is the interior of a `diagram` element, where the D2 layout engine
decides where nodes sit, and that interior is opaque to the scene except
through the bounds the render response returns.

## Bindings resolve through node ids, never coordinates
An arrow bound into a diagram stores `{element, node, side}`. `node` is a D2
absolute id from `nodeMap`, derived from source text and stable across
re-layout. Storing a coordinate instead would break on the next render.

Endpoints are recomputed on every render: node rect in diagram-local space,
transformed by the diagram element's position and scale.

**A broken binding is never silently dropped.** If the node disappears from the
source, the arrow stays, freezes at its last position, and is marked detached.
The user drew it; it is not ours to delete.

## Diagram elements are rasterised into the stage
Not kept as live SVG DOM. A DOM layer inside a canvas stage fights z-order and
transforms, and the node bounds from the render response give hit-testing
everything it needs. A click inside a diagram resolves against the bounds index
to a node id, the same key used for bindings and jump-to-source.

## Canvas text is measured in the frontend, and the measurement is stored
Text inside a D2 diagram is measured in Go, as before. Canvas text cannot be:
the frontend owns that layout.

The old hazard has not gone away: WebKitGTK and WebView2 disagree on glyph
advances, so the same label measured on two platforms yields two sizes. The
mitigation is twofold, and both halves are required: **fonts are bundled** and
referenced via `@font-face`, never relied on from the system; and **measured
dimensions are written into the file**, so reopening a scene restores the
layout instead of re-deriving it.

## Stale responses must be dropped
Render requests for diagram elements are debounced 250ms and tagged with an
incrementing id. Responses whose id is not the latest are discarded. Without
this, a slow render can land after a faster later one and the diagram flickers
between states, a symptom that looks like a layout bug and is not.

## Undo is one history
Scene mutations, diagram source edits and AI edits all enter through the same
transaction path. Two histories make Ctrl+Z unpredictable, and the first thing
a user does after a change they dislike is press Ctrl+Z.

## Konva needs a 2D context, which jsdom does not have
Canvas tests run under jsdom with `vitest-canvas-mock` (pure JS), wired in
`vitest.config.ts`. The native `canvas` package would be more faithful, but it
has to build on three CI platforms and these tests assert scene patching rather
than pixels; that is a maintenance bill for nothing.

Without the mock, Konva fails with `Cannot read properties of null (reading
'scale')`, which reads like a Konva bug and is not.

## Omit does not distribute over the element union
`Omit<SceneElement, 'id' | 'z'>` collapses to the keys every element shares, so
it silently rejects `text`, `line`, `group` and anything else with fields of
its own. `scene.ts` defines a distributive version. The failure appears as a
type error at the call site and looks like the element is wrong; the helper is.

## Scene mutations go through history, never around it
Every change (a drag, a tool, an AI edit later) is applied with
`history.mutate`. A mutation that changes nothing records no step, so undo
never appears to do nothing, which reads as a broken undo.

## Each element is a group: a body and an optional label
`CanvasStage` gives every element a Konva group at its `x, y`, holding its body
drawn in local coordinates (`0..w`, `0..h`) and, for a shape, its label. An
ellipse's body is centred at `w/2, h/2`; positioning it at the group's origin
draws it a quarter off. `points` on lines, arrows and strokes are relative to
the element, as the file format says.

## Colours come from CSS variables, and a theme change restyles
Konva cannot see CSS, so the stage reads tokens through an injected reader and
`restyle()` re-reads them on a theme change without recreating nodes. A shape
names swatches (`fill: "blue"`); `palette.ts` resolves them. A test that sets no
reader gets jsdom's empty values: always inject one.

## Test what Konva draws, not only the scene
Milestones 4 to 5.5 shipped every shape with no stroke and no fill, and every
test passed, because the tests checked scene data. Stage tests inspect the
Konva nodes: stroke, fill, points, label text.

## All pointer input has one path
Pressing a selection handle, dragging, marquee and drawing all go through the
pointer handler as DOM events in scene coordinates. The stage only draws the
selection outline and handles, on a non-listening overlay layer. Konva's
Transformer is not used: its anchors take Konva events, and a press would also
reach the pointer handler and start a move.

## A drag previews its result without touching history
While the pointer moves, the canvas draws `pointer.preview(point)`: the scene
the drag would commit if released there, computed by the same function the
release commits. History changes only on release, one step. The element being
drawn keeps one id for the whole drag, so the stage patches one node.

## Modifiers are read during a drag, never at the press
Shift (constrain) and Alt (the eraser's restore) are passed on every move and
release, so pressing or releasing a key mid-drag changes the preview at once.
A modifier captured in `down()` cannot do that, which is how Shift silently
did nothing for new shapes.

## A linear element is hit by its path, not its box
A line, arrow or stroke is tested against what it draws, with a tolerance, by
`hit.ts`: its box is mostly empty space, and an axis-aligned one has no height
at all. Selection, the eraser and the label editor all go through
`nearElement`. An arrow's stored box is settled around its drawn path, so an
elbow's corners and an arc's bow are inside it.

## The eraser marks, then deletes on release
The trail marks elements it crosses (drawn at `--opacity-erasing`); release
deletes them and their outermost groups in one step. A group is hit only
through its children, never its own box.

## Canvas shortcuts are scoped to the canvas
Arrange, align, distribute, flip, duplicate and copy/paste styles are
`scope: "canvas"` in the menu spec: page shortcuts that act only when the
canvas is the edit target. ⌘] indents in the source editor, ⇧H types a capital.


## A locked element is skipped by everything that selects
`locked: true` removes an element from `elementsAt`, the marquee, Select All
and `erasableAlong`, so no edit can reach it: commands act on the selection,
and it can never be in one. It still draws and still exports. The only way
back is Unlock All (`⌥⇧⌘L`, or right-click on empty canvas), which clears the
flag on every locked element in one step.

## Sizes are tokens; shapes of curves are constants
A length that appears on screen is a `--size-*` or `--radius-*` token, read
through `number(read, …)`. A dimensionless ratio that describes a curve's shape
(`ROUND_SHARE`, `LINE_TENSION`, `ARC_BOW`, `ARC_STEPS`) stays a named constant
beside the drawing code: it does not scale with the theme and nothing outside
that file can use it.


## A rotated element is tested where it is drawn
`angle` turns an element about its own centre; `x`, `y`, `w` and `h` stay the
upright box. Anything that asks where the element actually is goes through
`rotate.ts`: `containsPoint` for a click, `rotatedBounds` for the marquee,
`toLocal` for the eraser's trail and for a resize. Testing the stored box
directly is the bug this module exists to prevent.

## Resizing and rotating work on the selection's frame
`selectionFrame` gives one element its own box and angle, and several the
upright box around them all. Handle presses are read in that frame
(`pointInFrame`), a resize drag is turned into it (`deltaInFrame`) and the
result put back with `placeResized`, which moves the centre so the untouched
edge stays where it is drawn.

## A group is one id standing for its children
Selecting a group puts only the wrapper's id in the selection, and the wrapper
draws nothing. Every geometric edit expands it through `withDescendants`:
`dragTargets` in `pointer.ts` for drags, `moveUnits` and `flip` in the
commands. An edit that skips this appears to do nothing at all.

## The export draws through the same code as the canvas
`paint.ts` decides how an element looks and `shapes.ts` and `arrows.ts` decide
its geometry, both through sinks. The stage turns that into Konva nodes; the
exporter turns it into SVG, and its PNG is drawn by an offscreen `CanvasStage`.
A second set of drawing or paint rules anywhere is the bug this arrangement
exists to prevent: it would drift from the canvas the first time a shape
changed, and the user would find out in a file they had already sent someone.

## Text is broken into lines once, not by each renderer
Konva wraps text itself and the exporter cannot see inside it, so a label
wrapped on the canvas and overflowed in an exported SVG. `text-layout.ts`
breaks lines; the stage hands Konva text already broken with `wrap: 'none'`,
and the exporter breaks the same way. The same holds for smoothing: `curves.ts`
returns the samples, and Konva's own `tension` stays at zero.

## Attached arrows re-aim inside the change that moved them
A binding is an element id. `history.mutate` runs `reroute` inside the same
immer recipe, so every edit path (a drag, a resize, a rotation, an align, a
nudge, an undo) re-aims attached arrows without remembering to ask, and one
undo puts a shape and its arrows back together. The preview does the same, so
what is drawn mid-drag is what the release commits.

## Containment lives on the child
An element records the `frame` that owns it. Dropping it wholly inside sets
the key, dragging it out clears it, and a frame drag expands to what records
it, the way a group drag expands to its children. Half inside is not inside: a
frame would otherwise carry off whatever overlapped its edge, and a frame
dragged across the canvas would adopt what it passed over.

## Membership is recorded at every level, including a group wrapper
`frame` lives on each element. A group inside a frame therefore records it
twice over: the wrapper carries `frame`, and so does each child. That is
consistent rather than redundant, because a move is computed from each
element's position at the press, so every one of them shifts by the delta
exactly once however the selection was expanded.

The trap it leaves: any future edit that walks members and *then* expands
groups would apply a delta twice. `carriedWith` is the one expansion, and it
de-duplicates by id; add a second one and this is what breaks.
