---
name: build-step
description: The complete build process for Bava. Activate for any implementation work in this repo, named milestone or not.
---

# Build step

The complete build process for Bava. Self-contained: do not invoke other
build-discipline skills. The build follows `.claude/plan/roadmap.md`; never
skip a gate, and never reorder the sequence except where that file says a
milestone is independent.

## Non-negotiables

1. **NO BEHAVIOR CODE WITHOUT A FAILING TEST FIRST**
2. **NO FIX WITHOUT ROOT CAUSE INVESTIGATION FIRST**
3. **NO COMPLETION CLAIM WITHOUT FRESH VERIFICATION OUTPUT**
4. **NO CLOUD.** Any task that seems to need a server, account, or remote call
   is a spec problem. Stop and raise it.

And one standing constraint: **never run git write operations.** No add,
commit, push, tag, branch, worktree, stash or reset. The user does all git
himself. Read-only git (status, diff, log, rev-parse) is fine.

## The loop

1. **Locate the milestone.** Read `.claude/plan/roadmap.md`; determine the
   current milestone from what actually exists in the tree, not from what the
   last session claimed. If ambiguous, ask; never guess which is next.
2. **Read the specs.** Every spec the milestone lists, plus the relevant file
   in `docs/`. The docs are the spec: if one seems wrong, incomplete or
   self-contradictory, stop and raise it. Never improvise around a spec, and
   never let code silently become the new source of truth.
3. **Resolve holes.** If a spec genuinely does not decide something, work it
   out with the user before planning and write the outcome to
   `.claude/work/specs/<topic>.md`. One question at a time, decisions recorded
   as they are made. This is for holes, not for re-opening settled decisions.
4. **File-format check.** If the milestone changes what Bava writes to disk
   (new frontmatter key, new block type, new sidecar file), the format change
   is specified in `docs/file-format.md` *before* the code that writes it, and
   a round-trip test exists. The format is the product's long-term contract
   with its users; it is the one thing that cannot be quietly refactored.
5. **UI check.** If the milestone adds UI, confirm against
   `.ai/rules/design-system.md`: does a component already exist, does Ark UI
   provide the primitive, do the tokens it needs exist. New tokens are added
   to `frontend/src/styles/tokens/` before the component that uses them.
6. **Plan and get approval.** Write `.claude/work/plans/<NN>-<name>.md` in the
   format below. Present it and wait for explicit approval. No implementation
   before approval: not "just the scaffolding", not "just the types".
7. **Implement.** Task by task in plan order, test-driven per the table below.
   Run the affected tests after each task, not just at the end.
8. **Sync artifacts.** The checklist below, in the same change as the code.
9. **Gates.** `go vet`, `go test ./...`, `npm run check`, `npm run lint`,
   `npm test`: all green, with output shown. See the gate-status table in
   repo state for any gate currently known-red and why.
10. **Review.** Dispatch the `spec-reviewer` agent on the working-tree diff.
    Verify each finding before acting on it. Do not implement a finding you
    believe is wrong: say so with reasoning.
11. **Report.** What shipped, files touched, test counts, and every deviation
    from spec flagged loudly. Then stop; the user commits.

## Commands

| Purpose | Command |
|---|---|
| Affected Go tests | `go test ./internal/<pkg> -run <Name>` |
| Full Go suite | `go test ./...` |
| Golden tests | `go test ./internal/render -run Golden` |
| Regenerate goldens | `go test ./internal/render -run Golden -update` |
| Vet | `go vet ./...` |
| Format | `gofmt -w .` |
| Svelte types | `npm run check` |
| JS/TS lint | `npm run lint` |
| Frontend tests | `npm test` |
| Dev loop | `wails3 dev` |
| Env check | `wails3 doctor` |

## What gets a failing test first

Rule 1 applies to behavior. It does not apply to declarative scaffolding,
where a red-first cycle proves nothing.

| Kind of work | Approach |
|---|---|
| Compile/layout/render pipeline, file I/O, IPC handlers, parsing | Failing Go test first. Write it from the spec, watch it fail, then implement. |
| File format: reading, writing, round-tripping | Failing test first, always. Format bugs corrupt user data silently and are unrecoverable once shipped. |
| Diagram output | Golden file. Add the fixture, watch it fail, implement, then review the generated SVG **by eye** before committing the golden. A golden blessed without looking at it asserts nothing. |
| Wails bindings, config, build scripts | Implement, then a contract test pinning the outcome. |
| Design system components | Build against `.ai/rules/design-system.md`. Verify with `npm run check` and `npm run lint`, plus a manual keyboard pass (tab order, escape, arrow keys) before done. |
| Canvas interaction, editor wiring | Tests where real logic exists: coordinate math, staleness handling, debounce, selection state. Not for markup. |

Test quality: one behavior per test, named for the behavior. Before writing a
test, name the production change that would make it fail; if you cannot, the
test asserts nothing.

## Plan format

```markdown
# <NN>: <Name>

**Goal:** one sentence.
**Specs:** every doc this plan was built from, with paths.
**File format impact:** what changes on disk, or "none".
**UI impact:** components reused, components added, tokens added, or "none".

## Constraints
Project-wide rules this milestone must respect, values copied verbatim from
the specs (debounce ms, default engine, pinned versions, IPC shape, token
names).

## Tasks

### Task N: <name>
**Files:** create / modify / test: exact paths.
**Behavior:** what it must do, from the spec.
- [ ] Failing test: <name>; expected failure: <what and why>
- [ ] Implement
- [ ] Green: `<exact command>`

## Artifacts
Which sync-checklist items this milestone touches.

## Out of scope
What a reader might expect here but belongs later.
```

No placeholders, no "TBD". Before presenting, re-read for contradictions,
vague requirements, and anything a fresh implementer could read two ways.

## Debugging

When a test fails for a non-obvious reason, or a fix does not hold, stop
patching and work the phases in order.

| Phase | Do | Done when |
|---|---|---|
| 1. Root cause | Read the full error and stack. Reproduce reliably. Check what changed. | You can state what happens and why |
| 2. Pattern | Find working equivalents in this codebase. Read the reference implementation completely, not skimmed. List every difference. | The differences are enumerated |
| 3. Hypothesis | State the cause as one testable claim. Change one thing. | Confirmed, or a new hypothesis |
| 4. Fix | Write the failing test that captures the bug, then fix the cause, not the symptom. | Test green, original symptom gone |

After three failed fixes, stop fixing: the architecture or your model of it is
wrong. Say so rather than attempting a fourth.

**Known false trails in this repo:** check these before deep investigation:

- Stack traces from `d2lib.Compile` usually mean a missing logger in the
  context, not a compile error. Add `d2log.With`.
- **D2 missing from `go.mod`** means a `go mod tidy` ran, not a broken module
  cache. Until something in `internal/` imports it, the requirement is
  indirect and does not survive tidy, and the bindings task depends on tidy.
  Re-add with `go get github.com/d2lang/d2@v0.9.0`.
- A stale or flickering diagram is usually an out-of-order IPC response, not a
  layout bug. Check the request ID.
- A Svelte "reactivity not working" symptom in canvas code usually means
  reactivity is being used where it should not be. Re-read the architecture
  rule before adding a `$derived`.
- Layout differing between machines means text measurement leaked into the
  frontend. All measurement happens in Go via `textmeasure`.
- Canvas pointer handling that stops working usually means a modal is open:
  Ark's modal Dialog sets `pointer-events: none` on `body`. Check before
  investigating the canvas.
- A dialog, popover or tooltip positioned wrongly is usually portal target or
  stacking context, not an Ark UI bug. Check `--z-*` tokens and the portal
  root before filing anything upstream.
- A component that looks wrong in dark mode almost always contains a literal
  colour. Grep it for hex codes before debugging the theme.

**A measurement that confirms what you expected is the one to re-check.** The
Ark spike produced two confident false results in a row because the probe was
skipped by hit-testing, first for `pointer-events: none` on the probe itself,
then for the modal's override on `body`. If a hit-test, visibility check or
stacking assertion agrees with your hypothesis on the first try, verify the
instrument before believing the reading.

## The verification gate

Before any claim of done, passing, fixed or working:

1. Identify the command that proves the claim.
2. Run it fresh and in full: not a subset, not a remembered earlier run.
3. Read the whole output, including exit code and failure count.
4. If it does not confirm the claim, state the real status with the evidence.

| Claim | Requires |
|---|---|
| Tests pass | `go test ./...` output in this session, 0 failures; for `npm test`, the **exit code**, not the passed count |
| Goldens clean | Golden run output, and the SVG diff reviewed by eye if any changed |
| Types clean | `npm run check` output |
| Lint clean | `npm run lint` output |
| Bug fixed | The original failing test, now green |
| Component done | Keyboard pass performed, both themes checked |
| Spike cleaned up | Restored state **shown** to match, not asserted: diff the touched files against their pre-spike state, confirm the dependency is gone from `package.json`, the lockfile *and* `node_modules`, and check the bundle size returned to baseline. A backup taken after an install restores the install. |
| Visual behaviour verified | Seen by a human in a running window. Geometry and DOM measurements from inside the webview are evidence about layout, not about appearance. |
| Builds on all platforms | CI matrix result, not a local `wails3 build` |
| Subagent finished | The diff, read, not the agent's own success report |

A local build proving nothing about Windows or Linux is the most common false
claim in this repo. Cross-platform claims need CI.

## Artifact sync checklist

Same change as the code, every time:

- File format changed → `docs/file-format.md`, plus a round-trip test
- New IPC method or changed signature → `docs/ipc.md`
- New design system component → inventory table in
  `.ai/rules/design-system.md`
- New colour token used by the diagram → matching Go-side theme mapping in the
  same change
- D2 / Wails / Svelte / Ark version bump → golden tests re-run and diffs
  reviewed by eye; version updated in this file's repo-state section
- New keyboard shortcut → `docs/shortcuts.md`
- New user-facing string → translation file, never hardcoded
- New durable convention discovered → a rule file under `.ai/rules/`, with its
  glob registered in `.ai/rules/index.md`
- Decision that closes an open question → dated row in `docs/decisions.md`
- Anything in the tree that changes a gate → the repo-state section below

## Red flags

Catch yourself thinking any of these and stop. The thought is the signal.

| Thought | Reality |
|---|---|
| "Too simple to need a test" | Simple code breaks. The test costs 30 seconds. |
| "I'll write the tests after" | A test written after passes immediately, which proves nothing. |
| "The golden changed, I'll just regenerate" | Then you have asserted nothing. Look at the SVG. |
| "I already checked it manually" | Ad-hoc, unrepeatable, forgotten under pressure. |
| "The measurement agrees with me, good" | That is when to check the instrument. Two false positives came from exactly this. |
| "Quick fix now, investigate later" | The first fix sets the pattern. Investigate now. |
| "It's probably X, let me change that" | Seeing the symptom is not understanding the cause. |
| "One more fix attempt" (after two) | Three failures means the architecture is wrong. |
| "Should pass now" / "seems fine" | Run the command. Confidence is not evidence. |
| "The spec is unclear, I'll pick something sensible" | Raise it. Improvised behavior becomes the de facto spec. |
| "I'll make the canvas a Svelte component, it's cleaner" | It is the documented performance trap. Read the architecture rule. |
| "Just a small fetch to check for updates" | No network. That is a non-negotiable, not a preference. |
| "I'll store that in localStorage for now" | Document state lives in files. Always. |
| "I'll hardcode this colour for now" | Tokens only. "For now" survives to release. |
| "I'll set z-index: 9999 on it" | Named `--z-*` layers only. Raw z-index is how the stacking got broken elsewhere. |
| "This screen needs a slightly different button" | Add a variant to the component, never a local restyle. |
| "I'll use the Ark component directly here, it's just one screen" | Wrap it. One screen becomes fifteen. |
| "The React example in Ark's docs is close enough" | Svelte usage differs. Check the Svelte tab or Context7. |
| "The spike is cleaned up, I restored the backup" | Show it. Check when the backup was taken. |
| "Lint has always been red, that's normal" | Then it is not a gate. Fix it or delete what causes it. |
| "It builds on my Mac, so it builds" | Cross-platform claims need CI. |
| "I'll commit this so it isn't lost" | Never. The user commits. |
| "The old D2 docs say oss.terrastruct.com" | That path is dead. Look it up. |

## Current repo state

Facts that affect the gates, **verified 2026-09-16**. This is the only place
volatile facts live: `CLAUDE.md` and `.ai/rules/` state intent and settled
decisions; this section states what is true in the tree today. Re-verify
before trusting any line; every session that trusts a stale line starts from
wrong facts. When a milestone closes, update this section in the same change.

### Milestones

- Milestones 0, 0.5, 1, 2, 3, 4, 5 and 5.5 (wiring) complete. **5.6 (chrome)
  passes its gates** (2026-09-17) but its exit criterion's hand check at a
  running window has not been done, so it is not complete. 5.6's brand task
  moved to **Milestone 5.7**.
- **5.7 (brand) passes its gates** (2026-09-17); not complete until a human
  has looked at the icons at 16px and 1024px and at the title bar and About in
  both themes. The art lives only in the repo (`frontend/src/brand/`,
  icon masters in `build/`); outside design folders are temporary and nothing
  may reference them.
- **Still Wails-branded, deliberately until Milestone 16:** the DMG file icon
  and background (`build/darwin/dmg-file-icon.*`, `dmg-background.png`). The
  volume icon already uses `icons.icns`. Nothing ships a DMG before release.
- Frontend `src/brand/panda.svg` is the vendored mark; `Mark.svelte` renders
  it. Icon masters live beside their outputs in `build/`.
- **5.8 (errors and logs) passes its gates** (2026-09-17). Not complete until
  a human forces a panic and a frontend exception in a release build and finds
  both in the log folder. Logs: `internal/logs`, one file per session in the
  platform log folder; `LogService` binding; `app.Go` for goroutines;
  `app.PanicHandler`; `ErrorDialog`, `PanelBoundary`; Help ▸ Open Logs Folder
  and Copy Diagnostics. Report Issue… built but hidden until Milestone 16.
- **Milestone 6 (shapes) passes its gates** (2026-09-17). Not complete until a
  human draws every shape, labels, recolours, resizes, zooms and pans at a
  running window in both themes. It also fixed shipped data loss: saving from
  the app had dropped points, text, children and unknown keys.
- **Native menu bar** from `internal/app/menu/spec.json`; clicks arrive as
  `menu:command` and dispatch through `frontend/src/shell/commands.ts`. The
  title-bar Open/Save buttons are gone. Edit commands, clipboard included,
  route by focus; punctuation shortcuts are matched by the page. **Not yet
  confirmed at a window on any platform**, including how a `\t`-separated hint
  renders in each native menu.
- **Autosave** settings (`off` default, `afterDelay`, `onFocusChange`) in
  `internal/config`, behaviour in `frontend/src/files/autosave.svelte.ts`,
  UI in Settings ▸ Files.
- **The roadmap was re-planned on 2026-09-16**, from Milestone 2 onward, around
  a free-placement canvas rather than a compile-to-SVG pipeline. See
  `.claude/work/specs/canvas-architecture.md`. Milestone 1's work survives in a
  narrower role: `internal/render` renders `diagram` elements placed on the
  canvas. The interim two-pane shell and `DiagramCanvas` class it shipped are
  replaced by Milestones 3 and 4.
- **The app can draw, open and save.** Milestone 5.5 wired Milestones 4 and 5
  to the window: pointer tools, keyboard editing, native open/save dialogs,
  the file tree, and the unsaved-changes and conflict prompts.
- **Not yet confirmed by a human:** draw → save → quit → reopen. Every test
  passes, but this round trip has not been performed at a running window.
- Milestone 6 (diagram elements) is next. It also restores the D2 preview,
  absent since Milestone 4.
- **Known regression, deliberate:** typing D2 renders no diagram. Milestone 4
  replaced the interim `DiagramCanvas` with a Konva stage, and the `diagram`
  element that puts a rendered diagram back on the canvas arrives in Milestone
  6. The pipeline, its tests and its goldens are untouched; diagnostics still
  reach the editor gutter. Do not "fix" this; it is recorded in
  `docs/decisions.md`.
- Everything since the scaffold is uncommitted apart from Milestone 0.5; the
  user commits.
- `.claude/plan/roadmap.md` holds the sequence.

### Toolchain, verified by command

- Go module path `github.com/tenesh/bava`, `go 1.27.0` directive, toolchain
  `go1.27.1 darwin/arm64`. `GOPATH` at `/Users/tenesh/Workspace/tools/go`.
- D2 `v0.9.0` is a **direct** requirement in `go.mod` (`internal/layout` and
  `internal/render` import it). The `go mod tidy` trap from Milestone 0.5 is
  over: tidy keeps it now that real code imports it. TALA ships in-library at
  `d2layouts/d2talalayout`, with no external binary plugin.
- Wails `v3.0.0-beta.20` on both sides. `@wailsio/runtime` is pinned exactly to
  `3.0.0-beta.20`; it had floated on `latest` and resolved to `beta.21`,
  mismatching the Go half. Never float it again.
- Node `v24.21.0`, npm `11.19.0`. `.nvmrc` pins the major (`24`) and is what
  CI's `setup-node` reads.
- Frontend tooling: ESLint `10.10.0` (flat config at
  `frontend/eslint.config.js`), `eslint-plugin-svelte` `3.23.0`,
  `typescript-eslint` `8.70.0`, Vitest `5.0.1` with `jsdom`, CodeMirror 6
  (`codemirror` `6.0.2`, `@codemirror/lint` `6.9.7`). `vitest.config.ts` loads
  the Svelte plugin (runes in `*.svelte.ts`) and sets
  `resolve.conditions: ['browser']`, without which `mount` throws
  `lifecycle_function_unavailable` under jsdom.
- `frontend/package.json` `test` script is plain `vitest run`. The Milestone
  0.5 `--passWithNoTests` flag is gone: with real tests, a flag that keeps the
  gate green when every test vanishes is not a gate.

### Gate status: last run 2026-09-16, after Milestone 1

| Gate | Result |
|---|---|
| `go vet ./...` | exit 0 |
| `go build ./...` | exit 0 (linker warns about macOS deployment target; harmless) |
| `go test ./...` | exit 0; 3 packages: `internal/app`, `internal/layout`, `internal/render` |
| `go test ./internal/render -run Golden` | exit 0; 4 goldens (light and dark) under `testdata/golden/` |
| `npm run check` | exit 0; 0 errors, 0 warnings, 173 files |
| `npm run lint` | exit 0 |
| `npm test` | exit 0; 185 tests across 28 files |
| `npm run build` | exit 0 |
| `wails3 build` | exit 0 on macOS; 30MB binary in `bin/`; unverified elsewhere |

### Open problems

- **`go test ./...` compiles a package inside `node_modules`.** There is a Go
  package at `frontend/node_modules/flatted/golang/pkg/flatted`, so the gate
  depends on an npm dependency shipping compilable Go. Milestone 1's exit
  criterion now scopes the suite to `go test ./internal/... .` for that reason.
- **Milestone 1 wired click-on-node to jump-to-source with no keyboard path.**
  The design system requires every interactive affordance to be keyboard
  reachable with a visible `--color-focus-ring`, and that token cannot exist
  before Milestone 2. Recorded debt for Milestone 3, alongside
  `CanvasControls`.
- **The first two user-facing strings are hardcoded** (`aria-label` on the two
  panes in `App.svelte`). The translation layer arrives in Milestone 3 and must
  migrate them.
- **`DEBOUNCE_MS` (250) and `DefaultEngine` ("tala") are compile-time
  constants.** Named and single-sourced, but with no config behind them. They
  move behind the settings file in Milestone 5.
- **Milestone 1's token debts are cleared.** The 13px base, the font wiring and
  the `1px` divider all resolve from tokens. Still open: the native window
  background colour removed from `main.go`, which needs a Wails window API call
  and belongs with the shell in Milestone 3.
- **Fonts are bundled and wired.** Geist and Geist Mono, variable `woff2`, in
  `frontend/public/fonts/`, under SIL OFL 1.1 recorded in `NOTICE`. The
  scaffold's bundled-but-unreferenced `Inter-Medium.ttf` and its licence file
  are gone. `@font-face` is declared in `public/style.css` until the token
  layer takes it over.
- **`LICENSE` (Apache-2.0) and `NOTICE` exist.** `NOTICE` is the source for the
  About screen's attribution and must gain an entry in the same change as any
  bundled dependency.
- **CI has failed twice, both causes fixed, awaiting a third run.**
  Second failure: ubuntu only, pkg-config could not find `gtk4` /
  `webkitgtk-6.0` because the workflow installed the GTK3 packages. Wails v3
  defaults to GTK4 + WebKitGTK 6.0; GTK3 is opt-in behind a build tag. The
  workflow now installs `libgtk-4-dev libwebkitgtk-6.0-dev libsoup-3.0-dev
  libglib2.0-dev` and verifies them with `pkg-config --exists` so a missing
  package fails legibly instead of inside cgo. Package availability confirmed
  on Ubuntu 22.04 through 26.04.
  First failure (all three platforms): First run failed identically on ubuntu, macos and
  windows at `go vet` with `pattern all:frontend/dist: no matching files
  found`: the Go steps ran before the frontend was built, and `frontend/dist`
  is gitignored so a fresh checkout has none. The workflow now builds the
  frontend first, and both Go gates are scoped to `./internal/... .` because
  `node_modules` exists by then and ships a Go package. Verified locally from a
  deleted `dist/`: all eight steps pass in the workflow's order. **Still not a
  green matrix**; that needs a push and a new run.
- The question CI exists to answer is still open: whether D2 renders
  byte-identical SVG on Linux and Windows, which every golden file assumes.
  Nothing else can answer it.
- `.ai/`, `.claude/`, `CLAUDE.md`, `docs/`, `LICENSE` and `NOTICE` are
  untracked at the time of writing.
- **Konva is not installed yet.** The canvas foundation is Milestone 4; the
  dependency lands with it, alongside `perfect-freehand`, `perfect-arrows`,
  `@dagrejs/dagre` and `rbush`. All MIT.

### Spike findings: Ark UI in the Wails webview, 2026-09-16

Throwaway spike, since deleted: an Ark Dialog + two Tooltips rendered under
`wails3 dev`, measuring themselves from inside the webview and reporting
through a temporary Go binding. Ark `5.24.2`, Svelte `5.57.0`, Vite `8.3.0`,
Wails `v3.0.0-beta.20`, macOS 26.6.2. Webview confirmed as WKWebView
(`AppleWebKit/605.1.15 … wails.io`), window 1000×618 at dpr 2.

**Caveat on method:** `screencapture` is unavailable in this environment, so
nothing here was seen by eye. Every statement is a geometry or DOM measurement
taken inside the real webview. Visual appearance (colour, overlap, painting
artefacts) remains unverified and needs a human look at a running window.

What worked:

- **Portalling works.** Dialog and Tooltip content both mount at `body` level,
  outside `#app`. No webview-specific breakage.
- **Dialog geometry is exact.** Content measured 320×154 at (340, 232) in a
  1000×618 viewport, centred to the pixel. Focus moved into the content on
  open; Escape closed it.
- **Tooltip positioning works, including edge handling.** A tooltip on a
  trigger at (958, 600), bottom-right corner, was shifted to (656, 566) at
  337×26, right edge 993 of 1000. The popper keeps content on screen.
- **No JavaScript errors** in the webview during any run.

What did not work:

- **Ark ships no z-index.** Dialog and tooltip content both painted *below* a
  plain `position: fixed; z-index: 9999` div. Milestone 2's `--z-*` tokens
  must cover portal layers explicitly and stack the portal root above app
  chrome. Layer names are settled in `.ai/rules/design-system.md`.
- **A modal Dialog sets `pointer-events: none` on `body`.** This produced two
  false "dialog is on top" results before being caught. It reaches the canvas:
  see `.ai/rules/canvas.md`.
- **Closing a dialog does not unmount it.** Node stays with
  `data-state="closed"`, `hidden`, `display: none`. Query by state.
- **Binding `open` on a Tooltip does not position it.** Only real pointer
  events open and position tooltip content.

Build and type-check with Ark in the tree: `npm run check` exit 0, 0 errors
across 1553 files including Ark's own `.svelte` sources. `npm run build`
exit 0. Bundle 57.61 kB → **173.51 kB** (21.20 → 58.28 gzip) for Dialog +
Tooltip + Portal alone. Track this as a tree-shaking signal, not a budget.

Ark is **not** a dependency right now: installed for the spike, uninstalled
afterwards, with `package.json`, the lockfile and `node_modules` all confirmed
clean and the bundle back to 57.61 kB. Milestone 2 or 3 adds it back
deliberately at `5.24.2` or later.

### Milestone 2 findings, 2026-09-17

- **D2's palette has two families and they are not interchangeable.** Neutrals
  `N1`–`N7` carry text and canvas; the `B` and `A` families carry shapes.
  Mapping stroke and fill onto `N4`/`N5` leaves node borders D2's default blue
  however the theme is set. All 18 slots are mapped in
  `internal/render/theme.go`, because an unmapped one keeps its pale default
  and surfaces on whichever shape type uses it.
- **That was caught by looking at a golden, not by a test.** The byte
  comparison passed on output where a nested cylinder rendered near-white with
  an illegible label. `testing.md`'s rule about blessing a golden unseen is not
  ceremony.
- **`localStorage` is guarded everywhere it is touched.** `theme.svelte.ts`
  falls back to follow-system when it throws, which is what a private window
  does.
- **Literals are now blocked by a test**, `src/styles/no-literals.test.ts`, not
  by a grep in a roadmap.
- The frontend has `sass` and `@types/node` as devDependencies; `svelte-check`
  covers test files, so Node APIs in tests need the types.

### Milestone 3 findings, 2026-09-17

- **Regions are hidden with CSS, never unmounted.** CodeMirror and the canvas
  own their own DOM and are mounted once; a conditional `{#if}` around a region
  destroys the editor on every view switch and takes its undo history with it.
  `App.test.ts` asserts the editor node is the same node after a switch.
- **`bind:this` is nulled before a parent's `onMount` cleanup runs.** Capture
  element references at mount if the cleanup needs them.
- **Ark's own elements need prefixed class names.** Svelte's scoping cannot
  reach them, so the rules are `:global()` and a generic name leaks app-wide.
- **Ark 5.24.2 is a dependency again** (it was removed after the 2026-09-16
  spike). `Dialog`, `Splitter` and SegmentGroup are wrapped.
- **jsdom cannot verify a theme or a focus ring.** It does not paint and does
  not resolve `var()`. The keyboard pass and both-themes check for Milestone 3
  are **unticked** and need a human at a running window.
- The window is 1280×800, from `internal/app/window.go`, pinned by a test.

### Milestone 4 findings, 2026-09-17

- **Konva needs a 2D context jsdom does not provide.** `vitest-canvas-mock` is
  wired in `vitest.config.ts`. Without it Konva throws `Cannot read properties
  of null (reading 'scale')`, which looks like a Konva bug.
- **`Omit` does not distribute over a union.** It collapses to shared keys, so
  a naive `NewElement` rejects every element with fields of its own.
  `scene.ts` has a distributive version.
- **Selection, grouping and paste exist as tested logic but are not yet bound
  to pointer events.** The tool rail and shortcuts are wired; drawing with the
  tools is not. Milestone 5 is the first to need them for real.
- Dependencies added: `konva` 10.5.0, `perfect-freehand` 1.2.3, `immer`
  11.1.18, `vitest-canvas-mock` 1.2.0. `rbush` deliberately not installed.
- `docs/shortcuts.md` exists now, and lists what is *not* bound as well as what
  is.

### Milestone 5 findings, 2026-09-17

- **`docs/file-format.md` exists and is the specification.** A Bava file is
  Markdown: prose, fenced `d2` blocks with an `id`, and one trailing
  `bava-canvas` block. Nothing writes a format that is not in that document.
- **Markdown is scanned, never parsed.** A real parser round-trips prose
  approximately, and approximate means corrupting a file somebody else wrote.
- **Unknown element types, unknown keys and unknown top-level keys are
  preserved verbatim.** A bug found during this milestone: dropping the canvas
  block because a scene had no elements also dropped a newer version's
  top-level keys. Emptiness means no elements *and* nothing preserved.
- **Saves are atomic:** temp file in the same directory, fsync, rename.
- **Conflict detection is size plus mtime**, not a content hash.
- Go packages now: `app`, `app/menu`, `config`, `format`, `layout`, `logs`,
  `render`, `store`.

### Milestone 5.5 findings, 2026-09-17

- **Tests that only exercise the happy path through a stateful flow will miss
  the flow that matters.** Every save test opened a document first, so none
  noticed that saving an *untitled* drawing never reached disk. It was found by
  reading `App.svelte`. When a flow has a "new" and an "existing" branch, test
  both.
- **File-flow policy is in `files/actions.svelte.ts`**, tested, not in markup.
- **A drag is one history step**, and movement under three pixels is a click.
- **Canvas keyboard shortcuts stand down while typing.** `canvas/keymap.ts` is
  pure and the caller decides what "typing" means.
- **Template snippet names share scope with script variables.** A snippet called
  `files` shadowed an object called `files` inside it.

### Milestone 5.6 findings, 2026-09-17

- **Wails role items panic outside a running app**, and **roles bind
  accelerators the spec never names**, including Delete binding bare
  Backspace. Both recorded in `.ai/rules/wails.md`; `menu.Build` takes an
  injectable role adder for tests.
- **An exported method on a registered service is bound.** `Build` leaked into
  the generated TypeScript until it became the package function
  `app.InstallMenu`. Check `frontend/bindings` after adding a method.
- **The spec is read by frontend tests directly** (commands, keymap, shortcuts
  doc). Vite's dev server needed `server.fs.allow` for `internal/app/menu`.
- **The spec review caught what the tests could not**, by reading the pinned
  Wails source: Windows shows no menu without `UseApplicationMenu`,
  punctuation accelerators never fire on Windows, and the clipboard roles
  never reach a canvas there. For platform behaviour, read
  `pkg/application/*_windows.go` and `*_linux.go`, not only the API.
- **An autosave races the user.** A save that clears `dirty` without checking
  for edits made during the write loses work. Fixed with an edit counter.

### Milestone 5.7 findings, 2026-09-17

- **The template ships icons in three places**, and macOS 26 reads the one
  you did not replace: `Assets.car` via `CFBundleIconName`. Removed, with a
  test.
- **The design export carries a C2PA manifest.** Strip it when vendoring; a
  test pins the path data by SHA-256 so stripping cannot alter the drawing.
- **Never reference design folders outside the repo** from code, tests or
  living docs. They are deleted after handover; vendor what the product needs
  and record the rules in `.claude/work/specs/`.
- **A comment counts as a literal.** `no-literals.test.ts` rejected `16px` in
  a doc comment; name the token instead.

### Milestone 5.8 findings, 2026-09-17

- **A release build of Wails keeps no logs and exits on any panic** outside a
  bound method. Both recorded in `.ai/rules/wails.md`.
- **A file name is content.** The privacy test's sentinel in a missing file's
  name would have been logged through the error message. Bava logs sizes,
  counts and durations, never paths.
- **A privacy test must prove it exercised something.** It also asserts the
  expected debug lines are present; an empty log passes every "does not
  contain" check.
- **Ark's Collapsible marks an open section by removing `hidden`**, not with a
  `data-state` on the content, in jsdom.
- **`go build .` writes a 46MB `bava` binary into the repo root.** Deleted
  after use; build into `bin/` or use `go vet`.

### Milestone 6 findings, 2026-09-17

- **A green test count is not a green gate.** `npm test` reported 340 passed
  and exited 1 on two unhandled rejections (jsdom has no ResizeObserver; a stub
  is in `src/test-setup.ts`). Filtering output for the "Tests" line hid it for
  a whole milestone. Check the exit code.
- **encoding/json HTML-escapes**, both `json.Marshal` and anything a
  `MarshalJSON` returns: a label "A -> B" was written as "A -\u003e B". The
  format writer encodes with `SetEscapeHTML(false)` and normalises raw element
  bytes on decode.
- **The frontend had its own lossy copy of the scene**: it saved
  `{version: 1, elements}` and dropped a newer scene's version and top-level
  keys. `sceneToSave` keeps them.

- **Go round-trip tests missed a data-loss bug on the app's real path.** The
  scene crosses encoding/json to the frontend and back; `json:"-"` dropped
  everything unmodelled. Test that path (`.ai/rules/file-format.md`).
- **Scene-data tests missed invisible shapes.** Stage tests now inspect Konva
  nodes (`.ai/rules/canvas.md`).
- **Ellipses and strokes were mispositioned**: an ellipse centred on its
  corner, and stroke points stored absolute and drawn offset again.
- **Ark Menu and RadioGroup selection in jsdom:** Menu needs keyboard events
  (ArrowDown, Enter); RadioGroup items accept a click. Popovers render closed
  content unless `lazyMount`.

### Milestone 6.1 findings (window check and launch), 2026-09-17

- **The first window check found three defects every test missed**: a
  "closed unexpectedly" notice after every quit, the shape menu stuck open,
  and a zero-height canvas (no rail, no drawing). Plan
  `.claude/work/plans/06.1-window-check-and-launch.md`. Gates green; the
  running-window look in both themes is **still owed** (the display was asleep
  when this was written).
- **On macOS `Run` never returns**: the session closes in `PostShutdown`
  (`.ai/rules/wails.md`).
- **Panes were never filling their region** (predates Milestone 6), and
  **Ark content closed with `hidden` is overridden by any `display` rule**
  (`.ai/rules/design-system.md`).
- **A screenshot is possible now**: `screencapture -x bin/shot.png` works from
  Warp, and so do `osascript` keystrokes. Without a running Wails window,
  headless Chrome over CDP against the Vite dev URL measures layout and takes
  screenshots; Go calls fail there, so "Settings could not be read" is expected.
- **Launch:** no file open at start, splash until settings and fonts settle
  (`.claude/work/specs/launch.md`). Settings left the title bar. A test raises
  a menu command with `window._wails.dispatchWailsEvent`.
- **An Ark portal mounts a tick late in jsdom**: a test asserting absence must
  wait first, or it passes whatever the component does.
- **Not fixed, noticed:** the source pane never shows an opened file's source
  (it mounts once, empty), and CodeMirror's active-line gutter paints a light
  box in the dark theme.

### Milestone 6.2 findings (canvas interface), 2026-09-18

- **Gates green; seen at a running window on macOS, dark theme**: live
  drawing, icon rail, insert panel, selection toolbar, right-click menu with
  cascading submenus, aligned traffic lights. Light theme and Windows/Linux
  not seen. Plan `.claude/work/plans/06.2-canvas-interface.md` lists
  deviations.
- **Page shortcuts are matched before any editor.** A key that means
  something in CodeMirror or a text field must be `scope: "canvas"`.
- **jsdom computes no floating positions.** A menu placed off-screen passes
  every jsdom test; check placement at a running window.
- **View mode persists across App tests** (it is a remembered preference): a
  test that needs the canvas visible must choose Canvas first.
- **The no-literals test reads `#faded` as a hex colour.** Name private
  fields accordingly.
- **Driving the app:** confirm Bava is frontmost before every synthetic key or
  click (a ⌘N once reached Finder). The session scratchpad had `bava-front.sh`,
  a CGEvent `mouse` helper and `rclick`; match the process with
  `^bin/bava.dev.app/Contents/MacOS/bava$`, not a looser pattern that finds
  the shell wrapper first.
- **Status-bar messages are a usable probe inside WKWebView** when headless
  Chrome cannot reproduce: temporary, removed after.

### Settled facts that still hold

- D2 spike verified: library links cleanly, TALA output quality is good.
  Timings on a ~25 node architecture diagram, warm: dagre 12ms, elk 7ms,
  TALA 96ms. Re-measure after any D2 bump.
- `.gitattributes` forces LF except Windows scripts. This is what makes golden
  SVGs byte-comparable across platforms; do not relax it.
- `docs/` and `internal/` are empty by design: the target layout in
  `CLAUDE.md`, created by the milestone that needs each package.
  `docs/wails-v3/` is not vendored yet.
- No file format decided yet. Until `docs/file-format.md` exists, nothing may
  write a persistent format.
- No tokens defined yet. Until `frontend/src/styles/tokens/` exists, no
  component work should start.