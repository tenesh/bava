# IPC

The frontend reaches Go through exactly one bound method. Every method here is
API that must survive a Wails beta upgrade, so the surface stays small on
purpose.

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
type Span = { from: number; to: number; line: number };
```

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

**`nodeMap`** maps an SVG element id to where that node was declared in the
source. Keyed by SVG id so click-on-node is a direct lookup; a diagnostic
highlighting its shape is a reverse scan, which is cheap at the diagram sizes
this canvas supports. Where an object is referenced several times, the span
points at the **earliest** reference, which is the declaration.

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
