---
name: build-step
description: The complete build process for Bava. Activate for any implementation work in this repo, named milestone or not.
---

# Build step

Bava's build process, self-contained: invoke no other build-discipline skill.
The sequence is `.claude/plan/roadmap.md`. Never skip a gate.

**Rules:** no behavior code without a failing test first; no fix without the
root cause; no completion claim without fresh verification output; no service
of ours; never run git write operations (the user commits).

## The loop

1. **Locate the milestone** from the roadmap and what exists in the tree. If ambiguous, ask.
2. **Read the specs** it lists and the relevant `docs/`. A spec that seems wrong: stop and raise it.
3. **Resolve holes** with the user, one question at a time, into `.claude/work/specs/<topic>.md`.
4. **File format:** a change to what Bava writes goes into `docs/file-format.md` before the code, with a round-trip test.
5. **UI:** check `.ai/rules/design-system.md` for an existing component, Ark primitive and tokens; new tokens go in `frontend/src/styles/tokens/` first. New or changed UI is drawn first: update the Bava Design System and add or change the screens in the Bava Mockup canvas (`docs/design.md`), and the user sees them before the plan.
6. **Plan** in `.claude/work/plans/<NN>-<name>.md`; wait for explicit approval before any code.
7. **Implement** task by task, test first per the table below, running affected tests after each.
8. **Sync artifacts** (checklist below) in the same change.
9. **Gates:** `go vet ./internal/... .`, `go test ./internal/... .`, `npm run check`, `npm run lint`, `npm test`; `npm run browser` when anything drawn or page behavior changes.
10. **Review:** dispatch `spec-reviewer` on the diff; verify each finding, push back on wrong ones.
11. **Report** what shipped, files, test counts, every deviation from spec. Then stop.

## Commands

| Purpose | Command |
|---|---|
| Go tests | `go test ./internal/... .` (one: `go test ./internal/<pkg> -run <Name>`) |
| Goldens | `go test ./internal/render -run Golden` (`-update` to regenerate) |
| Vet / format | `go vet ./internal/... .` / `gofmt -w .` |
| Svelte types / lint / tests | `npm run check` / `npm run lint` / `npm test` |
| Browser tests (Docker) | `(cd frontend && npm run browser)`, `-- --project=visual` or `integration` |
| Design system files | `(cd frontend && npm run design)`, then publish `designs/out/project/` |
| Accept screenshots | `(cd frontend && npm run browser:update)`, then open every changed image |
| Bindings | `wails3 generate bindings -f '' -clean=true -ts -i` after any bound Go change, comments included |
| Env check | `wails3 doctor` |

Go commands are scoped to `./internal/... .` because `frontend/node_modules` ships a Go package.

## What gets a failing test first

| Work | Approach |
|---|---|
| Pipeline, file I/O, IPC, parsing | Failing Go test from the spec first |
| File format | Failing round-trip test first, always |
| Diagram output | Golden fixture; read the SVG by eye before keeping it |
| Bindings, config, build scripts | Implement, then a contract test |
| Components | `check`, `lint`, a visual check, a keyboard pass |
| Anything drawn | Visual check; a new screen or dialog gets a test in `frontend/tests/visual/` |
| Canvas, editor wiring | Tests where logic exists (coordinates, staleness, debounce, selection) |

Name the production change that would make a test fail; if you cannot, it asserts nothing.

## Plan format

```markdown
# <NN>: <Name>
**Goal:** one sentence.  **Specs:** paths.
**File format impact:** or "none".  **UI impact:** or "none".
## Constraints    (values copied verbatim from the specs)
## Tasks
### Task N: <name>
**Files:** exact paths.  **Behavior:** from the spec.
- [ ] Failing test: <name>; expected failure: <why>
- [ ] Implement
- [ ] Green: `<exact command>`
## Artifacts
## Out of scope
```

No placeholders or "TBD". Each plan ends with an "As built" section.

## Debugging

Root cause, then pattern (a working equivalent here, every difference listed),
then one testable hypothesis, then a failing test and the fix. After three
failed fixes, stop: the model is wrong. A measurement that agrees with you on
the first try: check the instrument.

## Verification gate

Run the proving command fresh and in full, read the whole output, judge by
exit code (`npm test` can fail with every test passed).

| Claim | Requires |
|---|---|
| Tests pass / types / lint | That command's output this session, exit 0 |
| Goldens clean | Golden run, changed SVGs read by eye |
| Bug fixed | The original failing test, now green |
| Component done | Keyboard pass, both themes |
| Visual behavior | `npm run browser` green, every changed screenshot read in both themes; CI end-to-end for anything crossing into Go |
| Spike cleaned up | Diff shown, dependency gone from `package.json`, lockfile and `node_modules` |
| Cross-platform | CI matrix result, never a local build |
| Subagent finished | Its diff, read |

## Artifact checklist

- File format changed: `docs/file-format.md` and a round-trip test
- IPC method added or changed: `docs/ipc.md`
- New component: inventory in `.ai/rules/design-system.md`
- Colour token used by the diagram: the Go theme mapping
- D2, Wails, Svelte or Ark bump: goldens re-run and read; versions below
- New shortcut: `docs/shortcuts.md`
- New user-facing string: `frontend/src/i18n/messages.ts`
- Durable convention: a rule in `.ai/rules/`, registered in `index.md`
- Closed open question: dated row in `docs/decisions.md`
- Gate change: the repo state below

## Red flags

| Thought | Reality |
|---|---|
| "I'll write the tests after" | A test written after proves nothing |
| "The golden changed, regenerate it" | Look at the SVG first |
| "Should pass now" | Run the command |
| "The spec is unclear, I'll pick" | Raise it |
| "The canvas as a Svelte component" | The documented performance trap |
| "localStorage for now" | Document state lives in files |
| "A hardcoded colour or z-index" | Tokens and `--z-*` layers only |
| "Ark directly, just this screen" | Wrap it in `components/` |

## Current repo state

What is true now and affects the gates. Update it when a milestone closes.

**Position:** R1 done (repository `tharabyte/bava`; adapted canvas code
attributed in `NOTICE` for good). R2 done (the stores' sandboxes: the same walks pass inside the Mac sandbox,
the installed MSIX and Flatpak, run 38143080459). 15.3 done (import;
its walk passes on all three systems and inside each store's package, run
38197233990). 15.4a (zoom to fit, labels that fit, drags the system ends)
built, awaiting CI. Next 15.4b (palette), 15.4c (paste), 15.4d (shapes),
Milestone 16, Milestone 17. Help ▸ Report Issue
is hidden until release (`REPORT_ISSUE_ENABLED` in
`frontend/src/shell/report-issue.ts`); the DMG icon and background stay
Wails-branded until release.

**Toolchain:** module `github.com/tharabyte/bava`, Go 1.27.1; D2 `v0.9.0`
(TALA in-library); Wails `v3.0.0-beta.28`, `@wailsio/runtime` pinned exactly
to `3.0.0-beta.28`; Node 24 (`.nvmrc`); Ark UI `5.24.2`, Konva `10.5`, Vitest
`5.0.1` with jsdom (`resolve.conditions: ['browser']` is required); pdfcpu
`v0.16.1`, stateless mode.

**How tests run:** Go, vitest, check, lint and build on the host. Browser
tests only in Docker (`tests/scripts/browser.sh`; OrbStack must be running).
The real app only on CI: `-tags e2e` walks `tests/e2e/` (`create`, `reopen`,
`canvas`, `export-proof`, `import`) on all three platforms, and again inside each
store's package. Never `wails3 dev` locally.

**Gates:** all green on the host (go vet, go test 15 packages, 2 golden
fixtures, check, lint, `npm test` 3,003 passed); `npm run browser` 558 passed,
314 references in `testdata/visual/`; CI end-to-end green, inside each
store's package too. `npm run build`'s minifier rejects some CSS the browser
tests accept (WebKit-only selectors).

**Owed at a running window:** `docs/release-checklist.md`, the one list of
what only a person can check. A change that adds such a check adds its line
there, in the same change; a plan's As built points to it.

**Open problems:**
- Browser tests see WebKit in a container, not the real webviews.
- Media's Sort dropdown, picked by pointer, missed once under a full run (`dialogs.spec.ts`); 15 alone passed.
- A canvas embed's first save can leave the page unsaved, about 1 in 20 in `document.spec.ts`; not investigated.
- A floating menu's picture timing out in `placed` (`frontend/tests/helpers.ts`) is fixed locally; watch CI.

**Traps:**
- A modal Ark Dialog sets `pointer-events: none` on `body`, so the canvas looks broken.
- Headless WebKit can keep painting a menu's first state; assert rows from the page.
- WebKitGTK and WebView2 draw differently (`.ai/rules/canvas.md`, `.ai/rules/wails.md`).
- `go build .` drops a `bava` binary in the repo root; build into `bin/`.
- A Wails call's own `cancel()` drops Go's answer: stop a long task by name (`.ai/rules/wails.md`).
- A test's `KeyboardEvent` needs `cancelable: true`, or `preventDefault` does nothing and a dialog closes.
- `no-literals.test.ts` reads `#faded` as a hex colour, comments included.
- Svelte snippet names share scope with script variables.
- `d2lib.Compile` stack traces usually mean a missing `d2log.With` logger.
- A flickering diagram is an out-of-order IPC response; check the request id.
- `.gitattributes` forces LF so goldens compare across platforms; never relax it.
