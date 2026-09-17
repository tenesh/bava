# Render IPC contract

> **Scope narrowed 2026-09-16.** Written when this pipeline rendered the whole
> app. After the re-plan it renders `diagram` elements placed on a canvas; see
> `canvas-architecture.md`. Everything below still holds, with one addition
> landing in Milestone 6: `nodeMap` entries gain `x, y, w, h` in diagram-local
> coordinates, so a canvas arrow can bind to a node inside a diagram.

Decisions taken for Milestone 1, grounded in a throwaway D2 spike run on
2026-09-16 against the pinned `github.com/d2lang/d2 v0.9.0`. Where a line says
"measured", it was observed, not reasoned from docs.

## The one surface

```
Render(source string, opts RenderOptions) -> RenderResult
```

Per `.ai/rules/ipc.md`: one render path, options struct rather than a family of
narrow methods, errors are data rather than a failed call.

## RenderResult.nodeMap: decided 2026-09-16

Keyed by SVG element id, valued by source location:

```
nodeMap: {
  "users":   { from: 0,  to: 5,  line: 2 },
  "web":     { from: 18, to: 21, line: 3 },
  "web.api": { from: 40, to: 43, line: 4 }
}
```

One structure, not two. Click-on-node -> jump-to-source is a direct lookup;
diagnostic -> highlight-shape is a reverse scan, which is cheap at the diagram
sizes `.ai/rules/canvas.md` commits us to (1-2k SVG elements before we change
rendering strategy entirely). Two maps would be faster in one direction and a
synchronisation risk in both.

**Why this is buildable, measured:** `diagram.Shapes[].ID` yields SVG element
ids (`users`, `web`, `web.api`) that match `graph.Objects[].AbsID()`, and
`graph.Objects[].References[0].Key.Range` carries the source range for each.

## Positions: D2 is 0-indexed, CodeMirror is not

Measured: D2 ranges serialise as `,1:3:10-3:0:28`, that is
`start line:col:byte - end line:col:byte`, with **lines and columns
0-indexed**. Error messages embed the same 0-indexed pair (`2:4: maps must be
terminated with }` points at input line 3).

`from`/`to` in `nodeMap` and in errors are offsets in **UTF-16 code units**,
set by `CompileOptions.UTF16Pos`. An earlier version of this spec said "byte
offsets, because CodeMirror addresses documents by absolute offset"; the
second half is right and the first half was wrong. JavaScript indexes strings
in UTF-16 code units, D2 reports UTF-8 bytes by default, and the two diverge at
the first non-ASCII character: measured on `café: Café\nweb: Web`, `web` is at
byte 13 and at UTF-16 index 11. `line` is converted to 1-indexed at the Go
boundary, once. A position leaving Go 0-indexed, or measured in bytes, is a
bug.

## RenderResult.errors

Measured shape of a compile failure: `*d2parser.ParseError` carrying
`{errs: [{range, errmsg}]}`. Flattened at the Go boundary to:

```
errors: [ { message: string, from: int, to: int, line: int } ]
```

A compile failure is a normal response, not a transport error: `errors` is
populated, and the caller keeps the previous good SVG on screen.

## OmitVersion is set on every render

Measured: output carries `data-d2-version="v0.8.1-HEAD"` while the module is
v0.9.0: the staleness `.ai/rules/d2.md` warns about, confirmed. `RenderOpts`
has `OmitVersion`, and we set it. A golden file must not record a version
string that is false, and the attribute is worthless as a cache key anyway.

## Goldens need no normalisation

Measured, on the same fixture: SVG output is byte-identical across three calls
in one process and across three separate processes, for tala, dagre and elk,
**with and without** an explicit `Salt`. Element ids derive from content, not
from per-process randomness, and TALA's `Options.Seeds` defaults to `{1,2,3}`
rather than anything time- or entropy-seeded.

So golden files can be compared byte-for-byte with no scrubbing step, which is
what `.ai/rules/testing.md` assumes. Re-verify after any D2 bump.

## Salt is reserved for Milestone 5

Measured: changing `Salt` changes output deterministically, and the same salt
reproduces identical bytes. That is the mechanism for giving each embedded
diagram in a ProseMirror document its own id namespace without losing
determinism. Milestone 1 leaves it unset.

## Engine selection

TALA is the default and the only engine Milestone 1 exercises. `opts` carries
the engine so the contract does not change when `CanvasControls` exposes the
picker in Milestone 3. `direction` is not exposed while TALA is active; it is
ignored. dagre and elk are reachable through the same resolver; measured
working at v0.9.0.

TALA is **in-library** at v0.9.0 (`d2layouts/d2talalayout`), not the external
binary plugin it used to be. No tension with "library, never the CLI".

## Theme

Not in Milestone 1. The design tokens that would feed `opts` do not exist
until Milestone 2, and inventing colours before the token layer defines them
means defining them twice. Added to `opts` in Milestone 2, alongside the
Go-side theme mapping `.ai/rules/design-system.md` requires.
