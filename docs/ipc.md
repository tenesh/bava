# IPC

The Go services the frontend calls, registered in `main.go`: `RenderService`,
`FileService`, `SpaceService`, `ExportService`, `MenuService` and
`LogService`. Generated bindings land in
`frontend/bindings/github.com/tharabyte/bava/internal/app/`. Keep the surface
small: every method must survive a Wails beta upgrade.

**Errors are data** throughout: a problem the user can act on (missing file,
permission, malformed block, bad D2) comes back in the result's `error`. A
returned Go `error` means the request itself was malformed. Cancelling a
dialog returns an empty path, not an error.

**Long tasks are stopped by name.** `Import`, `ExportZip` and `SpacePDF`
take a `run`, a random name the frontend gives the task, so it stays unique
when the page reloads while Go runs on;
`SpaceService.Cancel(run)` stops it. The call itself still answers, once
nothing it began is left behind, with `code` `cancelled`; one that finished
first answers as done. The runtime's own cancel is never used: it rejects
the promise at once and drops Go's answer, so the page could not learn how
the task really ended.

## RenderService

```go
func (s *RenderService) Render(source string, opts render.Options) (render.Result, error)
```

Serves Diagram from Code only: a preview SVG and the `layout` the frontend
converts into shapes and arrows (`frontend/src/canvas/import/convert.ts`). The
D2 source is not kept, and the canvas never round-trips through Go.

| Request | Type | Meaning |
|---|---|---|
| `source` | string | D2 source |
| `opts.engine` | string | `tala` (default when empty), `dagre`, `elk`; anything else is a returned error |
| `opts.direction` | string | `down`, `right`, `up`, `left`, or empty. Appended as a top-level `direction` only when the source sets none. TALA ignores it, so the UI hides it there. Unknown is a returned error |
| `opts.theme` | object, optional | Diagram colours. Absent renders D2's defaults (what the goldens expect). The frontend never sends it |

```ts
type Result = {
  svg: string;                      // no XML declaration; empty on failure
  errors: Diagnostic[] | null;      // compile diagnostics
  nodeMap: Record<string, Span> | null;
  layout: Layout;                   // geometry to build shapes from; empty on failure
};
type Diagnostic = { message: string; from: number; to: number; line: number };
type Span = { from: number; to: number; line: number }; // where in the source
```

- **Compile errors** return a successful call with `errors` set and `svg`
  empty. `from`/`to` are **UTF-16 code units** (`UTF16Pos`), never bytes;
  `line` is **1-indexed**.
- **`nodeMap`** maps an SVG element id to the node's earliest reference in the
  source (its declaration). No geometry; no screen reads it yet.
- **`layout`**: each shape's `id`, `type`, `parent`, position, size and label;
  each connection's `src`, `dst`, arrowheads, label and `route`. No colours,
  opacity, dashes, icons, tooltips or links: inserted diagrams take Bava's
  style. `parent` comes from the dotted absolute id resolved against existing
  ids, so a dot in a label cannot invent a container. SVG and layout come from
  one compile and never disagree.
- **Fixed options:** `NoXMLTag` and `OmitVersion` (D2's stamped version is
  wrong) set, `Salt` unset.
- **Client** (`frontend/src/ipc/render.svelte.ts`): 250ms debounce; requests
  carry an incrementing id and stale responses are dropped.

## FileService

Reads and writes files; parsing is `internal/format`'s.

| Method | Returns |
|---|---|
| `Open(path)` | `OpenResult`: prose (the file without its canvas block), diagram blocks by id, scene, stamp, error. A malformed canvas block still returns the prose. Allows the page's folder for `/bava-file/` |
| `Save(path, source, scene)` | `SaveResult`: path, new stamp, error |
| `ChangedOnDisk(path, stamp)` | bool |
| `ChooseFileToOpen()` | `DialogResult`: a path, empty when cancelled |
| `ChooseFileToSave(suggestedName)` | `DialogResult`: as above |
| `Settings()` | `config.Settings`, defaults when unreadable. `arrowBinding` and `midpointSnap` default on (absent reads as on), `objectSnap` off |
| `SaveSettings(settings)` | error string, empty on success |
| `ChooseMedia(kind)` | `PathsResult`: images (`image`), videos (`video`), any files (`file`), or pages and zips to import (`import`) from the native dialog, several at once; none when cancelled. Every pick is kept for a store's sandbox |
| `FileDetails(root, path)` | `FileDetailsResult`: whether a file in an opened folder exists, its size and date modified (for a file card). A file outside (`../…` or a full path) reads only once the user chose it; until then `outside` is true and nothing is read |
| `OpenFile(root, path)` | error string, empty on success: opens the file in its own app; a program, script or folder is revealed in its folder instead, so a click never runs code. A file outside the opened folder, not chosen yet, is asked for once through the system's dialog at its place; cancelling opens nothing |
| `ClipboardImage()` | the clipboard image as base64 PNG, empty when none (the webview pastes text only) |

- **A scene crosses whole.** `format.Scene` and `format.Element` do their own
  JSON, so unknown keys survive the round trip; Wails therefore types `Scene`
  as `any`, and `canvas/scene.ts` describes it.
- **`stamp`** is size plus modification time. The time, in nanoseconds,
  crosses as a decimal string (`modifiedUnixNano: "1790444150393195667"`):
  as a JSON number JavaScript would round it.

### `progress` (Go to frontend)

How far a long task has got: `{ task, done, total }`, `task` naming it
(`import`, `zip`). Sent after each item, so the last says `done` equals
`total`. Several tasks never run at once from one window.

### `files:dropped` (Go to frontend)

Files dragged onto an element marked `data-file-drop-target` (the Document, the canvas):
`{ paths, x, y }`, the point in CSS pixels from the page's top left. The window
sets `EnableFileDrop`.

### Files the page shows

Images and videos load from the app's asset server, not a binding:
`GET /bava-file/?root=<folder>&path=<relative>`, an `AssetOptions.Middleware`
before the embedded frontend. Range requests are answered. Anything not
meeting all of these is a 404:

- `root` is absolute and was opened this session (`SpaceService.Open` or
  `Create`, or a page's folder via `FileService.Open`); kept in memory only.
- `path` is relative, `/`-separated, has no `\` or `:`, stays inside `root`,
  passes through no link, and is opened through `os.OpenRoot`.
- No hidden part, except `.bava/attachments/<file>`.
- Extension is an image (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`) or
  a video (`.mp4`, `.webm`, `.mov`), served with that type.

Every response carries `X-Content-Type-Options: nosniff` and a sandboxing
`Content-Security-Policy`, so an SVG is only ever an image.

## SpaceService

A Space on disk (`docs/file-format.md`, "Spaces"), changed through one
`Apply` method. Every change is a real file operation in `internal/space`.

| Method | Returns |
|---|---|
| `Create(parent, name)` | `SpaceInfo`: makes folder `name` in absolute `parent` and opens it; a taken or invalid name is refused with a `code` |
| `Open(dir)` | `SpaceInfo`: root, name (the folder's), page width; creates `.bava/space.json` when missing |
| `List(root, folder)` | `SpaceList`: one folder's pages (`.md`) and folders in the Space's order; never hidden entries, `.d2` files or `.bava` |
| `Templates(root)` | `TemplateList`: each `group`, `name`, `path` (from the root); groups by name, each group's by name, then ungrouped |
| `SaveTemplate(root, group, name, source, scene, replace)` | `OpResult`: the template's `path`, written as a page; a taken name is `exists` unless `replace` |
| `CreatePageFrom(root, folder, name, source, scene)` | `OpResult`: the new page's `path` |
| `Attachments(root)` | `AttachmentList`: each file in `.bava/attachments` (no folders, links or hidden files) with size and date modified |
| `FetchCard(root, address)` | `CardDetails`: a web page's title, description, and icon and picture saved as attachments (their names; none outside a Space). Only on the user's paste or Refresh details. At most 8 s, 5 redirects, 1 MB of page, 2 MB per picture; no cookies; `User-Agent: Bava` |
| `Apply(root, op)` | `OpResult`: new path, Trash item id, renamed Space root, or attachment name (below) |
| `Index(root, withText)` | `SpaceIndex`: every page (path, name without `.md`, and with `withText` its text, or `unreadable` set, meaning its links are unknown) in tree order; `folders`, every folder by path, sorted, an empty one too (what Import's Into and Export Space's What offer); never hidden entries or `.bava`. The frontend reads links from the text |
| `Search(root, query, open)` | `SpaceSearch`: `hits` and `more` (over 50 found). Each hit: `kind`, `path`, `name`, `folder`, `count`, `best` (`where`: `name`, `document` or `canvas`; `text`, about 80 characters around the match; `word`; `occurrence`, earlier matches of the word in the Document; `element`, the canvas element id). Every query word must start a word (case ignored) in the name, Document or Canvas. Names first, then count, then tree order. Pages and folders only. `open` (`path`, `source`, `scene`) is searched instead of its file. Writes nothing |
| `ZipPlan(root, scope)` | `ZipPlanResult`: `files` (`path` in the zip, `size`), sorted by path. `scope`: `kind` (`space`, `folder`, `page`), `path`, `attachments` (names the pages use). A Space's zip is every file with `.bava` minus its Trash; a folder's or page's keeps its place with only the named attachments. Hidden files and links never followed |
| `ExportZip(root, run, scope, out)` | `Problem`: writes that zip to `out` via a temporary file renamed into place, sending `progress` (`task: "zip"`). `Cancel(run)` leaves nothing at `out`, `code` `cancelled` |
| `ImportPlan(root, sources, into)` | `ImportPlanResult`: `plan` (`into`; `origins`, each pick's `path` and the `root` its entries' `from` start in, `""` for a zip; `entries`, each `kind` (`page`, `folder`, `file`, `template`), `origin`, `from`, `entry` (its path in a zip), `to` (a path in the Space, a file's name for the attachments, a template's path under the templates folder) and `size`; `renames` (`from`, `to`) for what is numbered to keep both, names inside what comes in that differ only in case included; `skipped`, what stays behind because a Space cannot hold its name, by its path in its pick, a folder once (never what is hidden or a link); `pages`, `files`, `templates`, `bytes`). `sources`: pages, folders or zips the user picked, refused (`outside`) if not; anything else is `notImport`. A folder comes in whole, pages land in `into`, a zip keeps its folders; hidden files, links (a linked `.bava` or its folders too) and names a Space cannot hold as they are (one it would trim) stay behind, while a page or folder picked by such a name lands under the name the Space holds; a zip's file at its top goes to the attachments; a Space's or Bava zip's attachments and templates come, never its settings or Trash. Writes nothing |
| `Import(root, run, sources, into)` | `ImportResult`: `result` (`plan` as carried out, `pages` written with their `path`, `origin` and `from`, `attached` mapping `"<origin>:<from>"` to the attachment each file became). Planned afresh, so a name taken since is numbered, never overwritten. Pages byte for byte; identical bytes reuse an attachment. Sends `progress` (`task: "import"`). `Cancel(run)` removes what it made, folders it made included, and the result's `code` is `cancelled` |
| `Cancel(run)` | nothing: stops the `Import`, `ExportZip` or `SpacePDF` named `run`, now or as it starts; that call answers `cancelled` |
| `Trash(root)` | `TrashList`: items (origin, kind, when, size) and total size |
| `ChooseFolder(title, near)` | `DialogResult`: native folder picker (can make a folder), opening at `near` or the nearest folder above it still there; empty when cancelled |
| `Reachable(paths)` | `[]bool`: whether Bava may reach each path now (inside a store's sandbox, only what the user allowed) |
| `Reveal(root, path)` | `Problem` (`error`, `code`), empty on success: the Space folder, or an item selected in it (an attachment as `.bava/attachments/<name>`; other hidden paths refused); `revealUnavailable` with no file manager |

`Apply` operations (`op.kind`, with its fields):

| Kind | Fields and effect |
|---|---|
| `createPage`, `createFolder`, `rename`, `duplicate`, `trash`, `restore`, `deleteForever`, `emptyTrash`, `renameSpace`, `setPageWidth` | as named |
| `move` | `folder`, `index` (-1 for the end) |
| `relink` | `edits`: each page's `path`, `before`, `after`; a page is written only if it still reads as `before`; `missed` lists the rest |
| `attach`, `attachData` | `source` (any file, by its whole path; a relative one is refused) copied into `.bava/attachments`, or `data` (base64) saved as `name` or `Pasted image <date> <time>.png` |
| `renameAttachment`, `trashAttachment` | `attachment` renamed to `name` (extension kept), or to the Trash (back with `restore`) |
| `savePicture` | a canvas embed's picture, `data` in base64: saved under `name`, numbered when taken, never sharing a file with the same bytes; with `replace`, written to `name` itself (made if gone, untouched if identical). Returns the name used |
| `deleteSpaceData` | deletes `.bava` for good (Trash included); pages in the Space's folders kept; a `.bava` that is a link is `throughLink` |
| `renameTemplate`, `moveTemplate`, `duplicateTemplate`, `deleteTemplate` | `path`: renamed to `name` in its group; moved to group `folder` ("" for none); copied beside itself, numbered; deleted for good. An emptied group goes |

`attach`, `attachData` and `renameAttachment` return the attachment's `name`:
numbered when taken by a different file, or the existing identical file's. A
template name taken in its group is `exists`.

- **Root** must be absolute and hold `.bava/`. **Paths** are relative,
  `/`-separated; absolute, outside, hidden or through a link is refused.
  Nothing is overwritten (a case-only rename is allowed).
- **Codes** (`internal/space/errors.go`, worded by the frontend as
  `space.error.*`): `exists`, `nameEmpty`, `nameSlash`, `nameDot`,
  `nameReserved`, `intoItself`, `notFolder`, `onlyPage`, `outside`,
  `throughLink`, `notSpace`, `changed`, `notAttachment`, `notPage`, plus
  `revealUnavailable` from `Reveal`. Other failures have an empty `code` and
  `error` is shown as is.

## ExportService

Writes exports the frontend drew (`frontend/src/canvas/export/`,
`internal/export`). Separate from `FileService`: an export never touches the
open file, its stamp or history.

| Method | Returns |
|---|---|
| `Save(path, contentsBase64)` | error string, empty on success. Base64 because the JSON bridge would send bytes as a number array. Written through `store.Save` (temp file renamed into place); a missing folder is an error |
| `PagePDF(root, request, out)` | `Problem`: prints a page to a PDF at `out`. Codes: `notOpened` (folder not opened this session), `unavailable` (no printing here), `setup` (paper or margins unprintable), `nothing` (neither Document nor Canvas), `failed` (`error` says how) |
| `SpacePDF(root, run, request, out)` | `SpacePDFResult` (`error`, `code`, `page`): a folder or the Space as one PDF, contents first. `PagePDF`'s codes, plus `page` when a page failed (`page` names it; nothing written). `SpaceService.Cancel(run)` stops it between pages and writes nothing, `code` `cancelled` |

- **Page request:** `setup` (`internal/pdfprint` page setup); `document` (the
  page's HTML, styles, `widthPx`, 0 for full width); `canvas` (SVG, `width`,
  `height`); `dark` with `paper`; `numbers` with `ink`. Go embeds the bundled
  fonts and the pictures (opened folders, images only) in one file under a
  policy that loads nothing else, and the system webview prints it. The Canvas
  gets its own sheet, landscape when wider than tall, scaled to fit. Dark fill
  and page numbers are applied after printing with pdfcpu; parts are joined
  and written like a save.
- **Space or folder request:** `title`; `entries` in Files tree order, each a
  folder (`folder`, `depth`, `title`) or a page (`path`, `document` with HTML
  and `widthPx`, `canvas`); `css` once for all pages; `setup`, `dark`,
  `paper`, `text`, `ink`, `numbers`. Pages print as above, then the contents
  (title, folders as headings, each page's starting sheet, reprinted if its
  length shifts them). Numbering starts at the contents; bookmarks nest pages
  under folders.

## MenuService

The native menu is declared in `internal/app/menu/spec.json` and built in Go
(`app.InstallMenu`, called after `application.New`, not bound). An item's
`when` names the menu states it needs to run, all of them (`hasSelection`,
`hasSpace`, `hasDocument`, `showsCanvas`, `canPasteStyles`, `hasLocked`): Go
enables it from the state the page sends with `SetState`, and the command
palette leaves out what cannot run, from the same state.

### `menu:command` (Go to frontend)

Every click on a dispatchable item emits `{ "id": "file.save" }` or
`{ "id": "file.openRecent", "arg": "/path/to/notes.md" }`.
`frontend/src/shell/commands.ts` maps ids to actions; a test fails on an id
without a handler or the reverse. Unknown ids are ignored.

- Native roles (Hide, Quit, Close Window, Minimise, Zoom, Full Screen) never
  emit. Cut, Copy and Paste are commands using the Wails clipboard API (the
  Windows roles never reach the canvas). Items with a punctuation `shortcut`
  emit only on click; the page handles the key with the same id.

### `SetState(state)` (frontend to Go)

| Field | Menu effect |
|---|---|
| `viewMode` | Document / Both / Canvas radio |
| `showsFiles`, `showsAI` | pane checkboxes |
| `theme` | Appearance radio |
| `tool` | Tools radio |
| `hasSelection` | enables Group, Ungroup, Arrange, Flip, Duplicate, Align, Distribute, Copy Styles, Copy as, Export Selection, Lock and Zoom to Selection |
| `canPasteStyles` | with `hasSelection`, enables Paste Styles |
| `hasLocked` | enables Unlock All |
| `hasDocument` | enables Export |
| `showsCanvas` | with `hasDocument`, enables File ▸ Diagram from Code and File ▸ Picture |
| `hasSpace` | enables New Folder, Trash, Space Settings and Import |
| `objectSnap` | ticks Canvas ▸ Snap to Objects |

Which items each state enables is the `when` of each item in `spec.json`; this table follows it.
| `recents` | rebuilds Open Recent; empty shows a disabled placeholder |

Checks and enablement are set on the items directly; the menu is rebuilt
(`Menu.Update`, main thread) only when `recents` changes. Calling it before
the menu is installed does nothing.

## LogService

The frontend's way into Bava's own log. Nothing leaves the machine.

| Method | Returns |
|---|---|
| `Report(entry)` | nothing. `entry` is `{level, kind, stack, source}`, **never the message** (it can quote input). Kind capped at 200 characters, stack at 8,000. At most 20 per 10 seconds; the dropped count is noted on the next report |
| `Diagnostics(userAgent)` | text to copy: build, OS, webview, whether the last session ended unexpectedly, last 200 log lines, redacted |
| `OpenLogsFolder()` | error message, empty on success |
| `TakeNotices()` | pending notices, once: `{kind: "unexpectedExit" \| "webviewReloaded", session}` |
| `SetVerbose(on)` | error message, empty on success; sets the live level and saves `verboseLogging` |

### `app:error` (Go to frontend)

Emitted when Go recovers a panic in a bound method, a Wails goroutine, or one
started with `app.Go`. Carries `{id}` (finds the stack in the log), never the
stack or content. A panic inside Wails' `InvokeSync`, or in its window-event
and event hooks, ends the process instead; the next launch reports the
unexpected exit.

Every path the user picks through a dialog, or drops, is kept for a store's sandbox (`internal/access`).
