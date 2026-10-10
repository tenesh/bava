# Bava

Local-only, open-source diagrams-and-docs desktop app, Apache-2.0. Eraser.io in
spirit: offline, free, file-based.

A free-placement canvas (place, draw and connect anything, anywhere) where a
diagram can also be written as D2 code: Bava lays it out once and turns it
into ordinary shapes and arrows the user then edits freely. Documents sit
alongside, sharing the same file.

Go + Wails v3 + Svelte 5 + Konva, with D2 laying out Diagram from Code.

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
   template's `build/android/` and `build/ios/` targets were removed and are
   never revived.
4. **Never run git write operations.** No add, commit, push, tag, branch,
   worktree, stash or reset. The user does all git himself, whatever a skill
   instructs. Read-only git (status, diff, log, rev-parse) is fine.

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Shell | Wails v3 (beta, pinned) | `v3/pkg/application` API only; exact tag pinned in `go.mod` |
| Backend | Go 1.27+ | D2 layout, file I/O, Spaces, web cards, AI providers |
| Diagrams | `github.com/d2lang/d2` | pinned in `go.mod`; library, never the CLI; lays out Diagram from Code |
| Canvas | Konva (MIT) | scene graph, hit-testing, transforms; `perfect-freehand` for pen strokes |
| Frontend | Svelte 5 + Vite + TypeScript | runes only |
| UI primitives | Ark UI (`@ark-ui/svelte`) | headless; wrapped, never used directly in screens |
| Styling | SCSS → CSS custom properties | no Tailwind, no styled component library |
| Code editor | CodeMirror 6 | D2 in the Diagram from Code dialog; canvas code blocks |
| Doc editor | ProseMirror | the page's Markdown |
| Icons | Lucide (`@lucide/svelte`) | through `components/`, never directly |
| Fonts | Geist, Geist Mono (OFL 1.1) | bundled variable woff2; never a system font |
| Licence | Apache-2.0 | `LICENSE`; third-party attribution in `NOTICE` |
| AI | Local endpoints and hosted providers | BYOK or provider login; credentials in the OS secret store; no service we operate |

## Version rules: read before writing any code

This project sits on several recently-changed APIs. Most wrong code here will
be wrong in one of these ways:

- **Wails v3 only.** Never v2 `runtime` package calls. Never the v3 *alpha*
  docs; they are outdated and still online at `v3alpha.wails.io`. The pinned
  version is pinned in `go.mod`; no reference is vendored, so use Context7.
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

Library only, never a `d2` binary. The rules (the logger every compile needs,
TALA as the default engine, rooted file systems, the expansion limits) are in
`.ai/rules/d2.md`.

## Architecture

**Go owns:** laying out D2, file I/O, Spaces, the web-card fetch, and AI
provider calls.
**Frontend owns:** the canvas scene, tools, selection, drawing, export, and
text editing.

A file holds a document and a canvas, switched between as `Document | Both |
Canvas`. The canvas is a scene where every element carries its own geometry
(`frontend/src/canvas/scene.ts`):

```
shapes · line · arrow · stroke · text · code · frame · group
```

- **Diagram from Code** sends D2 to `Render(source, opts) → {svg, errors,
  nodeMap, layout}`: the SVG is the preview, `layout` is converted into
  ordinary shapes and arrows, and the D2 is not kept. The scene itself is
  never round-tripped through Go; export is drawn in the frontend.
- **Bindings are element ids, never coordinates.** A binding whose target
  disappears freezes and is marked detached, never silently deleted.
- Debounce 250ms after typing stops. Tag every request with an incrementing
  ID and drop stale responses: out-of-order results cause flicker that is
  hard to diagnose later.
- **The canvas lives outside Svelte reactivity.** It is a plain TypeScript
  class owning a Konva stage, mounted once into a `<div>`. Svelte never renders
  scene elements. Per-element Svelte components are the single most likely
  cause of a sluggish canvas.
- **Text measurement is split.** D2 text is measured in Go via `textmeasure`.
  Canvas text is measured in the frontend (unavoidable, since the frontend
  owns that layout), so fonts are bundled and **measured dimensions are
  stored in the file**, because WebKitGTK and WebView2 disagree on glyph
  advances.
- CodeMirror and ProseMirror are mounted imperatively in `onMount` and
  destroyed in the cleanup return. Never pass reactive props into them.
- **Undo is per editor, routed by focus.** The canvas has one history that
  every scene change enters through `history.mutate`; the page and each code
  editor keep their own; `shell/edit-target.ts` sends ⌘Z to whichever holds
  focus.
- Shared state lives in `.svelte.ts` modules using runes. No store library.
- No `localStorage`/`IndexedDB` for document state. Per-viewer UI conveniences
  only (last open pane, zoom level, pane visibility), always inside try/catch.
- UI components are presentational: no IPC, no file access, no D2 knowledge
  inside `components/`.

## Testing

Four layers: unit (Go, Vitest, beside the code) and static checks run on the
host; integration and visual regression run in a real browser, only in
Docker (`npm run browser`); end-to-end runs the real app, only on CI. Never
launch the app locally to test. Golden SVGs guard D2 layout: run them before
and after any D2, Wails or font change. The rules are in
`.ai/rules/testing.md` and `docs/testing.md`.

## Documentation Lookup

Never guess a versioned API from memory when a source covers it.

- **Context7** for Wails v3, Svelte 5 and runes, Ark UI (`/chakra-ui/ark`),
  CodeMirror 6, ProseMirror, Vite, sass. This stack moves faster than any
  training cutoff. Pass a known library ID straight to the query to skip the
  resolve round trip.
- **gopls MCP** for Go semantics in this repo: definitions, references,
  diagnostics, rename.
- **`docs/`** for the file format, IPC, shortcuts, testing and decisions.

If no source covers it, say so and check the library's own repo. Do not invent
an API.

## Where things live

```
docs/                       file format, IPC, shortcuts, testing, decisions
.ai/rules/                  committed, glob-scoped rules (index.md maps them)
.claude/plan/               roadmap
.claude/work/plans/         per-milestone plans, each with an As built
.claude/work/specs/         design specs (research/ for studies of other apps)
.claude/skills/             build-step, the build loop
.claude/agents/             spec-reviewer, auditor, visual-reviewer
internal/                   Go: app (bound services, menus), render and layout
                            (D2), format, space, store, config, logs, web, e2e,
                            testutil (tests only)
frontend/src/canvas/        the Konva scene: elements, tools, bindings, export,
                            import (D2 layout to shapes), code blocks
frontend/src/docs/          the ProseMirror page
frontend/src/editor/        CodeMirror (Diagram from Code)
frontend/src/components/    design system components
frontend/src/styles/        tokens and global styles
frontend/src/shell/         commands, edit routing, status, platform
frontend/src/files/         file actions, autosave, the open page, Spaces, media
frontend/src/settings/      settings screens
frontend/src/ipc/           bindings clients: debounce, staleness
frontend/src/i18n/          user-facing strings (messages.ts)
frontend/src/e2e/           the end-to-end driver (e2e builds only)
frontend/tests/             browser tests: visual/, integration/, harness/, fixtures/
frontend/public/fonts/      bundled Geist and Geist Mono
tests/e2e/                  end-to-end scenarios run on CI
testdata/                   golden SVGs, screenshot references, input fixtures
```

Before entering plan mode or creating/editing any file: open
`@.ai/rules/index.md`, read every rule file whose globs cover the paths in
scope, and `grep -rin '<keyword>' .ai/rules` to catch what a path match misses.

## Build loop

All build work follows `.claude/skills/build-step/SKILL.md`. It is
self-contained. Do not invoke other build-discipline skills.

## Commands

The full table is in `.claude/skills/build-step/SKILL.md`. Go commands are
scoped to `./internal/... .` (`frontend/node_modules` ships a Go package).

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