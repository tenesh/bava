# IPC

The frontend reaches Go through exactly one bound method. Every method here is
API that must survive a Wails beta upgrade, so the surface stays small on
purpose.

**Scope:** this surface renders `diagram` elements — the blocks that hold D2
source — and nothing else. The canvas scene is drawn in the frontend and never
round-trips through Go.

## Render

```go
func (s *RenderService) Render(source string, opts render.Options) (render.Result, error)
```

Registered as `RenderService` in `main.go`; generated bindings land in
`frontend/bindings/github.com/tenesh/bava/internal/app/`.

### Request

| Field | Type | Meaning |
|---|---|---|
| `source` | string | D2 source text |
| `opts.engine` | string | `tala` (default when empty), `dagre`, or `elk` |

An unrecognised engine is a **returned error**, not a diagnostic: it is a bug
in the caller, not a problem with the diagram. `direction` is deliberately not
exposed while TALA is active, because TALA ignores it.

### Response

```ts
type Result = {
  svg: string;                      // no XML declaration; empty on failure
  errors: Diagnostic[] | null;      // compile diagnostics
  nodeMap: Record<string, Span> | null;
};

type Diagnostic = { message: string; from: number; to: number; line: number };

type Span = {
  from: number; to: number; line: number;   // where in the source
  x: number; y: number; w: number; h: number; // where in the rendered diagram
};
```

The geometry half of `Span` is added in Milestone 6 and is not yet implemented;
this document describes the contract the canvas is built against.

**Errors are data, not exceptions.** Source that does not compile returns a
successful call with `errors` populated and `svg` empty. The frontend keeps the
last good diagram on screen — users type through invalid states constantly, and
blanking the canvas on every half-finished line would be unusable. A returned
`error` means the request itself was malformed.

**Positions.** `from` and `to` are offsets in **UTF-16 code units** — the
units JavaScript and CodeMirror index by — because the pipeline compiles with
`UTF16Pos` set. They are *not* byte offsets: D2 reports UTF-8 bytes by default,
and a single non-ASCII label then shifts every marker by the extra bytes ahead
of it. `line` is **1-indexed**; D2 reports 0-indexed lines and the conversion
happens once, in Go. A position reaching the frontend 0-indexed, or measured in
bytes, is a bug.

**`nodeMap`** maps an SVG element id to both where the node was declared in the
source and where it sits in the rendered diagram.

Keyed by SVG id so click-on-node is a direct lookup; a diagnostic highlighting
its shape is a reverse scan, which is cheap at the diagram sizes this canvas
supports. Where an object is referenced several times, the span points at the
**earliest** reference, which is the declaration.

`x, y, w, h` are in **diagram-local** coordinates. A canvas arrow bound to a
node resolves its endpoint by transforming that rect by the diagram element's
own position and scale. The id is the anchor, never the coordinates: ids come
from source text and survive re-layout, coordinates do not.

### Debounce and staleness

Owned by the frontend client in `frontend/src/ipc/render.svelte.ts`:

- 250ms of quiet before a request is issued.
- Every request carries an incrementing id; responses whose id is not the
  latest are discarded. Without this a slow TALA render can land after a faster
  later one and the diagram flickers between states — a symptom that looks like
  a layout bug and is not.

### Rendering details fixed at the boundary

- `NoXMLTag` is set: the canvas injects the string into a div it owns, where an
  XML declaration is invalid.
- `OmitVersion` is set: D2 stamps a build-time version that does not track the
  module version (it reports `v0.8.1-HEAD` while running v0.9.0), so recording
  it in a golden file would commit a false fact.
- `Salt` is unset. It changes generated ids deterministically and is reserved
  for giving each embedded diagram its own id namespace in Milestone 5.

## FileService

Added in Milestone 5. Reads and writes files; knows nothing about what is in
them beyond handing the parse to `internal/format`.

| Method | Returns |
|---|---|
| `Open(path)` | `OpenResult` — prose, diagram blocks by id, scene, stamp, error |
| `Save(path, source, scene)` | `SaveResult` — path, new stamp, error |
| `ChangedOnDisk(path, stamp)` | bool |
| `ChooseFileToOpen()` | `DialogResult` — a path, or empty when cancelled |
| `ChooseFileToSave(suggestedName)` | `DialogResult` — a path, or empty when cancelled |
| `ListWorkspace(dir)` | `ListResult` — folders then `.md`/`.d2` files, hidden entries skipped |
| `Settings()` | the user's preferences, defaults when unreadable |
| `SaveSettings(settings)` | an error string, empty on success |

**Errors are data here too.** A missing file, a permission denial, a malformed
canvas block — all things the user can act on — come back in `error` rather
than as a failed call. A returned error means the request itself was malformed.

**A malformed canvas block still returns the prose.** Losing a whole document
to one bad trailing block is the worst outcome available.

**`stamp` is size and modification time**, taken when a file is read and passed
back to `ChangedOnDisk`. Enough to notice another program writing the file, and
cheap enough to check whenever the window regains focus. A content hash would
be exact and would mean re-reading every open file on every focus change.

**Cancelling a dialog is not an error.** An empty path means the user changed
their mind, which is a normal outcome and is not reported as a failure.

**A workspace lists only what Bava edits.** A project folder is usually full of
things Bava has no business showing, so `.md` and `.d2` only, folders first,
and nothing beginning with a dot — that is Bava's own state or the user's
tooling, not their documents.

