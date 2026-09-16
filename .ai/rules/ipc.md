# IPC

## One render surface
`Render(source, opts) → {svg, errors, nodeMap}`. Every `diagram` element on a
canvas renders through it, and so does export. Resist growing a second render
path — a preview renderer, an export renderer, a thumbnail renderer. Divergent
paths drift and produce output that differs from what the user saw.

Note the scope: this surface renders **diagram elements**, not the canvas. The
scene is drawn in the frontend and never round-trips through Go.

## The response carries positions and geometry
`nodeMap` is keyed by SVG element id. Each entry carries **both** where the node
came from in the source (`from`, `to` as UTF-16 offsets, plus a 1-indexed
`line`) and **where it sits in the rendered diagram** (`x`, `y`, `w`, `h` in
diagram-local coordinates).

The source half exists so a click on a node jumps to its line and a diagnostic
highlights its shape. The geometry half exists so a canvas arrow can bind to a
node inside a diagram and re-anchor itself on every render.

Return both even before anything consumes them. This lesson has now arrived
twice: retrofitting `nodeMap` means touching the whole pipeline.

## Debounce and staleness
250ms after typing stops, incrementing request ID, drop responses that are not
the latest. See `canvas.md` for why.

## Errors are data, not exceptions
D2 compile failures are an expected state, not a failure of the call. They
come back in `errors` with positions, and the previous good SVG stays on
screen. Never blank the canvas on a compile error — users type through
transient invalid states constantly.

## Keep the surface small
Every bound method is API you maintain across a Wails beta upgrade. Prefer one
method with an options struct over five narrow methods.