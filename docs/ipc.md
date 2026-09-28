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
| `opts.direction` | string | `down`, `right`, `up`, `left`, or empty for none. Appended as a top-level `direction` only when the source sets none, so the code wins and diagnostics keep their lines. TALA ignores it. An unknown value is a returned error. |

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
| `Settings()` | the user's preferences, defaults when unreadable; since 06.16 they include `arrowBinding` and `midpointSnap`, both on by default (an older file omits them and reads as on), and since Milestone 7 `objectSnap`, off by default |
| `SaveSettings(settings)` | an error string, empty on success |
| `ChooseMedia(kind)` | `PathsResult`: the images (`kind` `image`) or videos (`video`) chosen in the native open dialog, several at once; none when cancelled |
| `ClipboardImage()` | the clipboard's image as PNG in base64, or empty when it holds none; read for a paste, since the webview hands the page text only |

Opening a page allows its folder for the file route below.

### `files:dropped` (Go → frontend)

Files dragged from the desktop onto an element marked `data-file-drop-target`
(the Document): `{ paths, x, y }`, the point in CSS pixels from the page's
top left. The window enables file drops (`EnableFileDrop`).

### Files the page shows

Images and videos in a page are drawn from the app's own asset server, not
through a bound call: `GET /bava-file/?root=<folder>&path=<relative>`, an
`AssetOptions.Middleware` in front of the embedded frontend. Range requests
are answered, so a video seeks.

It serves one file, and only when all of these hold; anything else is a 404:

- `root` is absolute and was opened this session: a Space (`SpaceService.Open`
  or `Create`), or the folder of a page opened on its own (`FileService.Open`).
- `path` is relative, with `/` between its parts and no `\` or `:` (on Windows
  either could lead out of `root`), stays inside `root`, and passes through no
  link. The file is opened through `root` itself (`os.OpenRoot`).
- No part of `path` is hidden, except the `.bava/attachments/` of
  `.bava/attachments/<file>`.
- Its extension is an image (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`,
  `.svg`) or a video (`.mp4`, `.webm`, `.mov`), served with that type. An SVG
  is drawn as an image, so no script in it runs.

Every file is sent with `X-Content-Type-Options: nosniff` and a sandboxing
`Content-Security-Policy`, so an SVG is only ever an image, never a page
that runs.

The allowed folders live in memory and are forgotten when the app quits.

## SpaceService

Added in Milestone 8.1. A Space on disk (`docs/file-format.md`, "Spaces"):
open a folder as a Space, list its folders, and change it through **one**
method taking an operation, so the bound surface stays small. Every change is
a real file operation in `internal/space`; nothing keeps a second copy of the
tree.

| Method | Returns |
|---|---|
| `Create(parent, name)` | `SpaceInfo`: makes a folder named `name` in `parent` (an absolute path the user chose) and opens it as a Space; a taken or invalid name is refused with a `code` |
| `Open(dir)` | `SpaceInfo`: root, name (the folder's), the Space's page width; creates `.bava/space.json` when missing |
| `List(root, folder)` | `SpaceList`: one folder's pages (`.md`) and folders in the Space's order; never hidden entries, `.d2` files or `.bava` |
| `Apply(root, op)` | `OpResult`: the new path, a Trash item's id, or a renamed Space's root. `op.kind` is `createPage`, `createFolder`, `rename`, `move` (`folder`, `index`; -1 for the end), `duplicate`, `trash`, `restore`, `deleteForever`, `emptyTrash`, `renameSpace`, `setPageWidth`, `relink` (`edits`: each page's `path`, `before` and `after` text; a page is written only if it still reads as `before`, and `missed` lists those that were not), `attach` (`source`, a file anywhere, copied into `.bava/attachments`), `attachData` (`data` in base64, saved under `name`, or with none as `Pasted image <date> <time>.png`) or `renameAttachment` (`attachment` to `name`, its extension kept); the three return the attachment's `name`, numbered when taken by a different file, or an identical file's already there |
| `Index(root, withText)` | `SpaceIndex`: every page in the Space (its path, its name without `.md`, and with `withText` its text), in the tree's order; never hidden entries or `.bava`. The frontend reads links from the text with the Document's own reader: "Linked from", missing links, and which links a rename rewrites |
| `Trash(root)` | `TrashList`: items (where each came from, kind, when, size) and the total size |
| `ChooseFolder(title)` | `DialogResult`: the native folder picker, which can make a folder, titled as the frontend words it (translated there); empty when cancelled |
| `Reveal(root, path)` | `Problem` (`error`, `code`), both empty on success: the Space's folder, or an item selected in its folder, in the file manager; `revealUnavailable` when there is no file manager to call |

**The root is checked on every call**: it must be absolute and hold `.bava/`, or the call is refused, so an empty or stale root can never act on the working folder.

**Paths are relative to the Space**, with `/` between folders. One that is
absolute, leaves the Space, or is hidden (which keeps `.bava` out of reach) is
refused, in `Error`, and so is one that goes through a symbolic link. So is a name that already exists: nothing is overwritten (a rename that only changes case lands on the same file, and is allowed).

**Errors are data**, as for `FileService`. A refusal the user can act on
also carries `code` (`exists`, `nameEmpty`, `nameSlash`, `nameDot`, `nameReserved`,
`intoItself`, `notFolder`, `onlyPage`, `outside`, `throughLink`, `notSpace`, `changed`,
`revealUnavailable`;
`internal/space/errors.go`), and the frontend words it in the user's language
(`space.error.*`). Any other failure has an empty `code` and its `error` is
shown as it came.

It replaces `FileService.ListWorkspace`, whose flat listing of a file's parent
folder was the workspace before Spaces.

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
The modification time, in nanoseconds, crosses as a decimal string
(`modifiedUnixNano: "1790444150393195667"`): as a JSON number its 19 digits
were rounded in JavaScript, and every file looked changed on disk (06.17).

**Cancelling a dialog is not an error.** An empty path means the user changed
their mind, which is a normal outcome and is not reported as a failure.


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
| `objectSnap` | ticks Canvas ▸ Snap to Objects (Milestone 7) |
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
