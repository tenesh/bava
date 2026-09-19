# IPC

The frontend reaches Go through exactly one bound method. Every method here is
API that must survive a Wails beta upgrade, so the surface stays small on
purpose.

**Scope:** this surface renders `diagram` elements (the blocks that hold D2
source) and nothing else. The canvas scene is drawn in the frontend and never
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
last good diagram on screen; users type through invalid states constantly, and
blanking the canvas on every half-finished line would be unusable. A returned
`error` means the request itself was malformed.

**Positions.** `from` and `to` are offsets in **UTF-16 code units** (the
units JavaScript and CodeMirror index by), because the pipeline compiles with
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
  later one and the diagram flickers between states, a symptom that looks like
  a layout bug and is not.

### Rendering details fixed at the boundary

- `NoXMLTag` is set: the canvas injects the string into a div it owns, where an
  XML declaration is invalid.
- `OmitVersion` is set: D2 stamps a build-time version that does not track the
  module version (it reports `v0.8.1-HEAD` while running v0.9.0), so recording
  it in a golden file would commit a false fact.
- `Salt` is unset. It changes generated ids deterministically and is reserved
  for giving each embedded diagram its own id namespace in Milestone 5.

### Layout

Added in Milestone 6.6. `Result.layout` is the geometry the canvas builds
shapes from: each shape's `id`, `type`, `parent`, position, size and label,
and each connection's `src`, `dst`, arrowheads, label and `route`.

**It carries no colours**, and no opacity, dashes, icons, tooltips or links.
A diagram inserted on the canvas arrives in Bava's own style (decided
2026-09-19), and leaving D2's palette out of the contract is what keeps that
true: nothing downstream can come to depend on it.

**`parent` comes from the dotted absolute id**, resolved against the ids that
exist, so a label containing a dot cannot invent a container.

**The SVG and the layout never disagree**, because both come from the one
compile. The SVG is for previewing; the layout is for building.

## FileService

Added in Milestone 5. Reads and writes files; knows nothing about what is in
them beyond handing the parse to `internal/format`.

| Method | Returns |
|---|---|
| `Open(path)` | `OpenResult`: prose, diagram blocks by id, scene, stamp, error |
| `Save(path, source, scene)` | `SaveResult`: path, new stamp, error |
| `ChangedOnDisk(path, stamp)` | bool |
| `ChooseFileToOpen()` | `DialogResult`: a path, or empty when cancelled |
| `ChooseFileToSave(suggestedName)` | `DialogResult`: a path, or empty when cancelled |
| `ListWorkspace(dir)` | `ListResult`: folders then `.md`/`.d2` files, hidden entries skipped |
| `Settings()` | the user's preferences, defaults when unreadable |
| `SaveSettings(settings)` | an error string, empty on success |

## ExportService

Added in Milestone 6.4. Writes an exported picture where the user asked.

| Method | Returns |
|---|---|
| `Save(path, contentsBase64)` | an error string, empty on success |

**The picture is drawn in the frontend**, which owns the canvas, and crosses as
base64. The bridge is JSON, so raw bytes would arrive as an array of numbers,
several times the size of the image. Go decodes and writes; it never draws.

**It writes like a document save**, through `store.Save`: a temporary file
renamed into place, so a failure never leaves half a PNG where a whole one
was, and a folder that does not exist is an error rather than something
silently created.

**It is not part of `FileService`.** An export is a copy, not the user's
document: nothing here touches the open file, its stamp or its history.

**A scene crosses the bridge whole.** `format.Scene` and `format.Element`
implement their own JSON encoding, so every key an element has, known or not,
reaches the frontend and comes back to be saved (fixed in Milestone 6: a plain
decode dropped points, text and unknown keys). As a result Wails types `Scene`
as `any` in the generated TypeScript; the frontend's own scene types in
`canvas/scene.ts` describe it.

**Errors are data here too.** A missing file, a permission denial, a malformed
canvas block (all things the user can act on) come back in `error` rather
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
and nothing beginning with a dot: that is Bava's own state or the user's
tooling, not their documents.


## Menu

Added in Milestone 5.6. The native menu bar is declared in
`internal/app/menu/spec.json` and built from it in Go. It names commands; it
does not perform them.

### `menu:command` (Go → frontend)

An event, not a binding. Every click on a dispatchable item emits one:

```json
{ "id": "file.save" }
{ "id": "file.openRecent", "arg": "/path/to/notes.md" }
```

`frontend/src/shell/commands.ts` maps each id to an action. A test reads the
spec and fails when an id has no handler, or a handler has no spec entry.
An unknown id is ignored rather than thrown, so a newer menu cannot crash an
older frontend.

Native roles (Hide, Quit, Close Window, Minimise, Zoom, Full Screen) never
emit; they act through the platform. Cut, Copy and Paste are **not** roles:
on Windows those roles run clipboard scripts in the page that never reach the
canvas, so they are commands like Undo, and text goes through the Wails
clipboard API rather than the browser's.

Items with a `shortcut` (punctuation keys) never emit from a key press either:
the page matches the key itself and dispatches the same command id through
the same dispatcher. A click on the item still emits `menu:command`.

### `MenuService.SetState(state)` (frontend → Go)

The one bound method. The frontend reports what the menu reflects, and Go
never guesses:

| Field | Menu effect |
|---|---|
| `viewMode` | Document / Both / Canvas radio |
| `showsFiles`, `showsAI` | pane checkboxes |
| `theme` | Appearance radio |
| `tool` | Tools radio |
| `hasSelection` | enables Group, Ungroup, Bring to Front, Send to Back |
| `recents` | rebuilds Open Recent; empty shows a disabled placeholder |

Checks and enabled state are set on the native items directly. The menu is
rebuilt (`Menu.Update`, on the main thread) only when the recents list
changed; every tool switch and selection change calls `SetState`, and a
rebuild each time would be wasteful everywhere and a GTK call off the main
thread on Linux.

Calling it before the menu is installed does nothing. Building the menu is
deliberately not bound: `app.InstallMenu` is a package function main calls
after `application.New`.

## LogService

Added in Milestone 5.8. The frontend's way into Bava's own log. Nothing here
leaves the machine: there is no upload, and Report Issue… stays hidden until
Milestone 16 confirms the public tracker.

| Method | Returns |
|---|---|
| `Report(entry)` | nothing (logs a frontend error); `entry` is `{level, kind, stack, source}`: the error's kind and stack frames, **never its message**, which can quote input. Kind capped at 200 characters, stack at 8,000. At most 20 per 10 seconds; the number dropped is noted when the next report arrives |
| `Diagnostics(userAgent)` | plain text for the user to copy: build, OS, webview, whether the last session ended unexpectedly, and the last 200 log lines, already redacted |
| `OpenLogsFolder()` | an error message, empty on success |
| `TakeNotices()` | pending notices, once: `{kind: "unexpectedExit" \| "webviewReloaded", session}` |
| `SetVerbose(on)` | an error message, empty on success; switches the live level and saves `verboseLogging` |

### `app:error` (Go → frontend)

Emitted when Go recovers from a panic, whether in a bound method, a Wails
goroutine, or one Bava started with `app.Go`. Carries `{id}`, which finds the
full stack in the log; the frontend supplies the words. Never the stack, never
content.

A panic inside Wails' `InvokeSync` is the exception: its caller would wait
forever, so Bava logs it and exits instead, and the next launch reports the
unexpected exit. Panics in Wails' window-event and event hooks are not
recovered by Wails at all and end the process the same way.
