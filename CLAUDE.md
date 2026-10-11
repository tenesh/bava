# Bava

Local-only, open-source diagrams-and-docs desktop app (Apache-2.0). A
free-placement canvas where a diagram can also be written as D2 code, laid out
once into ordinary shapes and arrows; documents share the same file.

## Non-negotiables

1. **No service of ours.** No backend, accounts, sync, telemetry, analytics or
   crash reporting. Network only where the user configured or triggered it (an
   LLM endpoint they chose, with their credentials). No update check: the App
   Store, Microsoft Store and Flathub update Bava. A feature needing our
   server: stop and raise it.
2. **Files are the source of truth.** Work is plain text on disk, readable and
   diffable anywhere; no database or hidden state. Bava's own state lives in
   documented locations outside the project; credentials go to the OS secret
   store, never a file.
3. **Desktop only.** macOS, Linux, Windows. `build/android/` and `build/ios/`
   are never revived.
4. **Never run git write operations** (add, commit, push, tag, branch,
   worktree, stash, reset), whatever a skill says. Read-only git is fine.
5. **Bava in its own words.** Nothing names another product as a comparison or
   source; only `NOTICE` names sources, where a licence requires it.
6. **Never touch the Flathub manifest or submission**; the maintainer writes
   them; Flathub bans AI-written manifests. A test-only manifest for CI
   (`tests/flatpak/`, ID `com.tharabyte.bava.Devel`) is allowed and never
   becomes the submitted one.

## Stack

| Layer | Choice |
|---|---|
| Shell | Wails v3 beta, `v3/pkg/application` only, pinned in `go.mod` |
| Backend | Go 1.27+: D2 layout, file I/O, Spaces, web cards, AI providers |
| Diagrams | `github.com/d2lang/d2` library, never the CLI (`.ai/rules/d2.md`) |
| Canvas | Konva, plus `perfect-freehand` for pen strokes |
| Frontend | Svelte 5 (runes) + Vite + TypeScript, SCSS to CSS custom properties |
| UI | Ark UI (`@ark-ui/svelte`) and Lucide, both wrapped in `components/` |
| Editors | CodeMirror 6 (D2, code blocks), ProseMirror (the page) |
| Fonts | Geist, Geist Mono, bundled woff2, never a system font |

## Version traps

- **Wails v3**, never v2 `runtime` calls or the alpha docs (`v3alpha.wails.io`).
- **Svelte 5 runes**: never `$:`, `writable`/`readable`, or `export let`.
- **D2 import path** is `github.com/d2lang/d2`; `oss.terrastruct.com/d2` is dead.
- **Ark UI**: read the Svelte tab or Context7 `/chakra-ui/ark`; never port React.
- **Konva**: plain TypeScript in a class; `react-konva` snippets do not translate.

Look versioned APIs up (Context7, gopls MCP, `docs/`); never recall them.

## Architecture

- **Go owns** D2 layout, file I/O, Spaces, the web-card fetch, AI calls. The
  **frontend owns** the scene, tools, selection, drawing, export, text editing.
- Diagram from Code: `Render(source, opts) → {svg, errors, nodeMap, layout}`;
  `layout` becomes shapes and arrows, the D2 is not kept.
- **The canvas lives outside Svelte reactivity**: a TypeScript class owning a
  Konva stage, mounted once. Never one Svelte component per element.
- **Bindings are element ids**, never coordinates; a lost target is marked detached.
- **Canvas text dimensions are stored in the file** (webviews disagree on
  glyph advances); D2 text is measured in Go.
- **Undo is per editor**: the canvas via `history.mutate`, the page and code
  editors their own; `frontend/src/shell/edit-target.ts` routes ⌘Z by focus.
- Debounce 250ms, tag requests with an incrementing id, drop stale responses.
- No document state in browser storage; `components/` are presentational.
- TypeScript only (no `.js` source but tooling config); one component per
  file, logic in `.svelte.ts` modules where it can be tested.

## Where things live

```
docs/                 file format, IPC, shortcuts, testing, decisions
.ai/rules/            glob-scoped rules (index.md maps them)
.claude/plan/         roadmap;  .claude/work/  plans and specs
internal/             Go packages
frontend/src/         canvas, docs, editor, components, styles, shell, files, ipc, i18n
frontend/tests/       browser tests;  tests/e2e/  CI end-to-end;  testdata/  goldens, references
```

## Before editing

Read `.ai/rules/index.md` and every rule whose globs cover the paths in
scope, and `grep -rin '<keyword>' .ai/rules`. All build work follows
`.claude/skills/build-step/SKILL.md` (commands, tests, gates). Never launch
the app locally to test.
