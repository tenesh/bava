# 03: App shell

**Goal:** The real tool window: four resizable regions, the
`Document | Both | Canvas` switcher, and the first design-system components.

**Specs:**
- `.claude/plan/roadmap.md`: Milestone 3
- `.ai/rules/design-system.md`: component rules, Ark usage, inventory, stacking
- `.ai/rules/svelte.md`: runes only; imperative libraries mounted in `onMount`
- Build-loop repo-state: the Ark portal spike, and Milestone 1's debts
- `~/Workspace/designs/bava/claude-design-v1` screens `3a`, `3b`, `2a`–`2d`.
  **Reference for appearance only.** Behaviour and storage come from the code
  and the rules.

**File format impact:** none. The only things written are per-viewer UI
conveniences (view mode, pane visibility, pane widths, theme choice) in
`localStorage`, inside try/catch, never document state.

**UI impact:** this is the milestone that opens `frontend/src/components/`.
Components added: `Icon`, `StatusBar`, `EmptyState`, `ViewSwitcher`, `Pane`,
`Splitter` (wrapping Ark), `Dialog` (wrapping Ark). Tokens added: none
expected; if a component needs a value no token provides, the token is added
to `tokens/` first, and any hover or pressed state is the first real instance
of the interaction tokens Milestone 2 deliberately deferred.

## Constraints

- **Wrap every Ark primitive before using it in a screen.** Screens import from
  `components/`, never from `@ark-ui/svelte`. Keep the compound
  `Root`/`Trigger`/`Content` structure inside the wrapper rather than
  flattening it.
- **Ark ships no z-index.** Measured 2026-09-16: dialog and tooltip content
  painted *below* a plain `position: fixed; z-index: 9999` element. Portalled
  content uses `--z-portal`, and there is **one portal root**, defined once in
  the shell.
- **Presentational only.** No IPC, no file access, no D2 knowledge inside
  `components/`.
- No literal values. `src/styles/no-literals.test.ts` fails the suite on any
  hex, rgb/hsl or px outside `tokens/`, comments included.
- Every interactive element is keyboard-navigable with a visible focus ring
  using `--color-focus-ring` and `--color-focus-halo`.
- Props typed, no `any`. Variants as string unions, never booleans that can
  combine illegally.
- Both themes checked before a component is called done.
- A `.svelte.ts` module holds shared state; no store library.

### Decisions taken in this plan

- **Window is 1280×800.** The design's artboard is 1280 wide and shows four
  regions at that width. 800 is the matching height; the current 1000×618 was
  the scaffold's.
- **The file tree pane exists but is empty.** Files arrive in Milestone 5, so
  the pane renders `EmptyState`. Ark's TreeView is wrapped then, not now,
  because a wrapper with no data to shape is a guess.
- **Settings is a dialog, not a route.** It also exercises the portal path this
  milestone has to prove.
- **Translations are a small in-house module**, not a library: a typed key map
  and a `t()` function. There is one locale and no plural or date formatting
  yet; a library would be weight without a use. The rule it satisfies is that
  no new user-facing string is hardcoded.

## Tasks

### Task 1: Ark UI, and proving the portal stacks
**Files:** modify `frontend/package.json`; create
`frontend/src/components/Dialog.svelte`,
`frontend/src/components/portal-root.ts`,
`frontend/src/components/dialog.test.ts`.
**Behavior:** install `@ark-ui/svelte`, wrap Dialog keeping its compound
structure, and define the single portal root. Content is stacked with
`--z-portal`.
- [x] Failing test: `TestDialogContentStacksAbovePageChrome`; mount a dialog
      over an element at a high z-index and assert the computed stacking puts
      content above it. Expected failure: no wrapper exists. **This is the test
      that would have caught the spike's finding.**
- [x] Failing test: `TestDialogRendersOutsideTheAppRoot`; portalled content is
      not inside `#app`
- [x] Implement
- [x] Green: `cd frontend && npm test`

### Task 2: Window size and native background
**Files:** modify `main.go`; create `internal/app/window_test.go`.
**Behavior:** 1280×800. The native window background is set from the theme
rather than the scaffold's hardcoded near-black, which currently fights
`color-scheme: light dark` and flashes dark for a light-theme user. Config, so
implement-then-pin.
- [x] Implement
- [x] Contract test: the window options carry the intended size, so a later
      edit that changes it is deliberate
- [x] Green: `go test ./internal/app && go vet ./internal/... .`

### Task 3: Translation layer
**Files:** create `frontend/src/i18n/messages.ts`, `frontend/src/i18n/t.ts`,
`frontend/src/i18n/t.test.ts`; modify `frontend/src/App.svelte`.
**Behavior:** a typed key map and `t(key)`. Milestone 1's two hardcoded
`aria-label` strings migrate here; they are the first user-facing strings in
the product and the roadmap records the contradiction they created.
- [x] Failing test: `TestReturnsTheMessageForAKey`
- [x] Failing test: `TestUnknownKeyIsATypeErrorNotARuntimeFallback` (the key
      type is the guard; a missing key must not compile)
- [x] Implement
- [x] Green: `cd frontend && npm test && npm run check`

### Task 4: Icon
**Files:** create `frontend/src/components/Icon.svelte`,
`frontend/src/components/icon.test.ts`.
**Behavior:** one wrapper so icon sizing is tokenised. Size as a string union
(`sm | md | lg`), never a raw number. No icon set is bundled yet (Milestone 9
does that), so this takes a path and renders it.
- [x] Failing test: `TestSizeResolvesFromTokens`
- [x] Implement
- [x] Green: `cd frontend && npm test`

### Task 5: Pane and Splitter
**Files:** create `frontend/src/components/Pane.svelte`,
`frontend/src/components/Splitter.svelte`,
`frontend/src/components/splitter.test.ts`.
**Behavior:** `Pane` is a titled region with the small-caps header the design
uses. `Splitter` wraps Ark's, keeping the compound structure. Widths are
per-viewer convenience: persisted in `localStorage` inside try/catch, falling
back to defaults when it throws.
- [x] Failing test: `TestPersistsPaneSizes`
- [x] Failing test: `TestFallsBackToDefaultsWhenStorageThrows`
- [x] Implement
- [x] Green: `cd frontend && npm test`

### Task 6: View switcher and shell layout
**Files:** create `frontend/src/components/ViewSwitcher.svelte`,
`frontend/src/shell/view.svelte.ts`, `frontend/src/shell/view.test.ts`,
`frontend/src/shell/Shell.svelte`; modify `frontend/src/App.svelte`.
**Behavior:** `Document | Both | Canvas`, wrapping Ark's SegmentGroup. The mode
drives which regions render; it persists like the pane sizes. Four regions
(files, document, canvas, AI), with the AI pane collapsible. `App.svelte` stops
being the layout and becomes the mount point.
- [x] Failing test: `TestDocumentModeHidesTheCanvas`
- [x] Failing test: `TestCanvasModeHidesTheDocument`
- [x] Failing test: `TestModePersistsAcrossReload`
- [x] Failing test: `TestAIPaneTogglesIndependentlyOfMode`
- [x] Implement
- [x] Green: `cd frontend && npm test`

### Task 7: StatusBar and EmptyState
**Files:** create `frontend/src/components/StatusBar.svelte`,
`frontend/src/components/EmptyState.svelte`, plus tests.
**Behavior:** `StatusBar` shows engine, node count and error count from the
render result, passed as props, because a component holds no IPC. `EmptyState`
is the shared empty treatment; the file pane is its first use.
- [x] Failing test: `TestShowsErrorCountWhenCompileFails`
- [x] Implement
- [x] Green: `cd frontend && npm test`

### Task 8: Settings dialog, Appearance section
**Files:** create `frontend/src/settings/SettingsDialog.svelte`,
`frontend/src/settings/settings.test.ts`.
**Behavior:** the shell later milestones add sections to. Appearance is the
first, wired to the existing `theme.svelte.ts`: light, dark, follow system.
- [x] Failing test: `TestChoosingDarkSetsTheDocumentTheme`
- [x] Implement
- [x] Green: `cd frontend && npm test`

### Task 9: Keyboard and focus
**Files:** modify the components above; create
`frontend/src/components/focus.test.ts`.
**Behavior:** every interactive element reachable by tab, with a visible ring
built from `--color-focus-ring` and `--color-focus-halo`. This also pays
Milestone 1's debt: click-on-node jump-to-source was wired with no keyboard
equivalent, because the focus tokens did not exist yet.
- [x] Failing test: `TestNodeSelectionIsReachableByKeyboard`
- [x] Implement
- [ ] Manual keyboard pass per component: tab order, escape, arrow keys (**not done: needs a human at the window**)
- [ ] Check both themes per component (**not done: needs a human at the window**)
- [x] Green: `cd frontend && npm run check && npm run lint && npm test`

## Artifacts

- `.ai/rules/design-system.md`: every new component added to the inventory in
  the same change
- `docs/shortcuts.md`: created if this milestone adds a shortcut; otherwise
  Milestone 10 creates it
- `docs/decisions.md`: window size, settings-as-dialog, the in-house
  translation module, and any interaction token this milestone is first to need
- Build-loop repo-state: Milestone 3 closed, Ark's version recorded, the
  `main.go` background debt cleared
- `.claude/plan/roadmap.md`: Milestone 3 marked complete

## Out of scope

- The canvas itself: Milestone 4. The canvas region renders `EmptyState`.
- Ark's TreeView and any real file list: Milestone 5.
- Diagram elements: Milestone 6.
- Every settings section except Appearance. Files, AI Providers and Updates
  arrive with the milestones that own them.
- The AI pane's contents: Milestone 11. The pane and its toggle exist; what
  goes in it does not.


## Completion record: 2026-09-17

76 frontend tests, every gate green, and the app launches at 1280×800.

**Two boxes are deliberately unticked.** The manual keyboard pass and the
both-themes check need someone looking at a running window: jsdom does not
paint and does not resolve `var()`, and screen capture is unavailable in this
environment. A test now fails any component that has interactive elements and
no `:focus` rule built from `--color-focus-ring`, which catches an absent focus
treatment but cannot judge whether the ring is good.

**One task was moved rather than done.** Task 9's Milestone 1 debt (a keyboard
path for click-on-node jump-to-source) now belongs to Milestone 4. Paying it
here meant building selection over the interim canvas that Milestone 4
replaces. Approved 2026-09-17.

**Two real bugs the tests caught:**

- The first Shell rendered document and canvas regions conditionally, so a view
  switch would unmount CodeMirror and take its undo history and cursor with it.
  Both regions are now always rendered and hidden with CSS, with a test
  asserting the editor node is the *same node* after a switch.
- `App.svelte`'s cleanup read `canvasHost` after Svelte had nulled it:
  `bind:this` is cleared when the snippet's DOM is torn down, before the
  parent's cleanup runs. The hosts are captured at mount now.

**A rule was found out of step with the code:** `design-system.md`'s stacking
table listed a `--z-sticky` that `_z.scss` never defined and omitted three that
it does. Reconciled in favour of the code.
