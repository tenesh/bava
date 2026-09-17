# Bava

Local-only, open-source diagrams-and-docs desktop app, Apache-2.0. Eraser.io in
spirit: offline, free, file-based.

A free-placement canvas (place, draw and connect anything, anywhere) on which
one kind of element renders itself from D2 code. Not a layout-engine tool with
a visual skin, and not a whiteboard with no structure. Both, with a defined
seam between them. Documents sit alongside, sharing the same file.

Go + Wails v3 + Svelte 5 + Konva, with D2 rendering diagram elements.

## Non-negotiables

These hold in every phase, whatever the pressure.

1. **No service of ours.** Bava has no backend. No accounts with us, no sync,
   no telemetry, no analytics, no crash reporting. Nothing about a user or
   their work reaches anyone operating this project, ever. Network calls happen
   only where the user configured or triggered them: an LLM endpoint they
   chose, local or hosted, with credentials they supplied; and the update
   check, which fetches public release metadata, sends no user data and
   carries no identifier. If a feature would require a server we run, stop and
   raise it.
2. **Files are the source of truth.** Work product (diagrams and documents)
   is plain text on disk that a user can read, edit and diff in any editor,
   and lose nothing if Bava disappears. No database, no proprietary container,
   no hidden state behind their work. Bava's own state (chat transcripts,
   caches, credentials) lives in documented locations outside the project;
   deleting it costs history or convenience, never work. Credentials are the
   one thing Bava writes that a user cannot read: they go to the OS secret
   store, never to a file.
3. **Desktop only.** macOS, Linux, Windows. No mobile, ever. The Wails
   template's `build/android/` and `build/ios/` targets are not part of this
   product: no build script targets them, no code imports them, and they are
   never revived. Whether they are still sitting in the tree is a repo-state
   question; see the repo-state section of `.claude/skills/build-step/SKILL.md`.
4. **Never run git write operations.** No add, commit, push, tag, branch,
   worktree, stash or reset. The user does all git himself, whatever a skill
   instructs. Read-only git (status, diff, log, rev-parse) is fine.

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Shell | Wails v3 (beta, pinned) | `v3/pkg/application` API only; exact tag pinned in `go.mod` |
| Backend | Go 1.27+ | D2 compile, file I/O, AI providers |
| Diagrams | `github.com/d2lang/d2` | pinned in `go.mod`; library, never the CLI; renders `diagram` elements only |
| Canvas | Konva (MIT) | scene graph, hit-testing, transforms; `perfect-freehand`, `perfect-arrows`, `@dagrejs/dagre`, `rbush` |
| Frontend | Svelte 5 + Vite + TypeScript | runes only |
| UI primitives | Ark UI (`@ark-ui/svelte`) | headless; wrapped, never used directly in screens |
| Styling | SCSS → CSS custom properties | no Tailwind, no styled component library |
| Source editor | CodeMirror 6 | D2 source inside a diagram element |
| Doc editor | ProseMirror | Markdown; diagrams as NodeViews |
| Fonts | Geist, Geist Mono (OFL 1.1) | bundled variable woff2; never a system font |
| Licence | Apache-2.0 | `LICENSE`; third-party attribution in `NOTICE` |
| AI | Local endpoints and hosted providers | BYOK or provider login; credentials in the OS secret store; no service we operate |

## Version rules: read before writing any code

This project sits on several recently-changed APIs. Most wrong code here will
be wrong in one of these ways:

- **Wails v3 only.** Never v2 `runtime` package calls. Never the v3 *alpha*
  docs; they are outdated and still online at `v3alpha.wails.io`. The pinned
  version is pinned in `go.mod`, and the vendored reference belongs in
  `docs/wails-v3/`.
- **Svelte 5 runes only.** `$state`, `$derived`, `$effect`, `$props`. Never
  `$:`, never `writable`/`readable` stores, never `export let`.
- **D2's import path is `github.com/d2lang/d2`.** The old
  `oss.terrastruct.com/d2` path is dead. Any example using it predates the
  move and its API will not match.
- **Ark UI's docs default to React examples in places.** Svelte usage differs.
  Read the Svelte tab or query Context7 with `/chakra-ui/ark`. Never port a
  React snippet by hand.
- **Konva examples are mostly React (`react-konva`) or vanilla.** Bava uses it
  from plain TypeScript inside a class, not through a framework wrapper. Read
  the vanilla docs; a `react-konva` snippet does not translate.

When in doubt, look it up rather than recalling it. See Documentation Lookup.

## D2 usage

- **Library only.** Never shell out to a `d2` binary.
- **Every `d2lib.Compile` needs a logger in the context.** Without
  `ctx = d2log.With(ctx, logger)` D2 emits a full stack trace per call.
  Import as `d2log "github.com/d2lang/d2/lib/log"`.
- **TALA is the default layout engine.** dagre and elk are user-selectable
  alternatives, not fallbacks. TALA ignores `direction`, so `direction` is not
  exposed as a control while TALA is active.
- `CompileOptions.FS` is nil unless imports are needed; when they are, root it
  via `lib/localfile`. Never pass an unrooted FS for user-supplied files.
- Leave `MaxVariableExpansion`, `MaxGlobExpansion` and `MaxEdgeExpansion` at
  zero (the secure defaults) unless there is a stated reason.
- Do not read `data-d2-version` from output SVG: it is stale and does not
  track the module version.

Spike timings live in the build loop's repo-state section, not here: they
measure one version on one machine, and a version bump invalidates them.

## Architecture

**Go owns:** compiling D2 into diagram elements, file I/O, and AI provider
calls.
**Frontend owns:** the canvas scene, tools, selection, rendering, and text
editing.

A file holds a document and a canvas, switched between as `Document | Both |
Canvas`. The canvas is a scene where every element carries its own geometry:

```
shape · text · stroke · arrow · frame · group · icon · image · diagram
```

`diagram` is the seam. It holds D2 source inline and renders itself through the
Go pipeline. Outside its bounds the user decides position; inside, the layout
engine does. Full detail in `.claude/work/specs/canvas-architecture.md`.

- One IPC surface for rendering: `Render(source, opts) → {svg, errors,
  nodeMap}`. Every diagram element and every export goes through it. The scene
  itself is never round-tripped through Go.
- `nodeMap` carries both source position **and** node geometry, so an arrow can
  bind to a node inside a diagram and re-anchor on every render.
- **Bindings resolve through D2 node ids, never coordinates.** Ids come from
  source text and survive re-layout; coordinates do not. A binding whose node
  disappears freezes and is marked detached, never silently deleted.
- Debounce 250ms after typing stops. Tag every request with an incrementing
  ID and drop stale responses: out-of-order results cause flicker that is
  hard to diagnose later.
- **The canvas lives outside Svelte reactivity.** It is a plain TypeScript
  class owning a Konva stage, mounted once into a `<div>`. Svelte never renders
  scene elements. Per-element Svelte components are the single most likely
  cause of a sluggish canvas.
- **Text measurement is split.** D2 diagram text is measured in Go via
  `textmeasure`. Canvas text is measured in the frontend (unavoidable, since
  the frontend owns that layout), so fonts are bundled and **measured
  dimensions are stored in the file**, because WebKitGTK and WebView2 disagree
  on glyph advances.
- CodeMirror and ProseMirror are mounted imperatively in `onMount` and
  destroyed in the cleanup return. Never pass reactive props into them.
- Undo is one history. Scene mutations, source edits and AI edits all enter as
  transactions through the same path.
- Shared state lives in `.svelte.ts` modules using runes. No store library.
- No `localStorage`/`IndexedDB` for document state. Per-viewer UI conveniences
  only (last open pane, zoom level, pane visibility), always inside try/catch.
- UI components are presentational: no IPC, no file access, no D2 knowledge
  inside `components/`.

## Testing

- **Golden-file tests are the primary safety net.** Fixed `.d2` input →
  committed expected SVG. They are the only thing that catches a silent layout
  regression, and they are what makes a D2 version bump safe.
- Run them before and after any D2, Wails or font change.
- Go: table-driven tests, `go test ./...`.
- Frontend: `npm run check` and `npm run lint` must be green before done.

## Documentation Lookup

Never guess a versioned API from memory when a source covers it.

- **Context7** for Wails v3, Svelte 5 and runes, Ark UI (`/chakra-ui/ark`),
  CodeMirror 6, ProseMirror, Vite, sass. This stack moves faster than any
  training cutoff. Pass a known library ID straight to the query to skip the
  resolve round trip.
- **gopls MCP** for Go semantics in this repo: definitions, references,
  diagnostics, rename.
- **`docs/`** for vendored references and settled decisions.

If no source covers it, say so and check the library's own repo. Do not invent
an API.

## Where things live

```
docs/                       technical reference, vendored API docs, decisions
.ai/rules/                  committed, glob-scoped rules (index.md maps them)
.claude/plan/               roadmap and milestone breakdown
.claude/work/plans/         per-phase implementation plans
.claude/work/specs/         design specs from brainstorming
.claude/skills/             project skills (build-step is the build loop)
.claude/agents/             spec-reviewer and friends
internal/                   Go: render (D2), store, ai
frontend/src/components/    design system components
frontend/src/styles/        tokens and global styles
frontend/src/canvas/        the Konva scene: elements, tools, bindings
frontend/src/editor/        CodeMirror source pane
frontend/src/docs/          ProseMirror document
frontend/src/ipc/           bindings client: debounce, staleness
frontend/public/fonts/      bundled Geist and Geist Mono
testdata/golden/            golden-file fixtures
```

That is the **target** layout. A directory is created by the milestone that
needs it; `docs/` and `internal/` are deliberately empty until then, and
`.ai/rules/` already gates what may land in each. What exists today is
recorded in the build loop's repo-state section.

Before entering plan mode or creating/editing any file: open
`@.ai/rules/index.md`, read every rule file whose globs cover the paths in
scope, and `grep -rin '<keyword>' .ai/rules` to catch what a path match misses.

## Build loop

All build work follows `.claude/skills/build-step/SKILL.md`. It is
self-contained. Do not invoke other build-discipline skills.

## Commands

| Purpose | Command |
|---|---|
| Dev loop | `wails3 dev` |
| Production build | `wails3 build` |
| Go tests | `go test ./...` |
| Golden tests only | `go test ./internal/render -run Golden` |
| Update goldens | `go test ./internal/render -run Golden -update` |
| Go vet | `go vet ./...` |
| Format | `gofmt -w .` |
| Frontend types | `npm run check` |
| Frontend lint | `npm run lint` |
| Frontend tests | `npm test` |
| Wails env check | `wails3 doctor` |

## Style

- Go: standard `gofmt`. Errors wrapped with context. No panics in library
  code. Exported functions documented.
- Svelte: one component per file. Logic in `.svelte.ts` modules, not in
  markup.
- TypeScript only: no `.js` source files.
- Commits: imperative mood, scoped prefix (`layout:`, `editor:`, `ipc:`,
  `ui:`, `docs:`).

## Documentation files

Only create documentation files when explicitly requested, or when the build
loop's artifact checklist requires one.