# IPC

The bound surface between Go and the frontend. Shapes are in `docs/ipc.md`.

## One render surface
`Render(source, opts) → {svg, errors, nodeMap, layout}` serves only Diagram
from Code, both from one compile. No second D2 render path. The canvas and its
exports are drawn in the frontend; `ExportService` only writes finished bytes.

## Source spans and geometry are separate
`nodeMap` is keyed by SVG element id and holds only source position (`from`,
`to` as UTF-16 offsets, 1-indexed `line`). Geometry is in `layout`.

## Debounce and drop stale responses
Preview renders wait 250ms after typing and carry an incrementing id; a
response that is not the latest is dropped. Otherwise a slow render lands late
and the preview flickers, which looks like a layout bug.

## Errors are data
D2 compile failures come back in `errors` with positions; the previous good
preview stays on screen. Never blank it on a compile error.

## The menu names commands; the frontend performs them
Go emits `menu:command` with an id and never decides what it does. The ids in
`spec.json` and `shell/commands.ts` must match; a test checks both ways.

## The one web fetch is the user's, and bounded
`internal/web` (`SpaceService.FetchCard`) is the only place Go reaches the web:
a card's details on paste or Refresh, never on draw. 8 s, 5 redirects, 1 MB
page, 2 MB picture, no cookies, `User-Agent: Bava`. Any other fetch goes here or
is raised first.

## Every path the user picks or drops is kept
A store's sandbox lets Bava reach only what the user chose. Every dialog
result and drop goes through `allow` (`internal/app/access.go`), so a later
launch can reach it again; ask `Reachable` before assuming a path opens.
