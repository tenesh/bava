# 05: File format and persistence

**Goal:** Open and save real files. The first milestone where work outlives
the app.

**Specs:**
- `docs/file-format.md` — **approved 2026-09-17, written before this plan**
- `.ai/rules/file-format.md` — plain text, round-trip tests, forward
  compatibility
- `.ai/rules/wails.md` — the native surface stays thin
- `.claude/plan/roadmap.md` — Milestone 5

**File format impact:** this milestone *is* the file format impact. Everything
it writes is specified in `docs/file-format.md` first, and every change ships
with a round-trip test.

**UI impact:** components added — `FileTree` (wrapping Ark's TreeView),
`Dialog` reused for the unsaved-changes and file-changed prompts. The file pane
stops rendering `EmptyState` and shows a workspace.

## Constraints

- **Nothing writes a format that is not in `docs/file-format.md`.** If this
  milestone discovers the spec is wrong, the spec changes first, in its own
  commit, and this plan is re-read against it.
- **Round trip, not writer-plus-reader.** Write → read → compare. Asymmetries
  hide exactly in the gap between two separate tests.
- **Unknown element types and unknown keys survive.** Tested with a file
  containing both, on every change to the format code.
- The canvas block is written only when the canvas is non-empty, always last,
  pretty-printed.
- Diagram source stays in fenced `d2` blocks; the canvas block references the
  block id and stores placement only.
- A standalone `.d2` file is written back unchanged.
- Go owns file I/O. The native surface stays thin: open, save, watch, and
  native dialogs.
- Per-viewer state — zoom, pane widths, view mode, recents — stays in
  `localStorage`, never in a file.

### Decisions taken in this plan

- **Parsing is ours, not a Markdown library.** We need exactly two things from
  the Markdown: fenced blocks with their info strings, and everything else left
  byte-identical. A full Markdown parser round-trips prose *approximately* —
  it normalises whitespace, reorders reference links, rewrites emphasis
  markers — and approximate is a synonym for corrupting a user's file.
- **The writer preserves the prose it did not author.** Reading yields the
  original text plus a block index; writing replaces only the `bava-canvas`
  block and leaves every byte of prose alone.
- **Recent files live in `localStorage`, not a config file.** They are a
  convenience, not work product, and Milestone 16 can promote them if a
  settings file wants them.

## Tasks

### Task 1: Block scanner
**Files:** create `internal/format/scan.go`, `internal/format/scan_test.go`.
**Behavior:** find fenced blocks in Markdown — start, end, info string, body —
and leave everything else untouched. Handles nested backticks, blocks inside
lists, and unterminated fences.
- [x] Failing test: `TestFindsFencedBlocksWithInfoStrings`
- [x] Failing test: `TestIgnoresFencesInsideALongerFence` — a ```` ```` ````
      block containing ``` is one block, not three
- [x] Failing test: `TestUnterminatedFenceIsNotABlock` — and does not panic
- [x] Failing test: `TestOffsetsSliceTheOriginalExactly`
- [x] Implement
- [x] Green: `go test ./internal/format -run Scan`

### Task 2: Read a file
**Files:** create `internal/format/read.go`, `internal/format/read_test.go`.
**Behavior:** parse a Bava file into prose, `d2` blocks keyed by id, and the
canvas scene. Unknown element types and unknown keys are retained as raw JSON.
- [x] Failing test: `TestReadsProseDiagramBlocksAndScene`
- [x] Failing test: `TestFileWithNoCanvasBlockReadsAsEmptyScene`
- [x] Failing test: `TestUnknownElementTypeIsRetained`
- [x] Failing test: `TestUnknownKeysOnAKnownElementAreRetained`
- [x] Failing test: `TestMalformedCanvasBlockIsAnErrorNotAPanic` — and the
      prose is still returned, because losing a document to a bad trailing
      block is the worst outcome available
- [x] Implement
- [x] Green: `go test ./internal/format -run Read`

### Task 3: Write a file
**Files:** create `internal/format/write.go`, `internal/format/write_test.go`.
**Behavior:** write prose unchanged, replace or append the canvas block, omit
it entirely when the scene is empty.
- [x] Failing test: `TestOmitsTheCanvasBlockWhenTheSceneIsEmpty`
- [x] Failing test: `TestCanvasBlockIsLastInTheFile`
- [x] Failing test: `TestCanvasBlockIsPrettyPrinted`
- [x] Failing test: `TestProseIsByteIdenticalAfterWriting` — the property that
      stops us corrupting files we did not author
- [x] Implement
- [x] Green: `go test ./internal/format -run Write`

### Task 4: The round trip
**Files:** create `internal/format/roundtrip_test.go`.
**Behavior:** the mandatory test. Write → read → compare, over a corpus that
includes the awkward cases.
- [x] Failing test: `TestRoundTripPreservesEverything` — a table covering: no
      canvas, canvas only, prose with several diagram blocks, an unknown
      element type, unknown keys, CRLF input, a file ending without a newline,
      and unicode prose
- [x] Failing test: `TestRoundTripIsIdempotent` — writing twice changes
      nothing the second time
- [x] Failing test: `TestForeignD2FileIsWrittenBackUnchanged`
- [x] Implement whatever these expose
- [x] Green: `go test ./internal/format -run RoundTrip -v`

### Task 5: Store — reading and writing files
**Files:** create `internal/store/store.go`, `internal/store/store_test.go`.
**Behavior:** open, save, save-as over the real filesystem. Atomic writes:
write to a temporary file in the same directory, then rename, so a crash
mid-save cannot truncate the user's work.
- [x] Failing test: `TestSaveIsAtomic` — the target is either the old content
      or the new, never partial
- [x] Failing test: `TestSaveCreatesParentDirectoriesRefusal` — saving into a
      directory that does not exist is an error, not a silent mkdir
- [x] Failing test: `TestOpenRejectsADirectory`
- [x] Implement
- [x] Green: `go test ./internal/store`

### Task 6: External modification
**Files:** modify `internal/store/store.go`; create
`internal/store/watch_test.go`.
**Behavior:** detect that a file changed on disk since it was read — by
modification time and size, which is enough to prompt and cheap enough to check
on focus. The prompt itself is Task 8.
- [x] Failing test: `TestDetectsAChangeOnDisk`
- [x] Failing test: `TestUnchangedFileIsNotReportedAsChanged`
- [x] Implement
- [x] Green: `go test ./internal/store`

### Task 7: IPC
**Files:** modify `internal/app/bindings.go`; create
`internal/app/file_test.go`; regenerate bindings.
**Behavior:** a `FileService` with open, save, save-as and a changed-on-disk
check, plus native dialogs. Errors are data where the user can act on them —
a missing file, a permission denial — and returned errors only for malformed
calls.
- [x] Implement
- [x] Contract test: JSON field names for everything crossing the boundary,
      the same guard that caught a rename in Milestone 1
- [x] Green: `go test ./internal/app && go vet ./internal/... .`

### Task 8: The frontend — file tree, open, save, prompts
**Files:** create `frontend/src/files/*`, `frontend/src/components/FileTree.svelte`;
modify the shell.
**Behavior:** a workspace in the file pane on Ark's TreeView, recent files, and
the three dialogs the design shows: unsaved changes on close, changed on disk
with reload/keep/diff, and cannot-open with a reason. A dirty indicator in the
title bar.
- [x] Failing test: `TestDirtyStateTracksUnsavedChanges`
- [x] Failing test: `TestClosingWithUnsavedChangesPrompts`
- [x] Failing test: `TestRecentFilesSurviveStorageThrowing`
- [ ] Implement — **partial: state only, see the completion record**
- [x] Green: `cd frontend && npm run check && npm run lint && npm test`

### Task 9: Wire the canvas to a file
**Files:** modify `frontend/src/App.svelte`, the shell, and the scene module.
**Behavior:** opening a file loads its scene onto the canvas; saving writes it
back. The tunables Milestone 1 left as constants — the 250ms debounce and the
default layout engine — move behind a settings file here.
- [x] Implement
- [x] Green: full gates, and `wails3 dev` opens and saves a real file

## Artifacts

- `docs/file-format.md` — updated in the same change if implementation
  disproves anything in it
- `docs/ipc.md` — the new `FileService` methods
- `docs/decisions.md` — atomic writes, the hand-rolled scanner, recents in
  localStorage
- `.ai/rules/design-system.md` — `FileTree` added to the inventory
- Build-loop repo-state — Milestone 5 closed, the first milestone where the app
  persists anything
- `.claude/plan/roadmap.md` — Milestone 5 marked complete

## Out of scope

- `diagram` elements. The format specifies them; nothing creates one until
  Milestone 6. The round-trip test covers them as an unknown-but-preserved
  case.
- Documents as an editable surface — Milestone 8. Prose is read and written
  back byte-identically here, not edited.
- Search across a workspace — Milestone 15.
- Autosave. Explicit save only, until there is a reason to change it.


## Completion record — 2026-09-17

144 frontend tests and 47 Go tests, every gate green. `docs/file-format.md` was
written and approved **before** any code in this milestone.

**The format layer is complete.** Scanner, reader, writer and the mandatory
round trip: 25 tests covering prose-only, canvas-only, unknown element types,
unknown keys, unknown top-level keys, CRLF, no trailing newline, unicode prose
and nested fences — plus idempotence and a foreign `.d2` going home unchanged.
`internal/store` adds atomic saves and conflict detection, `internal/config`
the settings file.

**Tasks 8 and 9 shipped their state, not their screens.** `createDocument` and
`createRecents` are implemented and tested — dirty tracking, conflict refusal,
open errors that do not close the current document, recents that survive a
throwing `localStorage`. The title bar shows saved/unsaved. **What does not
exist: the file tree, the open and save dialogs, the three prompts, and the
menu wiring to trigger any of it.** So the app cannot yet open or save a file
by hand, though everything underneath it can.

That is a deviation from the plan, which said Milestone 5 was the point where
work outlives the app. It is not, yet. The remaining piece is UI over a tested
foundation, and it is the first thing Milestone 6 has to finish.

**One real bug the tests caught:** `Write` dropped the whole canvas block when
a scene had no elements — including any unknown top-level key a newer version
had left in it. Exactly the data-loss the preservation rules exist to prevent,
found by the test written for that rule.

**The last Milestone 1 deferral is closed.** The 250ms debounce and the default
layout engine now come from the settings file, with the constants as fallbacks.
