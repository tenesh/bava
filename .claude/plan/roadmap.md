# Bava roadmap

Milestones 0–7, including three half-steps (0.5, 3.5) that exist because
something must land before the milestone that depends on it. Each has one goal,
one exit criterion provable by running a
command, and its dependencies. The build loop in
`.claude/skills/build-step/SKILL.md` reads this file to locate the current
milestone — determine it from what exists in the tree, not from what a
previous session claimed.

Sequence is fixed. Two standing orderings come from the rules and cannot be
traded away under schedule pressure:

- **Tokens before components.** `frontend/src/styles/tokens/` exists before
  anything lands in `frontend/src/components/` (`.ai/rules/design-system.md`).
- **Format before persistence.** `docs/file-format.md` specifies a shape
  before any code writes it, with a round-trip test in the same change
  (`.ai/rules/file-format.md`).

---

## Milestone 0 — Scaffold *(complete)*

**Goal:** Wails v3 + Svelte 5 + TypeScript shell that builds and runs on the
dev machine.

**Exit criterion:**

```sh
wails3 doctor && go vet ./... && (cd frontend && npm ci && npm run build)
```

**Depends on:** nothing.

**Note:** `go build ./...` was excluded here while the mobile targets broke
the link step; they are gone as of Milestone 0.5, and the criterion above can
be tightened to include it once that removal is committed.

---

## Milestone 0.5 — Toolchain and doc alignment

**Goal:** Make the gates runnable and make every documented fact about the
tree true, before any milestone depends on either.

**Scope, and status as verified on 2026-09-16:**

| Item | Status |
|---|---|
| Skill file named `SKILL.md` | Already correct on disk; the skill loads. No rename was needed, and `git mv` would not have applied — `.claude/` is untracked. |
| Module `github.com/tenesh/bava`, `go 1.27.0` | Already applied in the working tree; toolchain `go1.27.1` confirmed. |
| D2 `v0.9.0` in the module graph | Present, still `// indirect`. Dropped once by `go mod tidy` during the bindings regeneration and re-added — see the trap below. |
| `npm run lint` — ESLint 10 + `eslint-plugin-svelte` 3 + typescript-eslint 8 | Added: `frontend/eslint.config.js`, flat config, `bindings/` and `dist/` ignored. |
| `npm test` — Vitest 5 | Added. No tests yet; Milestone 1 writes the first. |
| CLAUDE.md states intent only | Done: version pins now point at `go.mod`, spike timings and tree inventory moved to the build loop's repo-state section. |
| Mobile targets removed | Done: `git rm -r build/android build/ios` (46 files, staged and awaiting your commit), plus their references in `Taskfile.yml`, `build/Taskfile.yml`, `.gitignore` and `build/config.yml`. `go build ./...` passes again. |
| Bindings match the module path | Done: regenerated to `frontend/bindings/github.com/tenesh/bava/`, stale `changeme/` removed, `src/App.svelte` import updated. |

**Exit criterion:**

```sh
go vet ./... && go build ./... && go test ./... \
  && ! test -e build/android && ! test -e build/ios \
  && (cd frontend && npm run check && npm run lint)
```

Verified 2026-09-16: everything above passes except `npm run lint`, which
still reports three errors, all inside the Wails demo screen `src/App.svelte`
(one `any`, two direct DOM manipulations). Milestone 1 deletes that screen, so
the gate goes green there rather than by editing code already scheduled for
removal. Recorded in the build loop's repo-state section; it does not block
Milestone 1 starting.

**Depends on:** Milestone 0.

**Requires the user:** the 46 mobile-target deletions are staged in the index
and need committing — until then a `git reset` restores them. Commit this
milestone separately from Milestone 1 so the removal is legible in history,
which is what `.ai/rules/wails.md` describes.

**Trap discovered here:** `wails3 task common:generate:bindings` depends on
`go:mod:tidy`, and tidy drops `github.com/d2lang/d2` because nothing imports
it yet. Re-add with `go get github.com/d2lang/d2@v0.9.0` after any tidy until
Milestone 1's first import makes the requirement direct.

---

## Milestone 1 — The spine *(complete)*

**Goal:** Type D2 in a source pane, Go compiles and lays it out, the resulting
SVG appears on the canvas.

**Scope:** `internal/layout` and `internal/render` on D2
v0.9.0 (library only, logger in every `Compile` context, TALA default, text
measured in Go); the single IPC surface `Render(source, opts) → {svg, errors,
nodeMap}`; CodeMirror 6 mounted imperatively in `onMount`; the canvas as a
plain TS class; 250ms debounce with incrementing request IDs and stale
responses dropped; errors returned as data with the last good SVG left on
screen. Golden fixtures under `testdata/golden/` start here; the `lint` and
`test` scripts they run alongside were added in Milestone 0.5.

No `internal/compile/` package: `d2lib.Compile` already fuses parse, compile
and layout, so it would be an empty shell wrapping one call. The glob stays
registered in `.ai/rules/index.md`, unused, until there is something real for
it. Deliberate deviation from the layout that file anticipates.

**Exit criterion:**

```sh
go vet ./... && go build ./... && go test ./internal/... . \
  && go test ./internal/render -run Golden \
  && (cd frontend && npm run check && npm run lint && npm test)
```

green, with at least one committed golden SVG reviewed by eye, and frontend
tests covering debounce and stale-response dropping.

**Depends on:** Milestone 0.5 (the lint and test gates must exist before the
first test is written; nothing else in 0.5 blocks it).

**Also closes:** deleting the Wails demo screen `src/App.svelte` clears the
three standing lint errors, and the first `internal/` package makes the D2
requirement direct so `go mod tidy` stops dropping it.

**Out of scope:** writes nothing to disk — no save, no autosave, no
`localStorage` for document state. Source lives in memory until Milestone 4.
Unstyled two-pane layout; no `frontend/src/components/` work, because tokens
do not exist yet.

---

## Milestone 2 — Design tokens and theming

**Goal:** Semantic token layer plus light/dark theming, so component work can
start without a literal value anywhere.

**Scope:** `frontend/src/styles/tokens/` — `_color`, `_space`, `_type`,
`_radius`, `_elevation`, `_motion`, `_z` — emitted on `:root`, redefined under
`:root[data-theme="dark"]`, with `data-theme` set on `<html>`. 13px base, 4px
spacing unit, desktop density. Bundled fonts via `@font-face`. The Go-side
theme mapping that feeds the active theme's colours into `Render` options, and
the single portal root for Ark's portalled content.

**Exit criterion:**

```sh
ls frontend/src/styles/tokens/_{color,space,type,radius,elevation,motion,z}.scss \
  && (cd frontend && npm run check && npm run lint && npm run build) \
  && ! grep -rEn '#[0-9a-fA-F]{3,8}|[0-9]+px' frontend/src \
       --include='*.svelte' --include='*.scss' --include='*.ts' \
     | grep -v 'src/styles/tokens/'
```

The grep must find nothing outside `tokens/`: a hit means a literal escaped,
which is the failure this milestone exists to prevent. Plus a dark-theme
golden proving the canvas re-renders on theme change rather than lagging the
chrome.

**Depends on:** Milestone 1 (there must be a canvas and chrome to theme, and
the Go theme mapping attaches to the existing `Render` options struct).

---

## Milestone 3 — App shell

**Goal:** The spine dressed as a real tool window: resizable panes, status bar,
error list with click-to-jump, canvas controls.

**Scope:** Wrapped Ark primitives (Splitter for panes; check it before hand-
rolling), and the in-house `StatusBar`, `CanvasControls`, `ErrorList`,
`EmptyState`, `Icon`. D2 diagnostics surfaced through `@codemirror/lint` and
`ErrorList`, with jump-to-line driven by the `nodeMap` from the render
response, never by re-parsing in the frontend. Engine picker (TALA default,
dagre and elk as alternatives; `direction` stays unexposed while TALA is
active). **Canvas pan and zoom interaction lands here too** — `CanvasControls`
is the chrome, and the behaviour it drives belongs in the same milestone
rather than being assumed to exist.

Ark portals were verified by spike on 2026-09-16 (see the build loop's
repo-state section): they portal correctly inside the Wails webview, but Ark
ships **no z-index of its own** and portalled content painted below ordinary
app chrome. The `--z-*` tokens from Milestone 2 must cover portal layers, and
this milestone is where that gets exercised for real.

**Exit criterion:**

```sh
(cd frontend && npm run check && npm run lint && npm test) && go test ./...
```

green, every new component added to the inventory table in
`.ai/rules/design-system.md` in the same change, and a recorded keyboard pass
(tab order, escape, arrow keys) plus both-theme check per component.

**Also inherits from Milestone 1:** click-on-node jump-to-source was wired
without a keyboard equivalent or focus ring, because `--color-focus-ring`
cannot exist before Milestone 2. This milestone owes it a keyboard path.

**Depends on:** Milestone 2 (tokens), Milestone 1 (`nodeMap`, errors).

---

## Milestone 3.5 — Source editor

**Goal:** Make the D2 source pane a real editor: syntax highlighting, a proper
keymap, and the shortcuts written down.

**Scope:** A D2 language mode for CodeMirror 6 (keywords, shape and style
keys, edges, containers, comments, strings), the editor keymap, and
`docs/shortcuts.md` created in the same change. Milestone 1 deliberately
shipped a plain-text pane; this is where that debt is paid.

**Exit criterion:**

```sh
(cd frontend && npm run check && npm run lint && npm test) \
  && test -f docs/shortcuts.md
```

green, with tests over the tokeniser — given a `.d2` fixture, the expected
token types at known offsets — not over how it looks.

**Depends on:** Milestone 1 (the pane exists), Milestone 2 (highlight colours
are tokens, never literals).

**Why here and not later:** Milestone 5 mounts CodeMirror inside ProseMirror
NodeViews. Doing the language mode first means the embedded editors inherit it
instead of needing a second pass.

---

## Milestone 4 — File format and persistence

**Goal:** Open, edit and save real files on disk, in a format specified before
a single byte is written.

**Scope:** `docs/file-format.md` first — plain text, forward-compatible,
unknown keys and unknown block types preserved on read and written back
unchanged. Then `internal/format` (parse/serialise) and `internal/store`
(file I/O), Wails native open/save dialogs, and the file sidebar on Ark's
TreeView, plus a recent-files list. The two tunables Milestone 1 left as
compile-time constants — the 250ms debounce and the default layout engine —
move behind this settings file. `localStorage` is permitted here only for
per-viewer conveniences — last open pane, zoom level, the recents list itself
— always inside try/catch, and never for document content.

**Exit criterion:**

```sh
test -f docs/file-format.md \
  && go test ./internal/format ./internal/store -run RoundTrip -v \
  && go test ./... && go vet ./...
```

with a round-trip test (write → read → compare, not separate writer and reader
tests) and a case proving unknown keys and unknown block types survive a
round trip.

**Depends on:** Milestone 3 (sidebar and dialogs need the component layer),
Milestone 1 (source pane). `docs/file-format.md` is an internal gate: no
persistence code before it merges.

---

## Milestone 5 — Documents with embedded diagrams

**Goal:** ProseMirror document mode where a diagram is a node type whose
NodeView hosts CodeMirror plus the rendered SVG.

**Scope:** The three non-obvious seams from ProseMirror's own embedded
code-editor example — escaping the inner editor with arrow keys, one undo
history across the boundary (CodeMirror changes forwarded as ProseMirror
transactions), and focus tracking so menus reflect the active editor. Document
blocks and the diagram block go into `docs/file-format.md` before they are
written. Budget real time here; plausible-looking wrong implementations are
easy to produce.

**Exit criterion:**

```sh
test -f docs/file-format.md \
  && go test ./internal/format -run RoundTrip \
  && (cd frontend && npm run check && npm run lint && npm test)
```

green, with frontend tests covering cursor escape, cross-boundary undo, and
focus tracking, and a round-trip test for a document containing a diagram
block.

**Depends on:** Milestone 4 (document format on disk), Milestone 1 (render
pipeline reused unchanged — no second render path).

---

## Milestone 6 — Local AI assist

**Goal:** Optional D2 generation and editing through a user-configured local
Ollama endpoint, off by default.

**Scope:** `internal/ai` talking to a user-supplied local endpoint only. No
hosted provider, no default remote URL, no key handling, no fallback to a
hosted model when the local one is absent — absent means the feature is off.
Tests run against a local stub server, never a live endpoint.

**Exit criterion:**

```sh
go test ./internal/ai/... -v && go test ./... && go vet ./... \
  && ! grep -rEn 'https?://' internal/ frontend/src/ \
       --include='*.go' --include='*.ts' --include='*.svelte' \
     | grep -vE '://(localhost|127\.0\.0\.1|\[::1\])'
```

green, with the grep finding no non-local endpoint anywhere in shipped code,
and the feature verified disabled with no endpoint configured.

**Depends on:** Milestone 5 (the doc and diagram surfaces it edits),
Milestone 1 (it produces D2 source, which the existing pipeline renders).

---

## Milestone 7 — Export and search

**Goal:** Get diagrams out of Bava, and find things across a workspace.

**Scope:** Export a diagram or document to SVG and PNG, and copy-to-clipboard
— **through the existing `Render` path**, never a second renderer, so exported
output is byte-identical to what the user saw (`.ai/rules/ipc.md`). Workspace
search across files with results, jump-to-match, and the `EmptyState` the
design system already assumes exists for it.

**Exit criterion:**

```sh
go test ./internal/export ./internal/search -v \
  && go test ./... && go vet ./... \
  && (cd frontend && npm run check && npm run lint && npm test)
```

green, including a test asserting an exported SVG is byte-identical to the
`Render` output for the same source — the regression that a second render path
would cause.

**Depends on:** Milestone 4 (a workspace of files to search), Milestone 5
(documents are exportable too), Milestone 1 (the one render path).

**Ordering note:** Export is arguably more fundamental to a diagrams tool than
local AI. If you want it before Milestone 6, swap the two — nothing in either
depends on the other.

---

## Cross-cutting, no milestone of its own

- **CI build matrix.** There is none. Until it exists, no claim that Bava
  "builds on all platforms" is supportable — a local `wails3 build` proves
  nothing about Windows or Linux. Goldens are byte-compared and depend on
  `.gitattributes` forcing LF, so CI should land no later than Milestone 2.
  Check: `gh run list --workflow=ci.yml --limit 1`.
- **Translations.** The translation layer arrives in Milestone 3. Milestone 1
  shipped the first two user-facing strings (the pane `aria-label`s) hardcoded,
  and Milestone 3 migrates them; after that, no new hardcoded string. Stated
  this way because the earlier wording — "from the first string" — was already
  contradicted by the milestone that shipped the first string.
- **Artifact sync.** `docs/ipc.md`, `docs/shortcuts.md`, `docs/decisions.md`
  and the `.ai/rules/` files are updated in the same change as the code that
  makes them true, per the build loop's checklist. `docs/shortcuts.md` is
  created in Milestone 3.5; `docs/ipc.md` and `docs/decisions.md` in
  Milestone 1.
- **Nothing else is homeless.** Every item a milestone pushes out of scope now
  names the milestone that picks it up. If a future milestone defers something
  without naming its destination, that is a roadmap bug — say so rather than
  letting it fall off the end.
