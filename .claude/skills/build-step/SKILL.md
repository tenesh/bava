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
| Screen checks (layer 2) | `(cd frontend && npm run visual)` |
| Accept intended screen changes | `(cd frontend && npm run visual:update)`, then open every changed image |
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
| Design system components | Build against `.ai/rules/design-system.md`. Verify with `npm run check` and `npm run lint`, a screen check (`npm run visual`, every changed image opened and read), plus a keyboard pass (tab order, escape, arrow keys) before done. |
| Anything drawn: a style, token, layout, string, new screen or dialog | A screen check. A new screen or dialog gets a walk in `frontend/tests/visual/specs/` in the same change; references change only through `visual:update` after looking. |
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
| Visual behaviour verified | `npm run visual` green, and every changed screenshot opened and read in both themes; the real app's CI smoke run for anything that crosses into Go. Feel (scrolling, gestures, native menus) is still a human's call at a running window. |
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

Facts that affect the gates, **verified 2026-09-27**. This is the only place
volatile facts live: `CLAUDE.md` and `.ai/rules/` state intent and settled
decisions; this section states what is true in the tree today. Re-verify
before trusting any line; every session that trusts a stale line starts from
wrong facts. When a milestone closes, update this section in the same change.

### Milestones

- **Committed through Milestone 8.3d** (2026-09-28; CI green on all three
  platforms, the smoke run included). **8.4.1** (attachments, images and
  video files) is committed, CI green on all three platforms with its smoke
  steps (an image added through the picker, found loaded after reopening). It adds `golang.design/x/clipboard` (MIT,
  pure Go on every platform: no build dependency on Linux) for pasted
  images, and the file route at `/bava-file/` (`internal/app/files.go`).
  **8.4.2** (online videos and cards) is committed, CI green; the smoke
  screenshots show YouTube's player loading inside Bava on all three
  platforms. **8.4.3** (the Media section and dialog) passes its gates
  locally on 2026-09-29, uncommitted; its smoke steps (Media opened after
  reopening, the image found used by First page) run on CI first. 8.5 and
  8.6 follow, then 8.4a (canvas screen checks and smoke runs
  with complex scenes, before 8.5), then Milestone 15 (export, import and
  search). The roadmap (`.claude/plan/roadmap.md`) holds the sequence.
- **The Document** (`frontend/src/docs/`): a ProseMirror editor over the
  page's Markdown, with markdown-it pinned to the copy prosemirror-markdown
  uses (one copy, matching types). What it cannot edit is kept byte for byte.
  The D2 source pane that sat in the Document side is gone from the window;
  `SourcePane` lives on in the Diagram dialog and code blocks.
- **Built and gated:** Milestones 0 to 7 (the canvas: shapes, styles,
  rotation, export, arrows and bindings, frames, Diagram from Code, code
  blocks, points and elbows, snapping) and 8.1 (Spaces: `.bava/space.json`,
  the Files tree, Trash, New Space, Space settings, the start screen and
  switcher), plus the restyle to the Bava Design mockups (dialog frame,
  status bar per side, dot grid). Each plan under `.claude/work/plans/` has an
  "As built" section with its deviations and review outcome.
- **Owed by a human at a running window, in both themes** (tests cannot see
  these): the 6.x canvas plans' Verification sections; 8.1's keyboard pass
  (SpaceTree, SpaceSwitcher, StartScreen, the Space dialogs, SectionTabs);
  8.2's keyboard pass (the `/` menu, bubble, block handle, find bar, page
  menu) and typing into a page and saving it at a real window;
  the restyle's look; draw, save, quit and reopen; the native menus on each
  platform; a forced panic and frontend exception found in the log folder in
  a release build; the icons at 16px and 1024px. Milestone 7 was checked.
- **Two traps worth remembering:** a test seam at the transport never runs
  the code that translates a real response, so a dropped field can pass every
  test and do nothing at the window; and CSS the tests cannot see can break
  the window outright (closed dialogs showed at launch until `base.scss`
  forced `[hidden]`). D2 writes remote URLs into its SVG for `icon:` and
  `link:`, so any preview of rendered SVG strips them
  (`canvas/import/safe-svg.ts`).
- **Still Wails-branded, deliberately until release:** the DMG file icon and
  background (`build/darwin/dmg-file-icon.*`, `dmg-background.png`).
- **Help ▸ Report Issue** is built but hidden until release.
- `.ai/`, `.claude/`, `CLAUDE.md`, `docs/`, `LICENSE` and `NOTICE` are
  tracked.

### Toolchain, verified by command

- Go module path `github.com/tenesh/bava`, `go 1.27.0` directive, toolchain
  `go1.27.1 darwin/arm64`. `GOPATH` at `/Users/tenesh/Workspace/tools/go`.
- D2 `v0.9.0` is a direct requirement in `go.mod`. TALA ships in-library at
  `d2layouts/d2talalayout`, with no external binary plugin.
- Wails `v3.0.0-beta.20` on both sides. `@wailsio/runtime` is pinned exactly to
  `3.0.0-beta.20`; never float it (it once resolved to `beta.21`).
- Node `v24.21.0`, npm `11.19.0`; `.nvmrc` pins the major (`24`) for CI.
- Frontend: Svelte 5, Ark UI `5.24.2`, Konva `10.5`, Vitest `5.0.1` with
  `jsdom`, ESLint flat config at `frontend/eslint.config.js`, CodeMirror 6.
  `vitest.config.ts` loads the Svelte plugin (runes in `*.svelte.ts`) and sets
  `resolve.conditions: ['browser']`, without which `mount` throws
  `lifecycle_function_unavailable` under jsdom.
- Bindings are regenerated with
  `wails3 generate bindings -f '' -clean=true -ts -i` after any bound Go
  change, including comments (the generated TypeScript copies them).
  **It deletes `frontend/bindings/.../internal/e2e/`**, which only a build
  with the `e2e` tag generates: put those three files back from `HEAD`
  (`git show HEAD:<path> > <path>`) and check `git status` shows them
  unchanged.

### Gate status: last run 2026-09-28, after 8.3c

| Gate | Result |
|---|---|
| `go vet ./internal/... .` | exit 0 (the linker warns about the macOS deployment target; harmless) |
| `go test ./internal/... .` | exit 0; 11 packages |
| `go test ./internal/render -run Golden` | exit 0; goldens under `testdata/golden/` |
| `npm run check` | exit 0; 0 errors, 0 warnings |
| `npm run lint` | exit 0 |
| `npm test` | exit 0; 2,321 tests across 167 files (1 skipped) |
| `npm run build` | exit 0; the production minifier rejects some CSS that the dev server and the screen checks accept (WebKit-only selectors such as `::selection:window-inactive`), and CI's first step is this build |
| `npm run visual` (layer 2) | exit 0; 120 walks, 112 references in `testdata/visual/`; needs OrbStack running |
| CI `smoke` (layer 3) | green on all three platforms after 8.3d, the page link and rename steps included |
| `wails3 build` | macOS only, unverified elsewhere |

### Open problems

- **Scope the Go gates to `./internal/... .`**: `frontend/node_modules` ships a
  Go package (`flatted/golang`), so `./...` depends on an npm dependency.
- **CI is green on the matrix** (9cf4d06), goldens included on Linux and
  Windows.
- **Screen checks see WebKit in a container, not the real webviews.** Layer 2
  (`npm run visual`) catches layout and styling faults in both themes; how
  each platform's webview draws, and how anything feels, is still seen only at
  a running window.

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

### Milestone 8.1 findings (Spaces and files), 2026-09-27

- **Gates green; not seen at a running window.** Plan
  `.claude/work/plans/08.1-spaces-and-files.md`.
- A Space is a folder with `.bava/` (`space.json`, `trash/`), in
  `internal/space`; `SpaceService` replaced `FileService.ListWorkspace`.
  Bindings regenerated. The Files tree is Ark's TreeView (`SpaceTree`).
- Menu ids added: `file.newFolder`, `file.openSpace` (⌘O), `space.trash`,
  `file.spaceSettings`; `file.open` is ⇧⌘O. A menu id ending `.settings`
  is counted as the app's Settings by a spec test: name others differently.
- Also built and committed with it: New Space (`SpaceService.Create`,
  `NewSpaceDialog`), the Files Add menu and fold, no trailing ellipsis on any
  label, a codebase sweep so comments never cite plans or milestones, and the
  restyle to the mockups: the `Dialog` frame (`subtitle`, `closable`,
  `actions`, `footer`, named sizes, `flush`, `headless`, `alert`), the status
  bar per side (`shell/status-context.ts`), and the dot grid
  (`canvas/grid.ts`). Refusals from Go carry a `code` worded in the frontend
  (`spaceMessage`).

### Milestone 7 findings (snapping), 2026-09-27

- **Gates green; not seen at a running window.** Plan
  `.claude/work/plans/07-snapping.md`. The exit tests (delete detaches, undo
  re-attaches) are in `commands.test.ts`.
- New setting `objectSnap` (off) in `internal/config`, and `objectSnap` on
  `menu.State`; bindings regenerated. Canvas ▸ Snap to Objects, `⌥S`, is a
  canvas-scoped checkbox. `canvas/snapping.ts` holds the rules;
  `canvas/scale.bench.test.ts` is a timing test, skipped unless `BAVA_BENCH`
  names a file for its numbers.

### Milestone 6.17 findings (code blocks, arrow labels, two bugs), 2026-09-27

- **Gates green; not seen at a running window.** Plan
  `.claude/work/plans/06-canvas.md` (part 6.17).
- `store.Stamp.ModifiedUnixNano` crosses IPC as a string (it was rounded in
  JavaScript: every second save said "changed on disk"). The bindings were
  regenerated (`wails3 generate bindings -f '' -clean=true -ts -i`).
- The webview's own right-click menu is cancelled window-wide except in text
  (`shell/native-menu.ts`); in a dev build Wails otherwise shows it, Reload and
  all.

### Milestone 6.16 findings (binding, heads, labels, the rest), 2026-09-27

- **Gates green; not seen at a running window.** Plan
  `.claude/work/plans/06-canvas.md` (part 6.16). Every inventory row is
  now same, built (06.14 to 06.16) or, for B22, kept by the `CLAUDE.md` rule.
- New settings `arrowBinding` and `midpointSnap` in `internal/config`
  (Settings ▸ Canvas). `--size-arrowhead`, `--size-dash`, `--size-dot` and
  `--size-binding-gap` are retired: heads, dashes and the gap are scene units
  in code (`arrows.ts`, `paint.ts`, `binding.ts`).

### Milestone 6.15 findings (points and creation), 2026-09-27

- **Gates green; not seen at a running window.** Plan
  `.claude/work/plans/06-canvas.md` (part 6.15); its rows are marked
  "built 06.15" in the lines inventory. 06.16 finishes it.
- New: closed lines (`closed`, `closed.ts`), line fill while closed, the
  last-used style (`current-style.ts`), the tool lock (`Q`), `⌘`/`Ctrl`+`Enter`
  as Canvas ▸ Edit Points, point marquee, Alt preview, duplicate points. A
  two-point curved arrow is straight; new arrows are curved and lines round.

### Milestone 6.14 findings (elbow segments, handles, cursors), 2026-09-27

- **Gates green; not seen at a running window.** Plan
  `.claude/work/plans/06-canvas.md` (part 6.14); the rows it built are
  marked "built 06.14" in `.claude/work/specs/excalidraw-lines-inventory.md`.
  06.15 (point editing P, creation C) and 06.16 (the rest) follow.
- Elbows: 40 padding, rounded corners (`pathOf`, used by stage, hit test and
  export), the 5% middle snap with dots, segments dragged and fixed
  (`fixedSegments`, `elbow-segments.ts`), a bound elbow not dragged by its
  body. Handles: padded bent-line box, hover disc, anchor discs, middles over
  labels, 7 px line hits. Cursors from `cursor.ts`. Code blocks grow taller.
- `canvas/style-defaults.ts` exists to break an import loop (style, binding,
  paint); import the defaults from there in drawing code.

### Milestone 6.13 findings (pinned ends, point editing, click-by-click), 2026-09-26

- **Gates green; not seen at a running window.** Plan
  `.claude/work/plans/06-canvas.md` (part 6.13), decisions 7 to 9 in
  `.claude/work/specs/06.12-arrows-and-code.md`.
- `startMode`/`endMode: "inside"` pins an end (a drop inside, or Alt);
  Cmd/Ctrl leaves it free, replacing Alt-means-free. Point-edit mode
  (double-click a line, Cmd/Ctrl+double-click an arrow, Enter); outside it,
  only two-point lines offer a middle. Click-by-click lines finish on the last
  point, Enter, Escape or a tool change.

### Milestone 6.12 findings (arrows like Excalidraw, resizable code), 2026-09-26

- **Gates green; not seen at a running window.** Plan
  `.claude/work/plans/06-canvas.md` (part 6.12), decisions in
  `.claude/work/specs/06.12-arrows-and-code.md`.
- Code blocks are resized and wrap (`code/wrap.ts`); a selected straight line
  or arrow or an elbow shows no box (`selection-chrome.ts`); point handles are
  5 px and hit within 11; elbows route around shapes (`elbow.ts`) with the
  route stored in `points`; 19 shortcuts dropped, Tab and `/` included.
- **Edit commands used to go to the document's source pane whatever had
  focus**: Paste in the Diagram from Code dialog went into the document,
  unseen. `SourcePane.containing` finds the focused pane.
- Checked in Excalidraw's code: its straight arrows also put an end on the
  facing side; only elbows keep the side it was dropped on.

### Milestone 6.11 findings (Diagram from Code dialog), 2026-09-26

- **Gates green; not seen at a running window.** Plan
  `.claude/work/plans/06-canvas.md` (part 6.11).
- `Dialog` has a `wide` size; `LayoutEnginePicker` exists; `render.Options`
  has `Direction`, appended to the source only when it sets none (never
  prepended, so diagnostics keep their lines). The document's own render now
  uses the configured engine, which the status bar names.
- **A parameter named `layout` in the render client shadowed its `layout`
  state**: every successful render wrote its geometry to the parameter and the
  dialog's Insert had nothing. Caught by existing tests; worth remembering.

### Milestone 6.10 findings (arrows you can shape), 2026-09-26

- **Gates green; not seen at a running window.** Plan
  `.claude/work/plans/06-canvas.md` (part 6.10), decisions in
  `.claude/work/specs/arrows.md`.
- **The file format gained three optional keys** (`startAnchor`, `endAnchor`,
  `labelPosition`) and bent lines and arrows (more than two points). Absent
  means the old behaviour; Go preserves them as it preserves any key.
- Targets are found by outline distance within `bindingReach(zoom)`
  (Excalidraw's 15 to 30 scene units); ends aim through their anchor at their
  neighbour; dragging an attached arrow's body lets go of shapes that stay,
  never of a detached id.

### Milestone 6.9 findings (code block and selection), 2026-09-26

- **Gates green; not seen at a running window.** Plan
  `.claude/work/plans/06-canvas.md` (part 6.9).
- A code block is never narrower than 20 columns (`docs/file-format.md`), and
  its editor grows as it is typed in: a new block used to clip everything
  past its first column.
- Selection changes on a press inside a selection wait for the release;
  `⇧`-move keeps to one axis, `⌥`-move copies, `⇧`+arrow nudges 5; Tab skips
  locked elements.
- `withContents` is the one expansion for frames and groups (copy and paste
  included); a frame resizes alone and lets go of what it no longer holds.
  Between equally tight frames an element keeps the one it records, else the
  top one: an unframed element moved into two equal frames used to join the
  first in the file, which can surprise a hand test.
- Movement under the drag threshold is a click from every press, in preview
  and on release; before, a press on an unselected element committed it.

### Milestone 6.8 findings (feel fixes), 2026-09-26

- **Gates green; not seen at a running window.** Plan
  `.claude/work/plans/06-canvas.md` (part 6.8), drawn from
  `.claude/work/specs/excalidraw-comparison.md` (a full read of Excalidraw at
  `5db42c3`, with a table of Bava bugs it found).
- **Absent `strokeWidth`/`fontSize` now draw at 2 and 20**, the file format's
  defaults; `--size-shape-stroke` and `--size-pen-stroke` are gone. Old test
  files with unsized free text were measured at 13 and now wrap at 20.
- Shape tools hand back to select with the new element selected; the pen and
  eraser stay on. The drag threshold is `--size-drag-threshold` / zoom.
- The scene layer does not listen, `render` skips unchanged elements, and a
  drag draws once per frame (`.ai/rules/canvas.md`).

### Milestone 6.1 findings (window check and launch), 2026-09-17

- **The first window check found three defects every test missed**: a
  "closed unexpectedly" notice after every quit, the shape menu stuck open,
  and a zero-height canvas (no rail, no drawing). Plan
  `.claude/work/plans/06-canvas.md` (part 6.1). Gates green; the
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
  not seen. Plan `.claude/work/plans/06-canvas.md` (part 6.2) lists
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

### Milestone 6.2.1 findings, 2026-09-18

- **Two Ark machines on one element need one id.** Spreading one trigger's
  props over another's leaves the second machine unable to find its element:
  no anchoring, no toggle. Pass the same `ids.trigger` to both roots and merge
  the props through nested `asChild` snippets.
- **Vite's hot update can break Svelte 5 snippets** (`invalid_snippet_arguments`
  in a panel that works after a full reload). Restart the app before believing
  a snippet error seen only in the dev window.

- **A feature invisible in tests can hide a second one.** The marquee was
  tracked during resizes since Milestone 5.5 and only became visible when 06.2
  drew it.
- **Ark triggers nest badly.** A tooltip around another Ark trigger would put a
  button inside a button; `Tooltip` takes a `trigger` snippet and passes Ark's
  `asChild` props through instead. Type that snippet as
  `TooltipTriggerProps['asChild']`, not a hand-written signature.
- Shift and Alt are drag-time state in `pointer.ts`; see `.ai/rules/canvas.md`.

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