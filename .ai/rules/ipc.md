# IPC

## One render surface
`Render(source, opts) → {svg, errors, nodeMap, layout}` serves Diagram from
Code: the SVG is the dialog's preview, and `layout` is what the frontend
converts into canvas shapes and arrows. Both come from one compile, so they
never disagree. Resist growing a second D2 render path.

Note the scope: this surface does not draw the canvas, and exports do not go
through it. The scene and its exports are drawn in the frontend
(`canvas/export/`); the scene never round-trips through Go, and
`ExportService` only writes an export's finished bytes.

## Source spans and geometry are separate
`nodeMap` is keyed by SVG element id and carries where the node came from in
the source (`from`, `to` as UTF-16 offsets, plus a 1-indexed `line`), nothing
more. Geometry is in `layout`: each shape's id, parent, position, size and
label, and each connection's ends and route. See `docs/ipc.md`.

## Debounce and staleness
250ms after typing stops, incrementing request ID, drop responses that are not
the latest. See `canvas.md` for why.

## Errors are data, not exceptions
D2 compile failures are an expected state, not a failure of the call. They
come back in `errors` with positions, and the previous good preview stays on
screen. Never blank it on a compile error; users type through transient
invalid states constantly.

## Keep the surface small
Every bound method is API you maintain across a Wails beta upgrade. Prefer one
method with an options struct over five narrow methods.

## The menu names commands; the frontend performs them
Go emits `menu:command` with an id and never decides what it does. The id list
lives in `spec.json`, and `shell/commands.ts` must match it exactly; a test
enforces both directions. Adding behaviour to a menu click in Go is how the
native layer stops being thin.

## The one web fetch is the user's, and bounded
`internal/web` (`SpaceService.FetchCard`) is the only place Go reaches the
web: a card's details, on the user's paste of its link or Refresh details,
never on drawing a card. It is bounded (8 s, 5 redirects, 1 MB of the page,
2 MB a picture), keeps no cookies, and sends `User-Agent: Bava` with no
version. Anything that would reach the network on its own breaks the first
non-negotiable; another fetch goes through here or is raised first.
