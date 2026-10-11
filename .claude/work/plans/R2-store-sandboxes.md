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
- [ ] Failing tests: a grant is saved for a chosen folder or file; restored
  on the next launch; a stale or missing one is reported, never silently
  dropped; on a system without a sandbox each is a no-op that always
  succeeds
- [ ] Green: `go test ./internal/access ./internal/app`

### Task 2: A recent Space Bava can no longer reach (decision 2)
**Files:** `internal/app/space.go`, `frontend/src/components/StartScreen.svelte`,
`SpaceSwitcher.svelte`, `App.svelte`, `messages.ts`.
- [ ] Failing tests: an unreachable recent Space reads "Can't open"; choosing
  it opens the folder dialog at its last place; picking it restores it;
  Remove still removes it

### Task 3: A loose page's folder (decision 1)
**Files:** `App.svelte`, a bar over the page, `messages.ts`.
- [ ] Failing tests: a loose page showing something from its folder offers
  "Allow access to this folder"; allowing it loads them and is remembered

### Task 4: A file outside the Space (decision 3)
**Files:** `frontend/src/docs/card.ts`, `App.svelte`, `messages.ts`.
- [ ] Failing tests: a card outside the Space reads "Outside this Space";
  opening it asks for that file once, then opens it

### Task 5: Sandboxed runs on CI
**Files:** `build/darwin/entitlements.plist` (App Sandbox, user-selected
files read-write, app-scoped bookmarks), the CI workflow (a sandboxed job
per system), `tests/e2e` (scratch folders the sandbox may reach).
- [ ] macOS: the end-to-end build, ad-hoc signed with the sandbox
  entitlements, runs the walks
- [ ] Windows: a self-signed MSIX of it, installed, runs the walks
- [ ] Linux: a test-only manifest (`tests/flatpak/bava-ci.yml`, ID
  `com.tharabyte.bava.Devel`, never submitted) builds a Flatpak of it that
  runs the walks
- [ ] Green: all three sandboxed jobs on CI

## Artifacts

`docs/file-format.md` (`access.json`), `docs/ipc.md`, `docs/testing.md`
(the sandboxed jobs), `.ai/rules/` (a short rule: every file Bava reaches
goes through `internal/access`), the build skill's repo state.

## Out of scope

Store accounts, real signing, listings and submission (Milestone 17); the
Flathub manifest itself (the owner's, at submission).
