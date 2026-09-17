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

