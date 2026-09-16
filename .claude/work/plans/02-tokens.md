# 02: Design tokens and theming

**Goal:** A semantic token layer and light/dark theming, so component work can
start in Milestone 3 without a literal value anywhere.

**Specs:**
- `.claude/plan/roadmap.md` — Milestone 2
- `.ai/rules/design-system.md` — token rules, density, the theme/diagram split
- `.ai/rules/canvas.md` — bundled fonts; diagram tokens are a separate layer
- `~/Workspace/designs/bava/claude-design-v1/Bava Mockups.dc.html` — the
  palette. **Reference for appearance only**: behaviour and storage come from
  the code and the rules, never from a mockup caption.
- Build-loop repo-state — the Ark portal finding that `--z-*` exists to fix

**File format impact:** none. Milestone 2 writes nothing to disk except the
theme choice, which is a per-viewer UI convenience in `localStorage` inside
try/catch — never document state.

**UI impact:** no components. `frontend/src/components/` stays empty until
Milestone 3; this milestone is what makes it legal to start.

## Constraints

Copied from the specs, values verbatim:

- Tokens are CSS custom properties, authored in SCSS under
  `frontend/src/styles/tokens/`, emitted on `:root`, redefined under
  `:root[data-theme="dark"]`, with `data-theme` set on `<html>`.
- **Colour tokens are semantic, never literal.** `--color-surface-raised`, not
  `--color-gray-100`. Literal scales may exist as private SCSS variables
  feeding the semantic layer; nothing outside `tokens/` may reference them.
- **No component writes a literal value.** No hex, no `px` outside the token
  files, no one-off shadows.
- Density: base font size **13px**, spacing unit **4px**. Desktop, not web.
- Fonts are bundled and referenced via `@font-face`, never relied on from the
  system.
- `--z-*` must cover portal layers. Measured 2026-09-16: Ark ships no z-index
  of its own and portalled content painted *below* a plain
  `position: fixed; z-index: 9999` element.
- The `diagram-*` group is a separate layer. A diagram's SVG is rendered in Go
  and does not inherit CSS, so a theme change must update both — chrome via
  custom properties, every diagram element via a re-render.

### The palette, verbatim from the design

25 chrome tokens and 7 diagram tokens, light then dark:

```
surface                #f7f7f5  #191a1c      text-primary    #1b1b19  #e6e6e3
surface-raised         #ffffff  #202226      text-secondary  #55554f  #a2a49f
surface-sunken         #efefec  #131416      text-muted      #8a8a83  #71746f
surface-overlay        #ffffff  #24272b      text-faint      #7d7d76  #8a8d88
surface-nav            #f2f2ef  #151619      accent          #2f6ba3  #7fabd9
border-subtle          #e2e2dd  #2b2d31      accent-contrast #ffffff  #10161c
border-strong          #cbcbc4  #3c3f45      focus-ring      #2f6ba3  #7fabd9
border-hairline        #f1f1ee  #232529      danger          #b3271c  #e57a6d
canvas-bg              #efefec  #131416      ok              #4a7c59  #8fb89a
canvas-dot             #d4d4cd  #33373c      note-fill       #f8f2dc  #33301f
                                             note-border     #e8dfba  #4a4630

accent-subtle   rgba(47,107,163,.07)  rgba(127,171,217,.14)
selection       rgba(47,107,163,.18)  rgba(127,171,217,.22)
danger-subtle   rgba(179,39,28,.06)   rgba(229,122,109,.10)
backdrop        rgba(20,20,18,.45)    rgba(10,11,12,.58)

diagram-bg              #ffffff  #1b1c1f    diagram-node-stroke  #a8a8a0  #4a5058
diagram-container-fill  #f4f4f1  #1e2023    diagram-label        #25251f  #dcdcd8
diagram-node-fill       #ffffff  #262a2f    diagram-edge         #8b8b83  #7f857f
                                            diagram-edge-label   #7d7d76  #8b8f8a
```

Type: Geist 13px body, 12.5px controls, 11.5px meta, 10px section labels.
Geist Mono 12px source, 11px status, 10px chips.

Space: 4px unit. Rows 22 / 26 / 28px. Toolbars 32px. Title bar 36px. Status
bar 24px.

Shadows: `shadow-overlay` `0 18px 48px rgba(0,0,0,.14)` light,
`rgba(0,0,0,.60)` dark. `shadow-floating` `0 6px 20px rgba(0,0,0,.10)` light,
`rgba(0,0,0,.50)` dark.

Focus ring: 1px accent border plus a 2px halo at 22–25% accent. Inside dense
rows, `outline-offset: -2px` instead.

### Gaps the design does not cover

Checked every colour used in the mockups against the declared tokens: 127
distinct colours, 72 of them undeclared. Three categories, and each is handled
differently:

1. **Interaction states.** A light-grey family (`#dcdcd5`, `#cfcfcb`,
   `#e6e6e1`, `#e9e9e5`) and a dark counterpart (`#34373c`), used for hover and
   pressed. Derived here as `--color-surface-hover` and
   `--color-surface-active`, values taken from the most-used member of each
   family rather than invented.
2. **The focus halo.** `rgba(47,107,163,.22)` / `rgba(127,171,217,.25)` appear
   in the mockups and are described in the sheet's prose but never named.
   Becomes `--color-focus-halo`.
3. **The element colour palette.** `#c9a15e` and similar appear as 18px
   swatches in a picker. That is *content* colour a user picks for a shape.
   It belongs in the scene file per element and **must not** be tokenised.

Absent entirely and decided here: radius scale, motion, z-layers, and
`warning`. Each derivation is recorded in `docs/decisions.md` so the next
reader knows it came from us rather than the design.

## Tasks

### Task 1: SCSS toolchain
**Files:** modify `frontend/package.json`; create
`frontend/src/styles/index.scss`.
**Behavior:** `sass` added as a devDependency so Vite compiles `.scss`. A
single entry stylesheet imports the token partials and is imported once from
`main.ts`. Declarative scaffolding — implement, then pin.
- [x] Implement
- [x] Green: `cd frontend && npm run build` and the compiled CSS contains
      `--color-surface`

### Task 2: The token partials
**Files:** create `frontend/src/styles/tokens/_color.scss`, `_space.scss`,
`_type.scss`, `_radius.scss`, `_elevation.scss`, `_motion.scss`, `_z.scss`.
**Behavior:** every token above emitted on `:root`, and every colour token
redefined under `:root[data-theme="dark"]`. Literal hex values live in private
SCSS variables inside `_color.scss`; the semantic layer references them.
Derived values from the gaps section included, each with a comment saying it
was derived and why.
- [x] Implement
- [x] Contract test `tokens.test.ts`: every colour token defined on `:root` has
      a counterpart under `[data-theme="dark"]`. **This is the test that fails
      if someone adds a light value and forgets the dark one** — the most
      likely error in this milestone.
- [x] Contract test: the token names match the design sheet exactly, so a
      rename is a deliberate act rather than a typo.
- [x] Green: `cd frontend && npm test`

### Task 3: Type tokens take over from the interim stylesheet
**Files:** modify `frontend/public/style.css`, `frontend/src/styles/tokens/_type.scss`.
**Behavior:** `@font-face` for Geist and Geist Mono, the family stacks and the
13px base move into `_type.scss`. `public/style.css` keeps only what must load
before the app does. This clears two debts named in Milestone 1's comments.
- [x] Implement
- [x] Green: `cd frontend && npm run build`, and the fonts still resolve —
      `dist/` contains the woff2 files and the compiled CSS references them

### Task 4: Theme state
**Files:** create `frontend/src/styles/theme.svelte.ts`,
`frontend/src/styles/theme.test.ts`; modify `frontend/src/App.svelte`.
**Behavior:** three states — light, dark, follow-system. The resolved theme is
written to `data-theme` on `<html>`. The choice persists in `localStorage`
inside try/catch; a throw or missing value falls back to follow-system.
Follow-system tracks `prefers-color-scheme` changes live.
- [x] Failing test: `TestResolvesSystemPreferenceWhenFollowing` — expected
      failure: module does not exist
- [x] Failing test: `TestExplicitChoiceOverridesSystem`
- [x] Failing test: `TestUnavailableLocalStorageFallsBackToSystem` — a throwing
      `localStorage` must not break theming, which is the failure mode the
      try/catch rule exists for
- [x] Failing test: `TestSystemChangeUpdatesResolvedThemeWhileFollowing`
- [x] Implement
- [x] Green: `cd frontend && npm test`

### Task 5: Go-side diagram theme mapping
**Files:** create `internal/render/theme.go`, `internal/render/theme_test.go`;
modify `internal/render/render.go`.
**Behavior:** `Options` gains a theme. The seven `diagram-*` tokens map onto
`d2target.ThemeOverrides` and are passed to `d2svg.RenderOpts`. This is the
"update both paths" requirement: chrome via custom properties, diagram via a
re-render.
- [x] Failing test: `TestDarkThemeChangesRenderedColours` — the same source
      rendered light and dark produces different SVG. Expected failure:
      `Options` has no theme field, so both are identical.
- [x] Failing test: `TestThemeOverridesCarryTokenValues` — a named token value
      appears in the rendered SVG, so a mapping that silently drops a field
      fails here rather than looking subtly wrong on screen
- [x] Failing test: `TestUnsetThemeRendersDefault` — omitting the theme keeps
      Milestone 1's output byte-identical, which is what stops the existing
      goldens changing
- [x] Implement
- [x] Green: `go test ./internal/render -run Theme -v`

### Task 6: Dark-theme goldens
**Files:** create `testdata/golden/architecture-dark.svg`,
`testdata/golden/containers-dark.svg`; modify
`internal/render/golden_test.go`.
**Behavior:** the existing fixtures rendered with the dark theme, committed as
goldens. The light goldens must not change; if they do, the mapping is leaking
into the default path.
- [x] Failing test: `TestGolden/architecture-dark` — expected failure: the
      `.svg` does not exist
- [x] Implement, generate with `-update`
- [x] **Open both generated SVGs and look at them** before committing
- [x] Green: `go test ./internal/render -run Golden`

### Task 7: The literal guard
**Files:** create `frontend/src/styles/no-literals.test.ts`.
**Behavior:** a test that scans `frontend/src` for hex colours and `px` values
outside `styles/tokens/` and fails listing every offender. The roadmap's exit
criterion is a grep; this makes it a gate that runs on every commit and in CI,
because a rule nothing enforces decays.
- [x] Failing test: it must fail right now — `App.svelte` still carries the
      `1px` divider from Milestone 1. Watch it fail, then fix the divider to
      use a token, then watch it pass.
- [x] Implement
- [x] Green: `cd frontend && npm test`

## Artifacts

- `.ai/rules/design-system.md` — the token table updated with the real names,
  and the derived tokens marked as derived
- `docs/decisions.md` — dated rows for each derivation: radius scale, motion,
  z-layers, `warning`, the two interaction-state tokens, the focus halo, and
  the decision that the element colour palette is scene data rather than a
  token
- Build-loop repo-state — Milestone 2 closed, the two Milestone 1 debts
  cleared, dark goldens counted
- `.claude/plan/roadmap.md` — Milestone 2 marked complete

## Out of scope

- Any component. `frontend/src/components/` stays empty until Milestone 3.
- Ark UI, which is not a dependency yet. `--z-*` is defined here and first
  exercised in Milestone 3.
- The native window background colour removed from `main.go` in Milestone 1 —
  it needs a Wails window API call, which belongs with the shell in
  Milestone 3.
- Canvas element styling. The canvas does not exist until Milestone 4.


## Completion record — 2026-09-17

All seven tasks complete; 48 frontend tests, four goldens, every gate green.

Corrections to this plan, made while executing it:

- **The plan claimed the mockups showed hover and pressed states. They do not.**
  Checked the actual usage: `#2e2e28` and `#cfcfcb` are both `color:` on prose,
  a text colour rather than a surface. Added `--color-text-prose`; did not
  invent interaction tokens.
- **The D2 mapping was wrong twice.** First onto `N4`/`N5`, which never reach
  the output — shapes come from the `B` family. Then with several fill slots
  left unmapped, which rendered a nested cylinder near-white and a person shape
  pale lavender. Both found by rasterising the dark golden and looking at it,
  after the byte test had already passed.
- **The theme attribute was written from an `$effect`**, which flushes a
  microtask late — the document would paint once with the wrong theme. Now
  written synchronously, which also removed an undisposed `$effect.root`.

Milestone 1 debts cleared: the 13px base, the font wiring, and the `1px`
divider all resolve from tokens now.
