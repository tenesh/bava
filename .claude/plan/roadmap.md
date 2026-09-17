# Bava roadmap

Milestones 0–16, including two half-steps (0.5, 3.5) that exist because
something must land before the milestone that depends on it. Each has one goal,
one exit criterion provable by running a
command, and its dependencies. The build loop in
`.claude/skills/build-step/SKILL.md` reads this file to locate the current
milestone; determine it from what exists in the tree, not from what a
previous session claimed.

Sequence is fixed. Two standing orderings come from the rules and cannot be
traded away under schedule pressure:

- **Tokens before components.** `frontend/src/styles/tokens/` exists before
  anything lands in `frontend/src/components/` (`.ai/rules/design-system.md`).
- **Format before persistence.** `docs/file-format.md` specifies a shape
  before any code writes it, with a round-trip test in the same change
  (`.ai/rules/file-format.md`).
- **Nothing is deferred without a destination.** If a milestone pushes work out
  of scope, it names the milestone that picks it up. A deferral with nowhere to
  go is a roadmap bug.

**Re-planned 2026-09-16.** Milestones 2 onward were rebuilt around a
free-placement canvas after the product direction was settled; see
`.claude/work/specs/canvas-architecture.md`.

**Re-planned again 2026-09-17, from Milestone 6.** A diagram is no longer a
live block rendered from D2. D2 *generates* a diagram (from code the user
writes or the AI writes), and the result is converted into ordinary canvas
shapes, arrows and containers that can be moved and edited freely; the D2 is
then discarded. Decisions in `.claude/work/specs/diagrams-as-shapes.md`.
Milestone 1's pipeline survives as the generator: compile, lay out, and hand
the geometry to conversion.

---

## Milestone 0: Scaffold *(complete)*

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

## Milestone 0.5: Toolchain and doc alignment

**Goal:** Make the gates runnable and make every documented fact about the
tree true, before any milestone depends on either.

**Scope, and status as verified on 2026-09-16:**

| Item | Status |
|---|---|
| Skill file named `SKILL.md` | Already correct on disk; the skill loads. No rename was needed, and `git mv` would not have applied: `.claude/` is untracked. |
| Module `github.com/tenesh/bava`, `go 1.27.0` | Already applied in the working tree; toolchain `go1.27.1` confirmed. |
| D2 `v0.9.0` in the module graph | Present, still `// indirect`. Dropped once by `go mod tidy` during the bindings regeneration and re-added; see the trap below. |
| `npm run lint` (ESLint 10 + `eslint-plugin-svelte` 3 + typescript-eslint 8) | Added: `frontend/eslint.config.js`, flat config, `bindings/` and `dist/` ignored. |
| `npm test` (Vitest 5) | Added. No tests yet; Milestone 1 writes the first. |
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
and need committing; until then a `git reset` restores them. Commit this
milestone separately from Milestone 1 so the removal is legible in history,
which is what `.ai/rules/wails.md` describes.

**Trap discovered here:** `wails3 task common:generate:bindings` depends on
`go:mod:tidy`, and tidy drops `github.com/d2lang/d2` because nothing imports
it yet. Re-add with `go get github.com/d2lang/d2@v0.9.0` after any tidy until
Milestone 1's first import makes the requirement direct.

---

## Milestone 1: The spine *(complete)*

**Goal:** Type D2 in a source pane, Go compiles and lays it out, the resulting
SVG appears on screen.

**Role after the 2026-09-16 re-plan:** this pipeline is no longer the whole
app. It renders `diagram` elements placed on the canvas. Everything built here
(the `Render` surface, the debounce and staleness handling, errors-as-data,
`nodeMap`, the golden fixtures) carries forward unchanged into Milestone 6,
which adds node geometry to `nodeMap` and places the result on a stage. The
two-pane shell and the interim `DiagramCanvas` class built here are replaced by
Milestones 3 and 4.

**Scope:** `internal/layout` and `internal/render` on D2
v0.9.0 (library only, logger in every `Compile` context, TALA default, text
measured in Go); the single IPC surface `Render(source, opts) → {svg, errors,
nodeMap}`; CodeMirror 6 mounted imperatively in `onMount`; the canvas as a
plain TS class; 250ms debounce with incrementing request IDs and stale
responses dropped; errors returned as data with the last good SVG left on
screen. Golden fixtures under `testdata/golden/` start here; the `lint` and
`test` scripts they run alongside were added in Milestone 0.5.

No `internal/compile/` package: `d2lib.Compile` already fuses parse, compile
and layout, so it would be an empty shell wrapping one call. Its glob has since
been removed from `.ai/rules/index.md` rather than left registered and unused.

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

**Out of scope:** writes nothing to disk: no save, no autosave, no
`localStorage` for document state. Source lives in memory until Milestone 5.
Unstyled two-pane layout; no `frontend/src/components/` work, because tokens
do not exist yet.

---

## Milestone 2: Design tokens and theming *(complete)*

**Goal:** A semantic token layer plus light/dark theming, so component work can
start without a literal value anywhere.

**Scope:** `frontend/src/styles/tokens/` (`_color`, `_space`, `_type`,
`_radius`, `_elevation`, `_motion`, `_z`), emitted on `:root`, redefined under
`:root[data-theme="dark"]`, with `data-theme` on `<html>`. 13px base, 4px
spacing unit, desktop density. The bundled Geist and Geist Mono faces move into
`_type.scss` as `--font-ui` and `--font-mono`, replacing the interim
declarations in `public/style.css`. `--z-*` must cover portal layers: the Ark
spike measured portalled content painting *below* ordinary app chrome because
Ark ships no z-index of its own.

**Exit criterion:**

```sh
ls frontend/src/styles/tokens/_{color,space,type,radius,elevation,motion,z}.scss \
  && (cd frontend && npm run check && npm run lint && npm run build) \
  && ! grep -rEn '#[0-9a-fA-F]{3,8}|[0-9]+px' frontend/src \
       --include='*.svelte' --include='*.scss' --include='*.ts' \
     | grep -v 'src/styles/tokens/'
```

The grep must find nothing outside `tokens/`. It also clears the two named
debts from Milestone 1: the `13px` base and the `1px` divider.

**Depends on:** Milestone 1.

---

## Milestone 3: App shell *(complete)*

**Goal:** The three-view window: document, canvas, or both, with the chrome
around them.

**Scope:** The `Document | Both | Canvas` switcher. Resizable, collapsible
panes on Ark's Splitter (file tree, main area, dockable AI pane), with pane
visibility and widths kept in `localStorage` inside try/catch. `StatusBar`,
`EmptyState`, `Icon`, and the settings shell whose sections later milestones
fill in. The default window grows from 1000×618 to a size where four regions
are usable.

**Exit criterion:**

```sh
(cd frontend && npm run check && npm run lint && npm test) && go test ./internal/... .
```

green, every new component added to the inventory in
`.ai/rules/design-system.md` in the same change, plus a keyboard pass and a
both-themes check per component.

**Depends on:** Milestone 2.

---

## Milestone 4: Canvas foundation *(complete)*

**Goal:** An infinite canvas you can draw on: place, select, move, group,
undo.

**Scope:** The Konva stage as a plain TypeScript class. Pan and zoom. Tools
with their keyboard shortcuts: select (V), rectangle (R), ellipse (O), arrow
(A), line (L), pen (D), text (T), frame (F). Freehand via `perfect-freehand`.
Selection, multi-select, transform handles, z-order, labelled groups, copy and
paste, and an undo/redo history over scene mutations. The contextual toolbar
that changes with selection.

Canvas text is measured here, in the frontend, and the measurement is stored on
the element, the mitigation `canvas.md` requires now that measurement has left
Go.

**Inherited debt, moved here from Milestone 3 on 2026-09-17:** click-on-node
jump-to-source was wired in Milestone 1 with no keyboard equivalent. Paying it
in Milestone 3 would have meant building selection over the interim canvas this
milestone replaces, so it belongs with the real selection model rather than
being built twice.

**Exit criterion:**

```sh
(cd frontend && npm run check && npm run lint && npm test)
```

green, with tests over the real logic and not the markup: hit-testing, scene
transforms, selection state, and undo/redo returning the scene to a
byte-identical state after an arbitrary sequence of mutations.

**Depends on:** Milestone 3.

**Out of scope:** persistence; the scene lives in memory until Milestone 5.
Diagram elements, connectors and bindings are Milestones 6 and 7.

---

## Milestone 5: File format and persistence *(complete)*

**Goal:** Open and save real files, in a format specified before a byte is
written.

**Scope:** `docs/file-format.md` first, covering the whole shape: a file holds
a document and a scene; every element carries geometry; canvas text carries its
measured dimensions; a `diagram` element carries **D2 source inline, as
readable source**; bindings are stored by node id, never by coordinate; unknown
keys and unknown element types survive a round trip untouched. Then
`internal/format` and `internal/store`, native open/save dialogs, the file
tree on Ark's TreeView, recent files, and the unsaved-changes and
file-changed-on-disk flows.

The two tunables Milestone 1 left as compile-time constants (the 250ms
debounce and the default layout engine) move behind the settings file here.

**Exit criterion:**

```sh
test -f docs/file-format.md \
  && go test ./internal/format ./internal/store -run RoundTrip -v \
  && go test ./internal/... . && go vet ./...
```

with a round trip that covers an unknown element type and an unknown key, and
one proving a scene reopens with identical text layout on a machine that did
not create it.

**Depends on:** Milestone 4. The format spec is an internal gate: no
persistence code merges before it.

---

## Milestone 5.5: Wiring *(complete)*

**Goal:** Make what Milestones 4 and 5 built reachable from the window. Draw on
the canvas; open and save a file. No new capability.

**Why it exists:** both earlier milestones shipped tested logic with no way to
use it. Added 2026-09-17 rather than stacking Milestone 6 on an app nobody could
yet open a file in.

**Exit criterion:**

```sh
go vet ./internal/... . && go test ./internal/... . \
  && (cd frontend && npm run check && npm run lint && npm test)
```

green, plus a hand check that no test replaces: draw, save to a new file, quit,
reopen, and confirm the drawing is intact.

**Depends on:** Milestones 4 and 5.

---

## Milestone 5.6: Chrome *(gated; awaiting the window check; brand deferred)*

**Goal:** A real desktop menu bar in place of title-bar buttons, and autosave.

**Scope:** The native menu declared as data (`internal/app/menu/spec.json`),
grouped for the items later milestones add; one `menu:command` path into the
frontend; the JS keymap stripped of whatever the menu binds; autosave settings
modelled on VS Code, off by default. The brand mark was in scope and is
deferred: the art needs an SVG and a small-size drawing first.

**Exit criterion:**

```sh
go vet ./internal/... . && go test ./internal/... . \
  && (cd frontend && npm run check && npm run lint && npm test)
```

green, plus a hand check at a running window: macOS at least, Windows and
Linux through the CI build and a person where possible: the menu bar appears,
every item does what it says, ⌘Z undoes once in the canvas and once in the
source editor, Copy/Paste work on a canvas selection and in the editor, and
`⌘=` and `⇧⌘]` fire.

**Depends on:** Milestone 5.5.

---

## Milestone 5.7: Brand *(gated; awaiting a human look at the icons and both themes)*

**Goal:** The mark as app icon, in the title bar, the files empty state and
About.

**Art:** vendored in the repo: `frontend/src/brand/panda.svg`, one drawing at
every size (a small-size variant was tried and rejected), and designer-
exported 1024px icon masters per platform beside their outputs in `build/`.
Rules and decisions in `.claude/work/specs/brand.md`.

**Exit criterion:**

```sh
go test ./internal/app -run 'Icon|AssetsCar' \
  && (cd frontend && npm run check && npm run lint && npm test)
```

green, plus a human look at a built app: the icon at 16px and 1024px on
macOS, the title bar and About in both themes. The mark is paper on ink,
always, never the accent.

**Depends on:** Milestone 5.6.

---

## Milestone 5.8: Errors and logs *(gated; awaiting the release-build check)*

**Goal:** When something fails, the user sees what happened and can hand us the
logs, and nothing reaches us unless they send it.

**Why now:** in a release build Wails discards every log line, and a panic
outside a bound method closes the app without a word. Cheaper to fix before
Milestone 6 adds more ways to fail, and every later milestone logs from its
first line. Design: `.claude/work/specs/errors-and-logs.md`.

**Scope:**
- Per-session log files in the platform log folder, with pruning; the same
  logger handed to Wails.
- Frontend errors forwarded to the log.
- A panel-level `<svelte:boundary>`.
- A `PanicHandler` and recover wrappers for our goroutines.
- An unexpected-exit marker and the next-launch notice.
- The "Something went wrong" dialog for unexpected errors.
- Help ▸ Open Logs Folder and Copy Diagnostics. Report Issue… is built but
  hidden until Milestone 16 confirms the public repository.
- Retention: the last 10 sessions, 50 MB total.
- A Verbose logging setting, off by default.
- Webview content-process termination on macOS, with the Windows and Linux
  equivalents checked.

**Exit criterion:**

```sh
go test ./internal/... . && go vet ./internal/... . \
  && (cd frontend && npm run check && npm run lint && npm test)
```

green, including:
- a test that a log from an open–edit–render–save cycle contains none of the
  fixture's content
- a test that a panic in a goroutine is logged and does not exit the process
- a test that a missing clean-exit marker produces the next-launch notice
- a test that pruning keeps the configured number of sessions

Plus a human check at a running release build: force a panic and a frontend
exception, and find both in the log folder.

**Depends on:** Milestone 5.6 (the Help menu).

**Out of scope:** recovering unsaved work after a crash: Milestone 16. Any
automatic upload: never.

---

## Milestone 6: Shapes that look right

**Goal:** Everything drawn on the canvas is visible, styled and selectable,
with the shape set diagrams need.

**Scope:** The rendering the Milestone 5.5 window check found missing: shapes
draw with no stroke or fill, lines and arrows have no points, selection is not
shown, and zoom does not reach the stage. The shape set shared by D2 and
Eraser as canvas shapes and drawing tools: rectangle, ellipse, diamond,
cylinder, hexagon, parallelogram, document, person, cloud. A text label inside
any shape. Per-shape fill, border and text colour from a palette of named
swatches, each resolving to a light and a dark value; the file stores the
swatch name. A selection outline with resize handles, and a way to recolour a
selection. The file format specifies all of it before anything writes it.

**Exit criterion:**

```sh
go test ./internal/format -run RoundTrip && go test ./internal/... . \
  && (cd frontend && npm run check && npm run lint && npm test)
```

green, with tests that inspect the Konva nodes actually created (stroke,
fill, points, label) rather than only the scene data, a round trip of every
shape with label and colours, and a human look at a running window in both
themes.

**Depends on:** Milestone 5.8.

---

## Milestone 6.5: Connections and containers

**Goal:** Arrows that stay attached as things move, and containers that carry
their contents.

**Scope:** An arrow attached to its start and end elements; moving either
re-routes it. Attachment is stored by element id, never coordinates.
Containers (the `frame` element) own the elements inside them: dragging a
container moves its contents, dragging an element out removes it, dropping one
in adds it. Arrow labels.

**Exit criterion:**

```sh
go test ./internal/format -run RoundTrip \
  && (cd frontend && npm run check && npm run lint && npm test)
```

green, with tests that an attached arrow follows its endpoints through a move
and through undo, that moving a container moves its contents in one history
step, and a round trip of attachments and containment.

**Depends on:** Milestone 6.

---

## Milestone 6.6: Diagram from code

**Goal:** Type or paste D2, and it lands on the canvas as free shapes.

**Scope:** Insert ▸ Diagram from code: a dialog with a D2 editor and a live
preview, using the 250ms debounce, stale-response dropping and diagnostics.
**`Render` gains layout geometry**: each node's shape, position, size,
colours, label and container, and each connection's endpoints, route and
label. Conversion, in the frontend, maps that onto canvas elements: D2 shapes
onto the canvas shape set (queue, page, package, step, callout, stored data
and C4 person become rectangles keeping their label), colours onto the nearest
swatch, containers onto frames, connections onto attached arrows. The inserted
diagram is one undoable step. The D2 is not kept. SQL tables, UML classes and
code blocks are deferred to Milestone 15.

**Exit criterion:**

```sh
go test ./internal/... . && go test ./internal/render -run Golden \
  && (cd frontend && npm run check && npm run lint && npm test)
```

green, with a Go test that every node and connection in a layout fixture
appears in the geometry, a frontend test converting that fixture into the
expected elements, and a test that one undo removes an inserted diagram.

**Depends on:** Milestone 6.5, Milestone 1 (the pipeline).

---

## Milestone 7: Snapping and detached arrows

**Goal:** Arrows drawn by hand attach to shapes as naturally as generated ones.

**Scope:** Attachment moved to Milestone 6.5; this milestone is the rest.
Drawing or dragging an arrow end onto a shape snaps and attaches it, with a
visible target. Choosing the side it attaches to. The detached state: when an
attached element is deleted, the arrow stays, freezes at its last position and
is marked detached, never deleted, because the user drew it. Hit-testing at
scale with a spatial index if measured need arrives. Also carried from
Milestone 6: rotation, and stroke width and dash options.

**Exit criterion:**

```sh
(cd frontend && npm run check && npm run lint && npm test)
```

green, with tests that dropping an arrow end on a shape attaches it, that
deleting the shape detaches rather than deletes the arrow, and that undo
restores the attachment.

**Depends on:** Milestone 6.5.

---

## Milestone 8: Documents

**Goal:** Prose alongside the canvas, with parts of the canvas embedded in the
text.

**Scope:** ProseMirror over Markdown, so every document Bava writes opens
cleanly in any editor. Markdown input rules, a slash menu, a selection bubble.
**Embeds of a canvas selection**, decided 2026-09-17: shown as an inline link
or rendered in place, at the user's choice. Editing an embed moves focus to the
canvas with those elements selected; there is no editor inside the document.
Open questions, to settle when this milestone is planned: whether an embed is
the picked elements or a region, live or a snapshot, how it reads in a plain
Markdown viewer, and what it shows when its elements are deleted.

**Exit criterion:**

```sh
go test ./internal/format -run RoundTrip \
  && (cd frontend && npm run check && npm run lint && npm test)
```

green, with tests that activating an embed selects its elements on the canvas,
and a round trip of a document containing an embed.

**Depends on:** Milestone 5, Milestone 6.5.

---

## Milestone 9: Icons and assets

**Goal:** A searchable icon library, plus the user's own.

**Scope:** Bundled Lucide (ISC) for general icons and tech logos from Simple
Icons (CC0) or Devicon (MIT), with a searchable picker. User-imported SVGs as
the "custom icons" category, placed as `icon` elements. D2's `icon:` becomes
an icon element during conversion, resolved from the local library; **a
remote icon URL is never fetched**: D2 code from elsewhere, or from a model,
may name `https://…` icons, and fetching one would phone a CDN. An unresolved
remote icon converts to a placeholder with an explicit one-time fetch offer,
never a silent request.

**Cannot be bundled:** the AWS, Azure and Google Cloud architecture icon sets
are not open-source licensed. They arrive by user import only.

**Exit criterion:**

```sh
go test ./internal/... . \
  && (cd frontend && npm run check && npm run lint && npm test)
```

green, with a test that conversion never produces a remote icon reference,
and every bundled set recorded in `NOTICE`.

**Depends on:** Milestone 6.6.

---

## Milestone 10: Source editor polish

**Goal:** Make writing D2 in the Diagram from code dialog pleasant.

**Scope:** Narrowed 2026-09-17: the dialog is now the only place D2 is edited.
A D2 language mode for CodeMirror (keywords, shape and style keys, edges,
containers, comments, strings) and its keymap. `docs/shortcuts.md` already
exists and gains the dialog's keys.

**Exit criterion:**

```sh
(cd frontend && npm run check && npm run lint && npm test) \
  && test -f docs/shortcuts.md
```

green, with tests over the tokeniser (expected token types at known offsets in
a fixture), not over how it looks.

**Depends on:** Milestone 6.6, Milestone 2 (highlight colours are tokens).

---

## Milestone 11: AI foundation

**Goal:** A chat pane that generates a diagram, with the model's D2 verified
before it is shown.

**Scope:** `internal/ai` against a user-configured **local** endpoint (Ollama,
LM Studio, llama.cpp, LocalAI, all OpenAI-compatible over localhost). The
dockable chat pane, one thread per file covering the document and every
diagram on the canvas, persisted as append-only JSONL in the platform data
directory. Generation, staged visibly: planning, then a placeholder on the
canvas, then the diagram converted into free shapes through Milestone 6.6's
conversion. The compile-and-repair loop: output is compiled in-process,
diagnostics fed back, **capped at two retries**.

**Chat rendering: candidate library, decided 2026-09-17, pending a spike:**
`markstream-svelte` (MIT) renders streamed replies: markdown, highlighted code
blocks, safe HTML, and custom components for tags such as a thinking block. It
is the first choice because one library covers what would otherwise be
`@humanspeak/svelte-markdown` plus Shiki. Unchanged either way: provider calls,
credentials and the repair loop stay in Go; dropdowns, menus and collapsibles
are Ark UI wrapped in `components/`; a D2 block in a reply previews through
`Render`, never Mermaid.

The milestone's first task is a throwaway spike in the real webview. Adopt
only if all four hold:

1. **No network, at all:** streaming a reply with code and math makes zero
   requests. Its code blocks depend on `stream-diffs`, and math and diagrams
   run in web workers; none may fetch from a CDN. A failure here is a
   non-negotiable, not a trade-off.
2. **Themes to our tokens** in both themes. It ships its own `index.css`; if
   that cannot be driven from `--color-*` and friends without fighting it, it
   fails.
3. **Bundle size** measured with Mermaid excluded (~1.5MB, and Bava's diagrams
   are D2), and KaTeX only if math is wanted.
4. **Streaming stays smooth** on a long reply in WKWebView, and the Svelte port
   (marked beta/experimental upstream) is stable enough across a pinned
   version.

**Fallback:** `@humanspeak/svelte-markdown` (MIT, ships no styles, per-element
renderers) with Shiki bundled locally. Rejected outright: Svelte AI Elements
and anything else built on shadcn-svelte, because they bring Tailwind.

**Exit criterion:**

```sh
go test ./internal/ai/... -v && go test ./internal/... . && go vet ./... \
  && (cd frontend && npm run check && npm run lint && npm test)
```

green, including a test that invalid output is repaired rather than shown, that
the retry cap holds, and a transcript round trip. Tests run against a local
stub server, never a live endpoint.

**Depends on:** Milestone 6.6, Milestone 5, Milestone 3.

---

## Milestone 12: AI editing

**Goal:** Select something, ask for a fix, see a diff, accept or reject.

**Scope:** Selection-scoped edits: a ProseMirror range in a document, or a
selection on the canvas, where the model's change arrives as new or modified
elements through conversion. Edits enter as
**transactions** so one undo history survives. The inline edit box is
ephemeral: it shows a diff and vanishes on accept or reject, and is not written
to the transcript.

**Exit criterion:**

```sh
(cd frontend && npm run check && npm run lint && npm test) && go test ./internal/... .
```

green, with tests that a rejected edit leaves the document byte-identical and
that Ctrl+Z after an accepted edit undoes it in one step.

**Depends on:** Milestone 11, Milestone 8.

---

## Milestone 13: Hosted providers

**Goal:** Bring your own key, with the user knowing what leaves the machine.

**Scope:** Hosted providers by API key. Credentials in the OS secret store
(Keychain, Credential Manager, libsecret), never a file. The consent surface
before the first hosted call, stating plainly that a highlighted paragraph
sends the surrounding file. Provider and model pickers in the settings shell.
The error taxonomy: invalid key, rate limit, offline, model unavailable,
context too long.

**Exit criterion:**

```sh
go test ./internal/ai/... -v && go test ./internal/... . \
  && ! grep -rEn 'api\.(openai|anthropic)|generativelanguage' internal/ --include='*.go' \
     | grep -v _test.go | grep -v 'providers\.go'
```

green, with no credential reachable from any file Bava writes, every endpoint
resolved from user configuration, and the consent gate proven to block the
first call until accepted.

**Depends on:** Milestone 11.

---

## Milestone 14: Provider login

**Goal:** Sign in with a provider account, for users on subscription plans
rather than API credit.

**Scope:** OAuth device-code flow, tokens in the OS secret store, refresh,
expiry, and re-authentication when refresh fails. Never a client secret
embedded in a distributed binary.

**Exit criterion:**

```sh
go test ./internal/ai/... -run 'OAuth|Token' -v && go test ./internal/... .
```

green against a stub authorisation server, including expiry and a failed
refresh.

**Depends on:** Milestone 13.

---

## Milestone 15: Export and search

**Goal:** Get work out of Bava, and find things across a workspace.

**Scope:** Export a canvas, a selection or a document to SVG, PNG and PDF, and
copy to clipboard. Diagram elements export **through the existing `Render`
path**, never a second renderer. Workspace search with results, jump-to-match,
and the `EmptyState` the design system already assumes exists for it.

**Carried from Milestone 6:** arbitrary hex colours for shapes, beyond the
swatch palette. Carried from Milestone 6.6: SQL table, UML class and code-block
shapes.

**Exit criterion:**

```sh
go test ./internal/export ./internal/search -v \
  && go test ./internal/... . && go vet ./... \
  && (cd frontend && npm run check && npm run lint && npm test)
```

green, including a test asserting an exported diagram is byte-identical to the
`Render` output for the same source, the regression a second render path would
cause.

**Depends on:** Milestone 8, Milestone 5.

---

## Milestone 16: Release readiness

**Goal:** Everything between "it works on my machine" and "someone else can
install it".

**Scope:** First-run experience (no account, no network): choosing a workspace
folder and a theme. The About screen rendering `NOTICE`, which is a licence
obligation and not decoration. The in-app updater: available, release notes,
downloading, restart to apply, failed. Signature verification before anything
is applied. Auto-check as a setting that genuinely turns off. Packaging for
macOS, Linux and Windows.

**Installer branding, carried from Milestone 5.7:** the DMG's file icon
(`build/darwin/dmg-file-icon.*`) and background (`dmg-background.png`) are
still the Wails template. Either replace them with Bava art or drop them; all
three DMG images are optional in `wails3 tool package`, and the volume icon
already uses `icons.icns`. A test then forbids the template files, as
`internal/app/icons_test.go` does for the app icons. The same applies to the
Windows MSIX tiles, which `wails3 tool msix` fills with Wails placeholders, and
to Linux: deb/rpm install the 1024px `appicon.png` into `hicolor/128x128`.

**Carried from Milestone 5.8:** recovering unsaved work after a crash:
backups kept outside the project, offered at the next launch.
Also: confirm the public issue tracker and un-hide Help ▸ Report Issue….

**Exit criterion:**

```sh
go test ./internal/update/... -v && go test ./internal/... . \
  && gh run list --workflow=ci.yml --limit 1
```

green, with a test pinning the update request's shape (no identifier, no
version in a query parameter, no user data) and a CI matrix result rather than
a local build.

**Depends on:** Milestone 3 (settings shell), and everything it ships.

---

## Cross-cutting, no milestone of its own

- **CI build matrix.** `.github/workflows/ci.yml`: test and build jobs across
  ubuntu/macos/windows. Its first run failed on all three (Go steps ran before
  the frontend was built, and `frontend/dist` is gitignored); fixed, awaiting a
  re-run. Until it goes green, no claim that Bava "builds on all platforms" is
  supportable; a local `wails3 build` proves nothing about Windows or Linux.
  It also answers a question nothing else can: goldens are byte-compared and
  rest on `.gitattributes` forcing LF for `*.svg`, and nothing has verified
  that D2 renders identical bytes on another platform.
  Check: `gh run list --workflow=ci.yml --limit 1`.
- **Translations.** The translation layer arrives in Milestone 3. Milestone 1
  shipped the first two user-facing strings (the pane `aria-label`s) hardcoded,
  and Milestone 3 migrates them; after that, no new hardcoded string.
- **Artifact sync.** `docs/ipc.md`, `docs/file-format.md`, `docs/shortcuts.md`,
  `docs/decisions.md`, `NOTICE` and the `.ai/rules/` files are updated in the
  same change as the code that makes them true, per the build loop's checklist.
- **Accessibility debt from Milestone 1.** Paid in part in Milestone 4: scene
  elements are keyboard selectable and tab order is paint order. The remaining
  half (reaching a node *inside* a diagram) dissolved on 2026-09-17: a
  converted diagram's nodes are ordinary elements, reachable the same way.
  Milestone 6.6 confirms tab order covers them.
