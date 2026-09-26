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

## Conversion is pure, and what it makes is ordinary
`canvas/import/` turns a D2 layout into elements: geometry in, elements out,
with no IPC, no Konva and no history, so it is tested against a fixture taken
from the real pipeline. What it produces carries no mark of being generated,
because from the moment it lands it is not: the same move, resize, bind and
delete paths own it. `import/ordinary.test.ts` is the test that says so, and
a failure there means the conversion made something the rest of the canvas
does not understand.

## A code block's colours come from CodeMirror, once
`canvas/code/highlight.ts` walks the language's own Lezer parse and folds the
tags into the nine kinds the theme colours. The stage and the exporter both
draw those runs; nothing else parses code. Highlighting is asynchronous
because a language loads on first use, so the runs are handed to the stage
rather than computed in it, and a block draws its panel until they arrive.

## A default the file relies on comes from `PROPERTY_DEFAULTS`, never a token
`docs/file-format.md` says what an absent `strokeWidth` or `fontSize` means,
and `canvas/style.ts` holds that as `PROPERTY_DEFAULTS`. Drawing reads it.
Picking the default clears the key, so a theme token behind the fallback drew
Medium at 1.5 and 20 at 13, whatever the user chose, until 06.8.

## The text editor takes its style from paint
The label editor's textarea is where the text is typed, so it must look like
the drawn text: `paintFor(element).font` and `.opacity`, scaled by the zoom,
over the box `labelBox` gives, with no chrome of its own. The stage hides the
drawn text meanwhile (`setEditing`). A stylesheet font, size or colour on
`.bava-label-editor` brings back "text loses its styles in edit mode".

## Render skips what did not change, except arrows
The scene is immutable, so `render` re-applies an element only when its
object differs from the one last drawn, and restacks only when the paint order
changed or a node was created. An arrow is always re-applied: whether its end
is detached depends on other elements. Anything else drawn from state outside
the element must be re-applied by its own method, as `setCodeRuns` and
`setEditing` are, or a render will not show it.

## Drawing during a drag is once per frame; input is not
`frameThrottle` limits the preview and the pan to one per animation frame.
The pointer handler still sees every move, because a pen stroke and an eraser
trail are built from them. A release cancels the pending frame and redraws
the committed scene, since a drag that commits nothing republishes nothing.

## A click on a selected element is decided on release
A press on an element already selected, or on empty space inside a selection
of several, may be the start of a drag of the whole selection. So the press
changes nothing; the release does, and only if the pointer did not travel the
drag threshold: Shift-click removes, a plain click narrows to the element, a
click in the empty space clears. Deciding at the press made Shift-click unable
to remove and made a drag from inside a selection drop it.

## Frames and groups go wherever their owner goes, through one walk
`withContents` in `edit.ts` (and `carriedWith`, its form over scene data)
expands groups to their children and frames to their contents, all the way
down. Every command that moves, mirrors, copies or restacks uses it; a command
using `withDescendants` alone leaves a frame's contents behind, which is how
align, flip, duplicate and Bring to Front each shipped broken. The one
exception is a resize: a frame is resized alone, since its contents keep their
own size and place, and `reconsidered` then lets go of what it no longer
surrounds. A locked member goes with its frame too: locking stops the element
being selected or edited on its own, not its frame being moved, as dragging a
frame has always done.

## An attached end aims through its anchor at its neighbour
`startAnchor`/`endAnchor` are fractions of the target's upright box, turned
with it; absent is the centre, which is exactly the old rule for a two-point
arrow. An end sits where the ray from its anchor towards its neighbour (the
nearest bend, else the other end's anchor; an elbow ignores its kept bends)
leaves the outline, a gap clear. A bent attached arrow, every D2-inserted one
among them, therefore re-aims differently from before 06.10: aiming its ends
across the arrow sent the end legs diagonal and through their own shapes. A
dropped anchor off the drawn outline is taken onto it, and a ray that misses
falls back to the centre, so an attached end always follows its shape. A
binding and its anchor are written and removed together.

## Bends are points; the kind decides how they are drawn
A line or arrow with more than two points is bent. `routePoints` is the one
place a kind turns points into a path: straight keeps corners, an arc curves
through the bends, an elbow routes end to end and ignores them but keeps them
in the file. Stage, hit testing and export all go through it, so a kind added
there is drawn the same everywhere.

## A target is found by its outline, not its box
`targetAt` takes the smallest element that contains the point or whose outline
is within `bindingReach(zoom)`, so a small shape inside a big one wins from
just outside it too, after a cheap cull by the grown box. Strict box
containment attached an end to an ellipse's empty corner and let go of one
dropped a pixel outside an edge.

## A turned line is edited with its turn written into its points
`unturned` gives a line or free arrow the same drawing with no angle; every
bend, end or label edit starts from it, and every handle sits on
`drawnPoints`. Editing stored points under an angle moves the pivot, so the
whole line jumps.

## An elbow's route is stored, and computed in reroute
An elbow's `points` are its route (`elbow.ts`), recomputed by `reroute` inside
`history.mutate`, where the scene is known: routing around shapes needs them,
and the drawing path (`routePoints`, stage, hit test, export) has only the
element. `routePoints` draws an elbow's stored points as they are. An attached
elbow end stays on its anchor's side; straight and curved arrows keep the
facing-side rule. Switching away from elbow keeps only the ends
(`style.ts`, `applyProperty`).

## Code wraps through one function
A code block's width is the user's; `code/wrap.ts` breaks its lines, and the
measurement, the stage and the exporter all use it, so a block is as tall as
the lines each draws. `columnsFor` allows a hundredth of a column of slack: a
stored width is tidied to three decimals.

## What a selection shows is decided once
`selection-chrome.ts` says which outline, handles and rotate handle a
selection has; the stage draws exactly those and the pointer presses exactly
those. A straight line or arrow, or an elbow, has no box (Excalidraw's rule).
