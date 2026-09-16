# Bava

Local-only, open-source diagrams-and-docs desktop app. Eraser.io in spirit:
offline, free, file-based. Go + Wails v3 + Svelte 5, with D2 as the diagram
engine.

## Non-negotiables

These hold in every phase, whatever the pressure.

1. **No cloud.** No accounts, auth, sync, telemetry, analytics, crash
   reporting, or update pings. The only permitted network call is to a
   user-configured local LLM endpoint. If a task appears to need a server,
   stop and raise it.
2. **Files are the source of truth.** Plain text on disk. No database, no
   proprietary container, no hidden state. A user must be able to read and
   edit everything Bava writes in any editor, and lose nothing if Bava
   disappears.
3. **Desktop only.** macOS, Linux, Windows. No mobile, ever. The Wails
   template's `build/android/` and `build/ios/` targets are not part of this
   product: no build script targets them, no code imports them, and they are
   never revived. Whether they are still sitting in the tree is a repo-state
   question — see the repo-state section of `.claude/skills/build-step/SKILL.md`.
4. **Never run git write operations.** No add, commit, push, tag, branch,
   worktree, stash or reset. The user does all git himself, whatever a skill
   instructs. Read-only git (status, diff, log, rev-parse) is fine.

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Shell | Wails v3 (beta, pinned) | `v3/pkg/application` API only; exact tag pinned in `go.mod` |
| Backend | Go 1.27+ | parse, layout, render, file I/O |
| Diagrams | `github.com/d2lang/d2` | pinned in `go.mod`; library, never the CLI |
| Frontend | Svelte 5 + Vite + TypeScript | runes only |
| UI primitives | Ark UI (`@ark-ui/svelte`) | headless; wrapped, never used directly in screens |
| Styling | SCSS → CSS custom properties | no Tailwind, no styled component library |
| Source editor | CodeMirror 6 | D2 pane |
| Doc editor | ProseMirror | diagrams as NodeViews |
| AI | Ollama (local, optional) | never a hosted provider |

## Version rules — read before writing any code

This project sits on several recently-changed APIs. Most wrong code here will
be wrong in one of these ways:

- **Wails v3 only.** Never v2 `runtime` package calls. Never the v3 *alpha*
  docs — they are outdated and still online at `v3alpha.wails.io`. The pinned
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
- Do not read `data-d2-version` from output SVG — it is stale and does not
  track the module version.

Spike timings live in the build loop's repo-state section, not here: they
measure one version on one machine, and a version bump invalidates them.

## Architecture

**Go owns:** parse → layout → render → SVG string, plus file I/O.
**Frontend owns:** display, pan/zoom, selection, text editing.

- One IPC surface: `Render(source, opts) → {svg, errors, nodeMap}`. Resist
  growing a second render path.
- Debounce 250ms after typing stops. Tag every request with an incrementing
  ID and drop stale responses — out-of-order results cause flicker that is
  hard to diagnose later.
- **Diagram rendering lives outside Svelte reactivity.** The canvas is a plain
  TypeScript class mounted once into a `<div>`; it owns its own DOM and
  patches itself. Svelte never re-renders diagram nodes. Per-node Svelte
  components are the single most likely cause of a sluggish canvas.
- **All text measurement happens in Go** via `textmeasure`. Measuring in the
  webview makes layout differ between platforms, because WebKitGTK and
  WebView2 disagree on glyph advances.
- CodeMirror and ProseMirror are mounted imperatively in `onMount` and
  destroyed in the cleanup return. Never pass reactive props into them.
- Shared state lives in `.svelte.ts` modules using runes. No store library.
- No `localStorage`/`IndexedDB` for document state. Per-viewer UI conveniences
  only (last open pane, zoom level), always inside try/catch.
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
internal/                   Go: compile, layout, render, store
frontend/src/components/    design system components
frontend/src/styles/        tokens and global styles
frontend/src/canvas/        the diagram canvas class
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
- TypeScript only — no `.js` source files.
- Commits: imperative mood, scoped prefix (`layout:`, `editor:`, `ipc:`,
  `ui:`, `docs:`).

## Documentation files

Only create documentation files when explicitly requested, or when the build
loop's artifact checklist requires one.