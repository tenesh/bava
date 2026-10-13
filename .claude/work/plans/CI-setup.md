# CI setup in one place

**Goal:** the setup every job repeats lives in one action, and every job is
named one way, the same word in its id, its shown name and its download.
**Specs:** `.claude/plan/roadmap.md` ("CI setup in one place");
`docs/testing.md`.
**File format impact:** none. **UI impact:** none.

## Constraints

- "Move the setup every job repeats (checkout, Linux packages, Go, Node,
  `npm ci`) into `.github/actions/setup`."
- "Name every job one way, the same word in its id, its shown name and its
  artifact (`walks-<os>`, `store-walks-<os>`, `browser`, `release-check`; the
  build's download keeps `bava-<os>-<commit>`), with `docs/testing.md` and
  the build skill to match."
- "Exit: green on all three systems."
- No branch protection names a job today (checked), so renaming breaks no
  required check.

## How it works

- **`.github/actions/setup/action.yml`**, a composite action, takes what a
  job needs and does it in one order:
  - `webview` (Linux only): the GTK 4 and WebKitGTK 6 packages, with the
    pkg-config check that fails clearly; `packages`: any more a job needs
    (`xvfb imagemagick fonts-dejavu-core`, Flatpak's); `userns`: lifts
    Ubuntu's AppArmor limit on user namespaces, for WebKit's and Flatpak's
    sandboxes.
  - `go` (default on): Go from `go.mod`, cached.
  - `node` (default on) and `install` (default on): Node from `.nvmrc`,
    npm's cache, `npm ci` in `frontend`.
  - `wails` (default off): the `wails3` CLI at the version `go.mod` pins,
    read from it rather than written twice.
  - The reasons now written beside each copy (GTK 4 not 3, why `userns`)
    are written once, there.
- **Checkout stays in each job**, as its first step: an action kept in the
  repository can only be run once the repository is checked out. The action
  does everything after it.
- **Jobs, one name each** (`<id>`: shown name, its download):
  - `test`: test (linux|macos|windows); none.
  - `build`: build (linux|macos|windows); `bava-<os>-<commit>` (kept).
  - `browser`: browser; `browser` (on a failure).
  - `walks`: walks (linux|macos|windows); `walks-<os>` (was `smoke run`,
    `smoke-<runner>`).
  - `store-walks-macos`, `store-walks-windows`, `store-walks-linux`: store
    walks (macos|windows|linux); `store-walks-<os>` (were `sandboxed run`,
    `packaged run`, `sandbox-<os>`).
  - `release-check`: release check (was `release bundle has no driver`).
  - The matrices name systems `linux`, `macos`, `windows`, each with its
    runner, so names never say `ubuntu-latest`.
- **Unchanged:** every step that tests anything, every runner, timeout and
  environment; the same work in the same order.

## Tasks

### Task 1: The setup action
**Files:** `.github/actions/setup/action.yml` (new).
- [ ] Write it; check it with `actionlint` (run once with `go run`, not
  installed).

### Task 2: The jobs use it, named one way
**Files:** `.github/workflows/ci.yml`.
- [ ] Every job checks out, then calls the action with what it needs; the
  repeated steps go.
- [ ] Ids, shown names and downloads as above.
- [ ] `actionlint` clean; the diff read step by step against the old file,
  each test step still there.

### Task 3: Docs and the build skill
**Files:** `docs/testing.md`, `.claude/skills/build-step/SKILL.md`.
- [ ] The jobs by their new names; the CI section of the skill's repo state
  and the commands that watch a run.

### Verification
- [ ] CI green on all three systems, every job shown by its new name and
  every download named as above (read from the run's job and artifact lists).

## Artifacts

- `docs/testing.md`: job names, downloads.
- `.claude/skills/build-step/SKILL.md`: the position line, the open
  problems naming jobs.
- `docs/decisions.md`: none (no decision changed).

## Out of scope

Caching beyond what setup-go and setup-node do; any change to what a job
tests; the Flathub manifest (never touched).

## As built

- `.github/actions/setup` takes `webview`, `packages`, `userns`, `go`,
  `node`, `install` and `wails`. `install` was added beyond the plan: the
  build, walk and store jobs set Node up but never ran `npm ci` themselves
  (`wails3 build` installs), and still do not.
- The `wails3` CLI's version is read from `go.mod` (`go list -m`), the same
  `v3.0.0-beta.28` as before.
- Store walks Linux adds Flathub as its own step after the setup.
- Checked with actionlint v1.7.7 (run through `go run`, which also checks
  every job's inputs against the action's), and by comparing every step's
  name and command with the old file: only setup steps went; one step is
  renamed "run the walks".
- The browser job uses no setup: it runs everything in its container.
- Two small differences in order: in `walks`, the macOS screenshot
  permission is granted after the setup rather than before; `store walks
  (linux)` now runs the webview packages' pkg-config check, which the old
  job skipped. Neither changes what is tested.
- The `wails3` step fails clearly if a job asks for it with Go off.

