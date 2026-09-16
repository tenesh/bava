# IPC

## One render surface
`Render(source, opts) → {svg, errors, nodeMap}`. Resist growing a second
render path — a preview renderer, an export renderer, a thumbnail renderer.
Divergent paths drift and produce output that differs from what the user saw.

## The response carries positions
`nodeMap` maps source positions to SVG element IDs. It exists so a click on a
node can jump to its source line and a diagnostic can highlight its shape.
Return it even before anything consumes it — retrofitting means touching the
whole pipeline.

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