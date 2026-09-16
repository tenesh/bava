# 01: The spine

**Goal:** Typing D2 in a source pane produces a laid-out SVG on the canvas,
through one Go render path, with stale responses dropped.

**Specs:**
- `CLAUDE.md` — architecture, stack, non-negotiables
- `.claude/plan/roadmap.md` — Milestone 1 scope and exit criterion
- `.claude/work/specs/render-ipc.md` — the contract, decided 2026-09-16
- `.ai/rules/ipc.md`, `canvas.md`, `d2.md`, `editors.md`, `svelte.md`,
  `testing.md`, `wails.md`

**File format impact:** none. Milestone 1 writes nothing to disk — no save, no
autosave, no `localStorage` for document state. Source lives in memory.
`docs/file-format.md` does not exist yet and nothing here needs it.

**UI impact:** none in `frontend/src/components/`. No tokens exist yet
(Milestone 2), so no component may be built. The shell is structural CSS only
— grid tracks and sizes, no colours, no shadows, no one-off values that would
later have to be un-inlined.

## Constraints

Copied from the specs, verbatim where they carry a value:

- Debounce **250ms** after typing stops. Every request tagged with an
  incrementing ID; responses whose ID is not the latest are **discarded**.
- IPC surface is exactly one method: `Render(source, opts) -> {svg, errors,
  nodeMap}`. No second render path.
- **TALA is the default engine.** dagre and elk are selectable alternatives,
  never fallbacks. `direction` is not exposed while TALA is active.
- Every `d2lib.Compile` gets a logger in the context via
  `d2log.With(ctx, logger)`, imported as `d2log "github.com/d2lang/d2/lib/log"`.
- `CompileOptions.FS` stays nil. `MaxVariableExpansion`, `MaxGlobExpansion`,
  `MaxEdgeExpansion` stay at zero.
- **All text measurement in Go** via `lib/textmeasure`. No measurement in the
  webview, ever.
- `RenderOpts.OmitVersion` is set on every render; `Salt` stays unset.
- Positions crossing the Go boundary are byte offsets plus **1-indexed** lines.
  D2's own ranges are 0-indexed; conversion happens once, in Go.
- Compile failure is **data, not an error**: `errors` is populated, the call
  succeeds, and the frontend keeps the last good SVG on screen.
- Canvas is a **plain TypeScript class**, mounted once into a `<div>`, owning
  its own DOM. No Svelte component renders diagram nodes.
- CodeMirror is mounted in `onMount`, destroyed in the cleanup return, and is
  never passed reactive props.
- Svelte 5 runes only. Shared state in `.svelte.ts` modules. TypeScript only.

## Tasks

### Task 1: Layout engine resolver
**Files:** create `internal/layout/layout.go`, `internal/layout/layout_test.go`.
**Behavior:** Resolve an engine name to a `d2graph.LayoutGraph`. `""` and
`"tala"` resolve to `d2talalayout.DefaultLayout`; `"dagre"` and `"elk"` to
their defaults. An unrecognised name is an **error**, not a silent fallback to
TALA — `.ai/rules/d2.md` is explicit that the others are alternatives, not
fallbacks, and a typo silently changing layout engine is the kind of thing
nobody notices for a month.
- [x] Failing test: `TestDefaultEngineIsTALA` — expected failure: no `layout`
      package exists, so it will not compile.
- [x] Failing test: `TestUnknownEngineIsAnError`
- [x] Implement
- [x] Green: `go test ./internal/layout`

### Task 2: Render pipeline — SVG for valid source
**Files:** create `internal/render/render.go`, `internal/render/render_test.go`.
**Behavior:** `Render(ctx, source, Options) (Result, error)` compiles through
`d2lib.Compile` with a ruler, the resolver from Task 1, a logger in the
context, and `OmitVersion` set; renders with `d2svg.Render`. Returns
`Result.SVG` non-empty, beginning with `<svg`, and `Result.Errors` empty.
- [x] Failing test: `TestRenderReturnsSVGForValidSource` — expected failure:
      `render` package does not exist.
- [x] Implement
- [x] Green: `go test ./internal/render -run TestRenderReturnsSVG`

### Task 3: Errors are data, with usable positions
**Files:** modify `internal/render/render.go`; test in
`internal/render/errors_test.go`.
**Behavior:** Broken source returns `err == nil` and `Result.Errors` populated.
Each error carries `Message`, `From`, `To` (byte offsets) and `Line`
(1-indexed). `Result.SVG` is empty on failure; keeping the previous diagram is
the frontend's job, not Go's.
- [x] Failing test: `TestBrokenSourceReturnsDiagnosticsNotError` — expected
      failure: the current implementation returns D2's error straight through,
      so `err` is non-nil and `Errors` is empty.
- [x] Failing test: `TestDiagnosticLineIsOneIndexed` — asserts the reported
      line is D2's 0-indexed line **plus one**. This is the test that catches
      the off-by-one the spike found in `*d2parser.ParseError`.
- [x] Implement
- [x] Green: `go test ./internal/render -run TestBrokenSource\|TestDiagnostic`

### Task 4: nodeMap
**Files:** modify `internal/render/render.go`; test in
`internal/render/nodemap_test.go`.
**Behavior:** `Result.NodeMap` is `map[string]Span` keyed by SVG element id
(`users`, `web.api`), each `Span` carrying `From`, `To`, `Line`. Built from
`graph.Objects[].AbsID()` and `References[0].Key.Range`.
- [x] Failing test: `TestNodeMapSpansSliceTheSourceIdentifier` — for the
      fixture, `source[span.From:span.To]` equals `"api"` for key `"web.api"`.
      Expected failure: `NodeMap` is nil today. This assertion is chosen
      because it fails if offsets drift by even one byte.
- [x] Failing test: `TestNodeMapCoversEveryRenderedShape` — every
      `diagram.Shapes[].ID` has an entry.
- [x] Implement
- [x] Green: `go test ./internal/render -run TestNodeMap`

### Task 5: Golden files
**Files:** create `internal/render/golden_test.go`,
`testdata/golden/architecture.d2`, `testdata/golden/architecture.svg`,
`testdata/golden/containers.d2`, `testdata/golden/containers.svg`.
**Behavior:** Fixed `.d2` input renders to committed SVG, compared
**byte-for-byte** with no normalisation — the spike measured output stable
across processes with and without a salt, so no scrubbing step is warranted.
`-update` regenerates.
- [x] Failing test: `TestGoldenArchitecture` — expected failure: the `.svg`
      fixtures do not exist, so the read fails.
- [x] Implement harness and generate with `-update`
- [x] **Open each generated SVG and look at it** before committing. A golden
      blessed unseen asserts nothing.
- [x] Green: `go test ./internal/render -run Golden`

### Task 6: Wails service and binding
**Files:** create `internal/app/bindings.go`,
`internal/app/bindings_test.go`; modify `main.go`; delete `greetservice.go`.
**Behavior:** A `RenderService` with one bound method wrapping
`internal/render`. Registered in `main.go` in place of `GreetService`.
Bindings are scaffolding, so this is implement-then-pin per the build loop.
- [x] Implement
- [x] Contract test: `TestResultJSONFieldNames` — marshals a `Result` and
      asserts the keys are exactly `svg`, `errors`, `nodeMap`, with error keys
      `message`, `from`, `to`, `line`. This is what stops a Go rename silently
      breaking the TypeScript side.
- [x] Green: `go test ./internal/app && go vet ./...`

### Task 7: Frontend shell
**Files:** modify `frontend/src/App.svelte`, `frontend/src/main.ts`; delete
`frontend/src/spike`-era leftovers (none expected); regenerate
`frontend/bindings/`.
**Behavior:** Two panes, structural CSS only. The Wails demo screen is
deleted wholesale — which also clears the three standing lint errors recorded
in the build loop's repo-state section.
- [x] Implement
- [x] Green: `cd frontend && npm run check && npm run lint` — **lint must now
      be exit 0**, for the first time in this repo.

### Task 8: Render client — debounce and staleness
**Files:** create `frontend/src/ipc/render.svelte.ts`,
`frontend/src/ipc/render.test.ts`.
**Behavior:** Debounce 250ms after the last keystroke; tag each request with an
incrementing id; drop any response whose id is not the latest; on a response
carrying errors, keep the last good SVG and surface the diagnostics.
- [x] Failing test: `TestDebounceIssuesOneRequestAfterQuiet` — expected
      failure: module does not exist.
- [x] Failing test: `TestStaleResponseIsDropped` — resolve request 2 before
      request 1, assert the state holds request 2's SVG. Names the production
      change that would break it: removing the id comparison.
- [x] Failing test: `TestErrorResponseKeepsLastGoodSVG`
- [x] Implement
- [x] Green: `cd frontend && npm test`

### Task 9: Canvas class
**Files:** create `frontend/src/canvas/canvas.ts`,
`frontend/src/canvas/canvas.test.ts`.
**Behavior:** Plain class. `mount(el)`, `setSVG(string)`, `destroy()`. Owns its
DOM, patches on new render results, holds no reactive state, and is
instantiated once in `onMount`. No per-node Svelte components — the documented
performance trap.
- [x] Failing test: `TestSetSVGReplacesRenderedContent`
- [x] Failing test: `TestDestroyRemovesOwnedDOM`
- [x] Implement
- [x] Green: `cd frontend && npm test`

### Task 10: CodeMirror pane and diagnostics
**Files:** create `frontend/src/editor/source-pane.svelte.ts`; modify
`frontend/src/App.svelte`.
**Behavior:** CodeMirror 6 mounted imperatively in `onMount`, destroyed in the
cleanup return, never passed reactive props. Plain text — **no D2 language
mode in this milestone**. Diagnostics from the render response surfaced through
`@codemirror/lint`, positioned by the byte offsets in `Result.Errors`. Clicking
a diagnostic jumps to its position; the mapping comes from the response, never
from re-parsing in the frontend.
- [x] Failing test: `TestDiagnosticsMapToEditorOffsets` — asserts a diagnostic
      at Go offsets lands on the same characters in the editor document.
- [x] Implement
- [x] Green: `cd frontend && npm test && npm run check && npm run lint`

## Artifacts

Same change as the code:
- **New IPC method** -> create `docs/ipc.md` (the artifact checklist requires
  it; the file does not exist yet).
- **Decisions that close open questions** -> create `docs/decisions.md` with
  dated rows for: nodeMap keyed by SVG id, `OmitVersion` always set, goldens
  compared without normalisation, no D2 language mode in Milestone 1.
- **Repo-state section** of `.claude/skills/build-step/SKILL.md`: milestone
  status, the lint gate going green, D2 becoming a direct requirement (which
  ends the `go mod tidy` trap), first golden count.
- `.claude/plan/roadmap.md`: mark Milestone 1 closed.

## Out of scope

- Any persistence. No file open, save, autosave, or recent-files — Milestone 4.
- Tokens, components, theming, `--z-*` — Milestone 2.
- Engine picker, StatusBar, ErrorList as components — Milestone 3. Diagnostics
  in Milestone 1 appear in the editor gutter only.
- D2 syntax highlighting — Milestone 3.5, before Milestone 5 embeds CodeMirror
  in ProseMirror NodeViews.
- Pan and zoom beyond what the canvas class needs to display an SVG —
  Milestone 3, with the `CanvasControls` chrome that drives them.
- `internal/compile/` and `internal/store/`. `d2lib.Compile` already fuses
  parse, compile and layout, so a separate `compile` package would be an empty
  shell. **Deviation from the anticipated layout in `.ai/rules/index.md`,
  flagged deliberately** — the glob stays registered and unused until there is
  something real to put there.


## Completion record — 2026-09-16

Every box above was ticked in sequence: each test was written first and watched
fail for the stated reason before the implementation existed.

Both goldens were rasterised with `qlmanage` and **viewed**, not merely
generated: `architecture.svg` shows Users (person) into API, API into Cache and
Postgres (cylinders), with the container holding only API and Cache;
`containers.svg` shows Compile → Layout → Render with the `source` edge looping
back and `svg` reaching Canvas. Both match their fixtures.

Review by `spec-reviewer` returned FAIL with two blockers. Both fixed:

1. **Positions were UTF-8 byte offsets consumed as UTF-16 indices.** Fixed with
   `CompileOptions.UTF16Pos`, covered by `TestNodeMapSpansAreUTF16Offsets`,
   which was confirmed to fail without the fix (`source[13:16]` = `"b: "`).
2. **Repo-state left describing the pre-milestone tree.** Rewritten.

Also fixed from the same review: an unhandled promise rejection in the render
client, a canvas cache-before-mount bug that could leave the diagram blank,
`$state.raw` for render results, `--passWithNoTests` dropped, `@wailsio/runtime`
pinned to match the Go side, the native window colour literal removed, and
misleading comments corrected. One finding was rejected: it quoted a
"no hardcoded tunables" rule that CLAUDE.md does not contain.
