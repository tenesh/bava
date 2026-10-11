# R1: The move to Tharabyte

**Goal:** Bava lives at `tharabyte/bava` under Tharabyte's name, says how
it is made, and names no other app, before 15.3.
**Specs:** `.claude/work/specs/release.md` decisions 1 to 6 (2026-10-11);
CLAUDE.md; `docs/decisions.md`; the roadmap's Milestone 16 ("The
publisher's name").
**File format impact:** none. Nothing Bava writes names the app ID or the
module; the settings' folder is checked in R1a (below).
**UI impact:** none.

## Constraints

- The user does every git step: the transfer on GitHub before R1a's code,
  (the history is not rewritten: decided 2026-10-11, below).
- The app ID is fixed at `com.tharabyte.bava`; the publisher is
  "Tharabyte"; `NOTICE` says "Copyright 2026 Tharabyte".
- What stays named (decision 6): Bava's dependencies, the operating
  systems, their webviews and stores, file formats and standards.

### Settled in this plan (say if you disagree)

1. **Two build steps, each committed and green on CI before the next:**
   R1a the rename (mechanical, every file), R1b the research removal, the
   rule and the AI disclosure (judgement, line by line).
2. **The AI disclosure is `AI-DISCLOSURE.md` at the root**, linked from the README.
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
- [x] `go mod edit -module github.com/tharabyte/bava`, imports rewritten,
  bindings regenerated; nothing under `frontend/bindings/github.com/tenesh`
- [x] Green: every gate

### Task 2: The app ID and publisher
**Files:** `build/config.yml` and the files made from it (`Info.plist`,
`Info.dev.plist`, `info.json`, the MSIX manifests, NSIS, `wails.exe.manifest`,
`nfpm.yaml`), `internal/app/metadata_test.go` (pinning them), `NOTICE`,
`README.md`, the roadmap's "publisher's name" paragraph (closed).
- [x] Failing test first: the metadata test pins `com.tharabyte.bava`,
  "Tharabyte" and the copyright in every platform file
- [x] Implement; Green: every gate
- [x] `wails3 build` on CI for all three

### Task 3: The settings' folder
**Files:** `internal/config` (+ test), `docs/file-format.md` if it names
the folder.
- [x] Read where the folder's name comes from; if it changes, a failing
  test that the old folder's settings are moved on first launch
- [x] Green: `go test ./internal/config`

## R1b: No other apps, and the AI disclosure

### Task 4: The studies and every mention
**Files:** delete `.claude/work/specs/research/`; reword every other
mention of another product (about a hundred files, most of them under
`frontend/src/canvas`, the specs, the plans and `docs/decisions.md`),
including test names and CLAUDE.md's opening line.
- [x] A test, failing first: no tracked file outside `frontend/node_modules`
  and the licence texts names a listed product
- [x] Reworded file by file; behaviour unchanged (every gate green, no
  picture changed)

### Task 5: The rule
**Files:** CLAUDE.md (a short non-negotiable), `.ai/rules/` (a rule with
the list and what stays named), its index row, the spec-reviewer's checks.

### Task 6: The AI disclosure
**Files:** `AI-DISCLOSURE.md`, `README.md` (a line linking it).

### Task 7: The history: not rewritten (decided 2026-10-11)
Commands to rewrite it were prepared, then the user chose to keep the
history as it is: what it holds is ordinary comparison and study, the
repository was already public (caches and clones keep old commits
whatever is rewritten), and a rewrite changes every commit's id. What
matters instead is whether any code was adapted from another project,
which its licence would require attributing in `NOTICE`; that is checked
separately.

## Artifacts

`docs/decisions.md` (decisions 2 to 6 of `release.md`); `docs/ipc.md`;
`docs/testing.md` if a test is added there; CLAUDE.md; `.ai/rules/`; the
build skill's repo state; the roadmap (R1 before 15.3).

## Out of scope

- The store and sandbox spec (next, before 15.3).
- Store builds, signing and listings (Milestone 16).

## As built: R1a (2026-10-11)

The module is `github.com/tharabyte/bava` in `go.mod`, every Go import,
the regenerated bindings (`frontend/bindings/github.com/tharabyte/`), the
frontend's imports and test mocks, the browser stand-in's match on the
bindings' path, the end-to-end driver's service name, the issue tracker's
address and the docs. The roadmap's history rows keep the old name, as
history. The app ID `com.tharabyte.bava`, the publisher and the copyright
"© 2026 Tharabyte" are in the ten platform files under `build/`, all ten
pinned by a test that also refuses the old owner's name; `NOTICE` reads
"Copyright 2026 Tharabyte". The README names neither, so it is unchanged.
The template's leftovers beside the new name went too: "A bava
application" is now "Diagrams and documents, on your own disk.", the
Linux package's licence is Apache-2.0 (it said MIT) and its homepage the
repository (it said wails.io); the template test refuses them.

**Deviations:** Task 3 needed no code: the settings folder is
`<config>/bava`, the logs `Bava` or `bava`, named after the app alone, so
nothing moves. On macOS the webview keeps a page's browser storage by app
ID, so its conveniences (the last Space, the panes' layout) start afresh
under the new ID; nothing of the user's work is there, and nothing is
released yet.

**Review** (spec-reviewer): no blockers. Fixed: a CI box ticked early; the
tenth platform file, NSIS's defaults, added to the test; the macOS
webview storage noted; the template's licence, homepage and description;
the plan's UI impact and README claims.

**Checks:** Go vet and tests (Windows vet with `-tags e2e`), `npm test`
(2,871 passed), check, lint, `npm run browser` 513 passed twice. The test
pinning the platform files was seen failing first (29 lines missing).
CI green at the new address (run 38109056864): the three builds and the
walks, the driver's renamed service included.

## As built: R1b (2026-10-11)

The studies under `.claude/work/specs/research/` are deleted. Every other
mention of another product, about a hundred files, now says what Bava does
in its own words: comments and test names across `frontend/src/canvas`
(only comment lines and test names changed there, checked by diff), the
other frontend files, the specs, the plans, `docs/decisions.md` and
`docs/file-format.md` with their fixture copies, `.ai/rules`, CLAUDE.md
(its opening line, and two new non-negotiables) and two Go comments.
Paths and function names from another app's source went with them.
Compatibility is said without brands ("other Markdown editors"); GitHub,
the dependencies, the systems, their webviews and Mermaid stay named.
`names_test.go` fails on the listed names in any file git would keep. Two
rules, `.ai/rules/own-words.md` and `.ai/rules/ai-disclosure.md` (no AI in
Flathub's manifest or submission, the disclosure kept true), are in the index and the spec-reviewer's checks.
`AI-DISCLOSURE.md` is at the root, linked from the README.

**Deviations**
- **`AI-DISCLOSURE.md`, not `AI.md`**: the name a store reviewer looks for.
- **Reasons written afresh.** Where a decision's only reason was another
  app, a reason in Bava's terms was written from context: `docs/decisions.md`
  rows 162, 166, 167, 177, 178, 183, 213 and 232; `arrows-and-code.md`
  decisions 13, 15 and 16; `arrows.md` 4 and 5; and a few comments (the
  bend minimum, entity-relation heads behind More, hover-disc opacity, the
  highlight clamp). Worth the user's reading.
- **"Eraser" as the other product** cannot be told from Bava's eraser tool
  by a pattern, so it is not in `names_test.go`; the mentions were found by
  reading and reworded (the shape set is now "the flowchart shapes D2 can
  produce").
- **The menu flake's cause found on the way** (the build skill's open
  problems): the settle wait asked a piece that had unmounted for its box
  and waited for it; it now asks briefly.

**Red first:** `names_test.go` failed on 899 lines before the rewording.
Its first version ignored case on the whole pattern and caught CSS's
`linear-gradient`; the flag now covers only the product names.

**Checks:** Go vet and tests (Windows vet with `-tags e2e`), `npm test`
(2,871 passed), check, lint, `npm run browser` 513 passed twice after the
settle fix (and once before it, then one menu flake). No em dash added.

**The history** (Task 7) is kept as it is, by the user's choice.

**Review** (spec-reviewer): no blockers. Fixed: two comments still cited
the other app's source paths and a function name; a code editor was named as the
model for autosave, the hidden folder and backups in eight places (now
guarded too); spreadsheet apps named where "a spreadsheet" says it; rows
for `release.md` decisions 5 and 6; the inventory row bounded to its 90
items, pointing at the plan that tracks them; the disclosure names
claude.ai for the design and says the rule checks are review agents'; the
disclosure rule says what the settings deny; the settle helper's timing
comment. Left to the user: whether naming sync services and the sibling
project counts, and the reasons written afresh (Deviations).

**CI:** green on all three systems (run 38112377554), first time.
