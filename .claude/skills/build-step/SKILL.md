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
4. **NO SERVICE OF OURS.** Any task that seems to need a server or account we
   run, or a network call the user did not configure or trigger, is a spec
   problem. Stop and raise it.

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
9. **Gates.** `go vet ./internal/... .`, `go test ./internal/... .`,
   `npm run check`, `npm run lint`, `npm test`: all green, with output shown.
   `npm run browser` too when what is drawn or how the page behaves changes. See the gate-status table in
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
| Full Go suite | `go test ./internal/... .` |
| Golden tests | `go test ./internal/render -run Golden` |
| Regenerate goldens | `go test ./internal/render -run Golden -update` |
| Vet | `go vet ./internal/... .` |
| Format | `gofmt -w .` |
| Svelte types | `npm run check` |
| JS/TS lint | `npm run lint` |
| Frontend tests | `npm test` |
| Browser tests: integration and visual regression (Docker) | `(cd frontend && npm run browser)`; one with `-- --project=visual` or `-- --project=integration` |
| Accept intended screenshot changes | `(cd frontend && npm run browser:update)`, then open every changed image |
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
| Design system components | Build against `.ai/rules/design-system.md`. Verify with `npm run check` and `npm run lint`, a visual check (`npm run browser`, every changed image opened and read), plus a keyboard pass (tab order, escape, arrow keys) before done. |
| Anything drawn: a style, token, layout, string, new screen or dialog | A visual check. A new screen or dialog gets a test in `frontend/tests/visual/` in the same change; references change only through `browser:update` after looking. |
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
- A stale or flickering diagram is usually an out-of-order IPC response, not a
  layout bug. Check the request ID.
- A Svelte "reactivity not working" symptom in canvas code usually means
  reactivity is being used where it should not be. Re-read the architecture
  rule before adding a `$derived`.
- Diagram layout differing between machines means D2 text measurement
  leaked into the frontend. D2 diagram text is measured in Go via
  `textmeasure`; canvas text is measured in the frontend and its dimensions
  are stored in the file.
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
| Tests pass | `go test ./internal/... .` output in this session, 0 failures; for `npm test`, the **exit code**, not the passed count |
| Goldens clean | Golden run output, and the SVG diff reviewed by eye if any changed |
| Types clean | `npm run check` output |
| Lint clean | `npm run lint` output |
| Bug fixed | The original failing test, now green |
| Component done | Keyboard pass performed, both themes checked |
| Spike cleaned up | Restored state **shown** to match, not asserted: diff the touched files against their pre-spike state, confirm the dependency is gone from `package.json`, the lockfile *and* `node_modules`, and check the bundle size returned to baseline. A backup taken after an install restores the install. |
| Visual behaviour verified | `npm run browser` green, and every changed screenshot opened and read in both themes; the real app's CI end-to-end run for anything that crosses into Go. Feel (scrolling, gestures, native menus) is still a human's call at a running window. |
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
| "Just a small call to a service of ours" | No service of ours, no telemetry. Network only where the user configured or triggered it, and the update check of public release metadata. A non-negotiable, not a preference. |
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

Facts that affect the gates, **verified 2026-10-04**. This is the only place
volatile facts live: `CLAUDE.md` and `.ai/rules/` state intent and settled
decisions; this section states what is true in the tree today. Re-verify
before trusting any line; every session that trusts a stale line starts from
wrong facts. When a milestone closes, update this section in the same change.
History belongs in each plan's As built, not here.

### Milestones

- **Committed through 8.5** and removing a Space (CI green 2026-10-06).
  **8.6a** (tags) is built and gated, uncommitted; **8.6b** (templates)
  follows, then Milestone 15 (export, import and
  search). The roadmap (`.claude/plan/roadmap.md`) holds the sequence.
- **CI** builds a downloadable app per system on every run (artifacts
  `bava-<os>-<commit>`, 14 days) from 08.4e on; its first run is the check.
- Each plan under `.claude/work/plans/` has an "As built" section with its
  deviations, its review outcome and the checks left to a person at a running
  window (feel, native menus, each platform's webview).
- **Still Wails-branded, deliberately until release:** the DMG file icon and
  background (`build/darwin/dmg-file-icon.*`, `dmg-background.png`).
- **Help ▸ Report Issue** is built but hidden until release
  (`REPORT_ISSUE_ENABLED` in `frontend/src/shell/report-issue.ts`).

### Toolchain, verified by command

- Go module path `github.com/tenesh/bava`, `go 1.27.0` directive, toolchain
  `go1.27.1 darwin/arm64`. `GOPATH` at `/Users/tenesh/Workspace/tools/go`.
- D2 `v0.9.0` is a direct requirement in `go.mod`. TALA ships in-library at
  `d2layouts/d2talalayout`, with no external binary plugin.
- Wails `v3.0.0-beta.20` on both sides. `@wailsio/runtime` is pinned exactly to
  `3.0.0-beta.20`; never float it.
- Node `v24.21.0`, npm `11.19.0`; `.nvmrc` pins the major (`24`) for CI.
- Frontend: Svelte 5, Ark UI `5.24.2`, Konva `10.5`, Vitest `5.0.1` with
  `jsdom`, ESLint flat config at `frontend/eslint.config.js`, CodeMirror 6,
  ProseMirror with markdown-it pinned to the copy prosemirror-markdown uses.
  `vitest.config.ts` sets `resolve.conditions: ['browser']`, without which
  `mount` throws `lifecycle_function_unavailable` under jsdom.
- Go packages under `internal/`: `app` (with `app/menu`), `config`, `e2e`,
  `format`, `layout`, `logs`, `render`, `space`, `store`, `web`.
- Bindings are regenerated with
  `wails3 generate bindings -f '' -clean=true -ts -i` after any bound Go
  change, including comments (the generated TypeScript copies them). The
  smoke driver calls its service by name (`Call.ByName` in
  `frontend/src/e2e/driver.ts`), so it has no generated bindings to restore.

### How tests run

- **On the host:** Go tests and goldens, vitest (`npm test`), `npm run check`,
  `npm run lint` and `npm run build`. None of them starts the app.
- **Browser tests (integration and visual regression) run only in Docker:**
  `npm run browser` (`tests/scripts/browser.sh`, image from
  `tests/docker/browser.Dockerfile`).
  On this Mac, Docker is OrbStack and must be running (`docs/testing.md`).
- **The real app (end-to-end) runs only on CI:** the e2e build (`-tags e2e`)
  walks `tests/e2e/` (`create`, `reopen`, `canvas`) on all three
  platforms. Never launch the app locally, `wails3 dev` included.

### Gate status: 2026-10-04

| Gate | Result |
|---|---|
| `go vet ./internal/... .` | exit 0 (the linker warns about the macOS deployment target; harmless) |
| `go test ./internal/... .` | exit 0; 12 packages |
| `go test ./internal/render -run Golden` | exit 0 (inside the run above); 2 fixtures under `testdata/golden/`, light and dark |
| `npm run check` | exit 0; 0 errors, 0 warnings |
| `npm run lint` | exit 0 |
| `npm test` | exit 0; 2,738 tests passed and 1 skipped, in 211 files |
| `npm run build` | CI's first frontend step. The production minifier rejects some CSS the dev server and the browser tests accept (WebKit-only selectors such as `::selection:window-inactive`) |
| `npm run browser` | last full runs 2026-10-06: 449 passed, twice in a row; 262 references in `testdata/visual/` |
| CI end-to-end | `create`, `reopen` and `canvas` on all three platforms; see Milestones for the last run |
| `wails3 build` | CI only |

### Owed at a running window

What no test can see, still waiting for a person, in both themes:
- The keyboard passes: the Space tree, switcher, start screen, Space dialogs
  and section tabs; the `/` menu, bubble, block handle, find bar and page
  menu; the error dialog; the Media section and dialog.
- The look after the restyle; the icons at 16px and 1024px.
- The native menus on each platform (Windows and Linux unseen).
- A forced panic and a frontend exception found in the log folder in a
  release build.
- On macOS: a video file's first frame, a YouTube link's thumbnail, and play
  opening the browser.
- The canvas checks kept at the window, listed with reasons in
  `.claude/work/plans/08.4a-canvas-testing.md` (As built).

### Open problems

- **The Go gates are scoped to `./internal/... .`**: `frontend/node_modules`
  ships a Go package (`flatted/golang`), so `./...` would depend on an npm
  dependency. CI uses the same scope.
- **Browser tests see WebKit in a container, not the real webviews.** They
  catch layout and styling faults in both themes; how each platform's webview
  draws, and how anything feels, is still seen only at a running window.

### Traps

- **A modal Ark Dialog sets `pointer-events: none` on `body`**, so canvas
  pointer handling looks broken while one is open
  (`.ai/rules/design-system.md`).
- **Headless WebKit can keep painting a menu as it first appeared** after its
  state changes. Assert highlighted or checked rows from the page
  (`.ai/rules/testing.md`).
- **WebKitGTK and WebView2 do not draw as WKWebView does**, glyph advances
  included; their quirks are in `.ai/rules/canvas.md` and
  `.ai/rules/wails.md`.
- **Judge `npm test` by its exit code.** An unhandled rejection fails the run
  while every test passes.
- **`go build .` writes a large `bava` binary into the repo root.** Build into
  `bin/` or use `go vet`.
- **`no-literals.test.ts` reads `#faded` as a hex colour**, in comments as
  well as code. Name private fields accordingly.
- **Svelte snippet names share scope with script variables**: a snippet
  called `files` shadowed an object called `files` inside it.

### Settled facts that still hold

- `.gitattributes` forces LF except Windows scripts. This is what makes golden
  SVGs byte-comparable across platforms; do not relax it.
- D2 layout timings live in `.ai/rules/d2.md`; re-measure after any D2 bump.
- `docs/wails-v3/` is not vendored yet.
