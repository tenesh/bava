# R1: The move to Tharabyte

**Goal:** Bava lives at `tharabyte/bava` under Tharabyte's name, says how
it is made, and names no other app, before 15.3.
**Specs:** `.claude/work/specs/release.md` decisions 1 to 6 (2026-10-11);
CLAUDE.md; `docs/decisions.md`; the roadmap's Milestone 16 ("The
publisher's name").
**File format impact:** none. Nothing Bava writes names the app ID or the
module; the settings' folder is checked in R1a (below).
**UI impact:** none drawn but the About screen's `NOTICE` text.

## Constraints

- The user does every git step: the transfer on GitHub before R1a's code,
  and the history rewrite after R1b, with commands prepared for them.
- The app ID is fixed at `com.tharabyte.bava`; the publisher is
  "Tharabyte"; `NOTICE` says "Copyright 2026 Tharabyte".
- What stays named (decision 6): Bava's dependencies, the operating
  systems, their webviews and stores, file formats and standards.

### Settled in this plan (say if you disagree)

1. **Two build steps, each committed and green on CI before the next:**
   R1a the rename (mechanical, every file), R1b the research removal, the
   rule and the AI disclosure (judgement, line by line).
2. **The AI disclosure is `AI.md` at the root**, linked from the README.
3. **Behaviour stays as built.** A decision that cited another app keeps
   its outcome and its date; only its reason is reworded in Bava's terms
   (what the user sees, why it is right for Bava). A comment that named a
   source says what the code does.
4. **Where Bava keeps its settings**: if the folder's name comes from the
   old ID or the old owner, it moves to the new name and the old one is
   read once and moved, so nobody's settings are lost. If it comes from
   "Bava" alone, nothing changes.

## R1a: The rename

### Task 1: The Go module
**Files:** `go.mod`, every Go import, `frontend/bindings/` (regenerated),
the frontend's imports of the bindings, `docs/ipc.md`, the build skill's
toolchain lines.
- [ ] `go mod edit -module github.com/tharabyte/bava`, imports rewritten,
  bindings regenerated; nothing under `frontend/bindings/github.com/tenesh`
- [ ] Green: every gate

### Task 2: The app ID and publisher
**Files:** `build/config.yml` and the files made from it (`Info.plist`,
`Info.dev.plist`, `info.json`, the MSIX manifests, NSIS, `wails.exe.manifest`,
`nfpm.yaml`), `internal/app/metadata_test.go` (pinning them), `NOTICE`,
`README.md`, the roadmap's "publisher's name" paragraph (closed).
- [ ] Failing test first: the metadata test pins `com.tharabyte.bava`,
  "Tharabyte" and the copyright in every platform file
- [ ] Implement; Green: every gate; `wails3 build` on CI for all three

### Task 3: The settings' folder
**Files:** `internal/config` (+ test), `docs/file-format.md` if it names
the folder.
- [ ] Read where the folder's name comes from; if it changes, a failing
  test that the old folder's settings are moved on first launch
- [ ] Green: `go test ./internal/config`

## R1b: No other apps, and the AI disclosure

### Task 4: The studies and every mention
**Files:** delete `.claude/work/specs/research/`; reword every other
mention (by count today: Excalidraw in 78 files, 42 under
`frontend/src/canvas`; also Notion, Eraser, Obsidian, Miro, tldraw, Figma,
Google Docs, and browsers' own features), including test names and
CLAUDE.md's opening ("Eraser.io in spirit").
- [ ] A test, failing first: no tracked file outside `frontend/node_modules`
  and the licence texts names a listed product
- [ ] Reworded file by file; behaviour unchanged (every gate green, no
  picture changed)

### Task 5: The rule
**Files:** CLAUDE.md (a short non-negotiable), `.ai/rules/` (a rule with
the list and what stays named), its index row, the spec-reviewer's checks.

### Task 6: The AI disclosure
**Files:** `AI.md`, `README.md` (a line linking it).

### Task 7: The history (prepared, run by the user)
**Files:** none in the repo: the `git filter-repo` commands, in the report,
that remove `.claude/work/specs/research/` from every commit and replace
the listed names in old file contents and commit messages; a check to run
before the force-push; the note that GitHub support can purge cached
views.

## Artifacts

`docs/decisions.md` (decisions 2 to 6 of `release.md`); `docs/ipc.md`;
`docs/testing.md` if a test is added there; CLAUDE.md; `.ai/rules/`; the
build skill's repo state; the roadmap (R1 before 15.3).

## Out of scope

- The store and sandbox spec (next, before 15.3).
- Store builds, signing and listings (Milestone 16).
