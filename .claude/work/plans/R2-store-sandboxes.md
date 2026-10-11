# R2: The stores' sandboxes

**Goal:** Bava works inside the Mac App Store's and Flathub's sandboxes and
the Microsoft Store's package, proven on CI with no paid account.
**Specs:** `.claude/work/specs/stores.md` decisions 1 to 4; the roadmap's R2.
**File format impact:** none. What Bava remembers about allowed folders is
Bava's own state, outside any Space (`docs/file-format.md` lists where).
**UI impact:** a quiet bar on a loose page asking for its folder; "Can't
open" and "Find it again" on a recent Space; "Outside this Space" on a
card. Existing components (`EmptyState`-style bar, `ConfirmDialog`, the
start screen's rows); strings in `messages.ts`.

## How each system grants access

| | Granted by | Kept across launches by |
|---|---|---|
| macOS (App Store) | the system's open and save dialogs, drops | a security-scoped bookmark Bava saves for each grant |
| Linux (Flathub) | the same dialogs, through the portal (Wails' GTK4 dialog uses it) | the portal, which keeps the grant; Bava keeps the path it returned |
| Windows (Microsoft Store) | nothing needed: the package runs with full trust | nothing needed |

The same code runs everywhere; where nothing is sandboxed, keeping a grant
does nothing.

## Settled in this plan (say if you disagree)

1. **Grants live in Bava's state folder** (`access.json` beside the
   settings), each a folder or file and its bookmark. Deleting it costs
   only having to choose folders again.
2. **The CI walks run the sandboxed app on folders inside its own
   container** (macOS) or under the sandbox's own home (Flatpak), which a
   sandboxed app may always reach. The system's dialogs cannot be clicked
   on CI, so the grant itself, a bookmark restoring access after a
   relaunch, and the portal are checked at a running window, listed in the
   As built.
3. **The Windows package is tested as installed**: CI makes a self-signed
   MSIX, installs it and runs the walks; settings and logs land in the
   package's own folders.

## Tasks

### Task 1: Grants, kept and restored
**Files:** `internal/access` (+ tests; macOS bookmarks through cgo, as
`internal/pdfprint` does), `internal/app` (the open and save paths call
it), `docs/file-format.md` (where `access.json` lives), `docs/ipc.md`.
- [x] Failing tests: a grant is saved for a chosen folder or file; restored
  on the next launch; a stale or missing one is reported, never silently
  dropped; on a system without a sandbox each is a no-op that always
  succeeds
- [x] Green: `go test ./internal/access ./internal/app`

### Task 2: A recent Space Bava can no longer reach (decision 2)
**Files:** `internal/app/space.go`, `frontend/src/components/StartScreen.svelte`,
`SpaceSwitcher.svelte`, `App.svelte`, `messages.ts`.
- [x] Failing tests: an unreachable recent Space reads "Can't open"; choosing
  it opens the folder dialog at its last place; picking it restores it;
  Remove still removes it

### Task 3: A loose page's folder (decision 1)
**Files:** `App.svelte`, a bar over the page, `messages.ts`.
- [x] Failing tests: a loose page showing something from its folder offers
  "Allow access to this folder"; allowing it loads them and is remembered

### Task 4: A file outside the Space (decision 3)
**Files:** `frontend/src/docs/card.ts`, `App.svelte`, `messages.ts`.
- [x] Failing tests: a card outside the Space reads "Outside this Space";
  opening it asks for that file once, then opens it

### Task 5: Sandboxed runs on CI
**Files:** `build/darwin/entitlements.plist` (App Sandbox, user-selected
files read-write, app-scoped bookmarks), the CI workflow (a sandboxed job
per system), `tests/e2e` (scratch folders the sandbox may reach).
- [x] macOS: the end-to-end build, ad-hoc signed with the sandbox
  entitlements, runs the walks (green 2026-10-11, run 38122540515, after
  Bava learned to keep its temporary files in the container and to know
  the sandbox by its container home)
- [x] Windows: a self-signed MSIX of it, installed, runs the walks (green
  2026-10-11, run 38141862243; the walk is named in `~/.bava-e2e`, written
  with a .NET call because `Set-Content` silently left no file)
- [x] Linux: a test-only manifest (`tests/flatpak/bava-ci.yml`, ID
  `com.tharabyte.bava.Devel`, never submitted) builds a Flatpak of it that
  runs the walks (green 2026-10-11, run 38143080459, first try)
- [x] Green: all three sandboxed jobs on CI (run 38143080459)

## Artifacts

`docs/file-format.md` (`access.json`), `docs/ipc.md`, `docs/testing.md`
(the sandboxed jobs), `.ai/rules/` (a short rule: every file Bava reaches
goes through `internal/access`), the build skill's repo state.

## Out of scope

Store accounts, real signing, listings and submission (Milestone 17); the
Flathub manifest itself (the owner's, at submission).

## As built (2026-10-11)

`internal/access` keeps what the user allows Bava to reach (`access.json`
beside the settings): a security-scoped bookmark inside the Mac App Store's
sandbox, the portal's path inside Flatpak, nothing anywhere else. Every
folder or file picked in a dialog or dropped is allowed through it. A
recent Space Bava cannot reach reads "Can't open: find it again"; a page on
its own asks for its folder in a bar over the page, its pictures waiting
meanwhile; a card for a file outside the Space reads "Outside this Space"
and asks for that file once. CI runs the same four walks inside each
store's package: `sandboxed run (macos)`, `packaged run (windows)`,
`sandboxed run (linux)`.

**Deviations**
- **The Mac sandbox needed two things the plan did not foresee:** temporary
  files must stay in the container (`access.UseContainerTemp`, called first
  in `main`), and a sandbox started from a shell has no
  `APP_SANDBOX_CONTAINER_ID`, so Bava also knows it by a home under
  `Library/Containers`.
- **A packaged Windows run gets no environment from the shell:** CI names
  the walk in `~/.bava-e2e` (`e2e.RunFile`). PowerShell's `Set-Content`
  left no file there and reported nothing, which cost four runs; the step
  now writes it with a .NET call and stops on any error. A run that cannot
  begin now logs why, since a package has no stderr anyone reads.
- **Inside Flatpak a walk lays itself out in the app's own folder**
  (`~/.var/app/<id>`, `e2e.SandboxHome`): the sandbox reaches nothing else
  in the home.
- **Screenshots are skipped inside a sandbox**, noted, never a failure: the
  Mac sandbox may refuse the tool and the Flatpak runtime has none.
- **Not done, with reasons:** the system's own dialogs cannot be clicked on
  CI, so the grant itself, a bookmark restoring access after a relaunch and
  the portal keeping a grant are checked by a person (below).

**Red first:** the store, keepers, `Reachable` and `Granted`, the three
UI states, `UseContainerTemp`, `RunFile`, `SandboxHome` and a moved
folder's bookmark were seen failing first. The entitlements and the MSIX
manifest (x64, `bava.exe` twice) are pinned by contract tests, the latter
seen failing on a changed architecture.

**Review** (spec-reviewer): pass, ten warnings. Fixed: a bookmark that
follows a moved folder now reaches it where it is now, not where it was;
the MSIX test pins the architecture and executable; a privacy test proves a
grant that cannot be kept logs no part of its path (seen failing when the
error was logged); the editor mounting rule, lost in the rules trim, is
back in `.ai/rules/editors.md`; an out-of-date answer about which recent
Spaces Bava can reach is dropped (no test: the race needs a slower stand-in
than the browser harness has; the guard is the effect's cleanup); the test
manifest asks for network, as a store build would for web cards; the
release checklist exists. Left, with reasons: a guard that a test manifest
never takes the real app ID (the settings deny edits to that file, and
`CLAUDE.md` forbids it); a check that the release Go binary carries no
walks (they sit behind the `e2e` build tag, which CI's release build never
sets).

**Pictures:** new `document/card--outside` and
`document/page--folder-access`, changed `start/screen--missing`, each in
both themes, read at the review. The start screen's picture also shows
"That folder is not a Space." in the status bar: reopening the last Space
at launch, when its folder is gone, says so as well as marking the row.
Older than R2, and left for the user to decide.

**Checks:** Go vet (with and without `-tags e2e`) and tests exit 0;
`npm test` 2,880 passed, check and lint exit 0; `npm run browser` 521
passed, 300 references; CI green on every job, the three sandboxed runs
included (run 38143080459).

**Owed at a running window**, on each store's build: listed under "Store
sandboxes" in `docs/release-checklist.md`.
