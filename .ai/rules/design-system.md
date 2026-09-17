# Design system

Bava's UI is built on Ark UI headless primitives, styled only with the design
system's tokens. No Tailwind, no styled component library, no ad-hoc CSS.

**The code is the source of truth.** `frontend/src/styles/` holds the tokens
and `frontend/src/components/` the components. When a spec, a sketch, or a
screenshot disagrees with them, the code wins.

## Tokens

All tokens are CSS custom properties, authored in SCSS under
`frontend/src/styles/tokens/` and emitted onto `:root`. They are redefined
under `:root[data-theme="dark"]`, and the app sets `data-theme` on `<html>`.

| File | Holds |
|---|---|
| `_color.scss` | semantic colour only — see below |
| `_space.scss` | `--space-1` … `--space-12` (4px unit), `--border-width`, fixed chrome heights |
| `_type.scss` | family, size, weight, line-height, letter-spacing |
| `_radius.scss` | `--radius-sm/md/lg/full` |
| `_elevation.scss` | shadows and overlay layering |
| `_motion.scss` | durations and easings |
| `_z.scss` | named stacking levels — see Stacking below |

**Colour tokens are semantic, never literal.** `--color-surface-raised`, not
`--color-gray-100`. `--color-border-subtle`, not `--color-gray-300`. Literal
scales may exist as private SCSS variables feeding the semantic layer, but
nothing outside `tokens/` may reference them.

The test: switching to dark mode should not require touching any file outside
`tokens/`. If it does, a component contains a literal.

**This is enforced, not merely stated.** `src/styles/no-literals.test.ts` fails
the suite on any hex, `rgb()`/`hsl()`, or `px` value outside `tokens/` — in
comments as well as in code. A rule with nothing behind it decays.

### The set

Emitted as of Milestone 2, values from the design's token sheet:

`surface`, `surface-raised`, `surface-sunken`, `surface-overlay`,
`surface-nav` · `border-subtle`, `border-strong`, `border-hairline` ·
`text-primary`, `text-secondary`, `text-muted`, `text-faint`, `text-prose` ·
`accent`, `accent-contrast`, `accent-subtle` · `selection` · `focus-ring`,
`focus-halo` · `danger`, `danger-subtle` · `ok` · `backdrop` · `canvas-bg`,
`canvas-dot` · `note-fill`, `note-border` · the seven `diagram-*`.

Two are additions rather than design values, both evidenced by usage rather
than invented: **`text-prose`** (document body copy, softer than
`text-primary`) and **`focus-halo`** (the halo the design's focus recipe
describes in prose but never names).

**No hover or pressed tokens exist yet.** The mockups contain no such states —
checked, rather than assumed. They arrive with the first component that needs
one, which is what this file already says to do.

**Shape colours are not tokens.** The swatches in the design's colour picker
are content a user chooses per element; they live in the scene file, not
here.

**No component writes a literal value.** No hex codes, no `px` outside the
token files, no one-off shadows. If a value is needed that no token provides,
add the token — do not inline it.

## Stacking

Ark supplies **no z-index of its own**. Verified in the Wails webview on
2026-09-16: dialog content and tooltip content both painted *below* an
ordinary `position: fixed; z-index: 9999` element. All stacking is ours, and
portalled content will hide behind app chrome unless it is placed
deliberately.

Named layers, defined in `_z.scss` and referenced nowhere as literals:

| Token | Layer |
|---|---|
| `--z-base` | the default plane |
| `--z-canvas` | the scene surface |
| `--z-chrome` | panels, toolbars, sidebar, status bar |
| `--z-floating` | tool rail, contextual toolbar |
| `--z-overlay` | backdrops |
| `--z-portal` | dialogs, popovers, menus, tooltips |
| `--z-toast` | toasts, above everything |

Values are spaced so a layer can be inserted without renumbering, and
`tokens.test.ts` asserts the ordering rather than trusting a reader to keep it.

The portal root is defined once in the app shell at `--z-portal`. Do not
introduce a second portal root, and do not set a raw `z-index` anywhere.

## Density

This is a desktop app, not a web page. Base font size is 13px and the spacing
unit is 4px. Web-scaled spacing looks bloated in a tool window. Calibrate
against desktop editors — Linear, Zed, Sublime — not web apps.

## Ark UI usage

- `@ark-ui/svelte` provides behaviour and accessibility. All visual styling
  is ours.
- **Wrap every Ark primitive in a project component before using it in a
  screen.** Screens import from `components/`, never `@ark-ui/svelte`
  directly. This keeps the swap surface to one file per primitive.
- Ark components are **compound** (`Root` / `Trigger` / `Content` / `Item`).
  Keep that structure inside the wrapper rather than flattening it to a single
  prop-driven component — flattening loses composition and fights the library.
- **Ark's docs show React examples in places.** Svelte usage differs. Read the
  Svelte tab, or query Context7 with library id `/chakra-ui/ark`. Never port a
  React snippet by hand.
- **Prefix class names used on Ark's own elements.** Ark renders those elements
  itself, so Svelte's scoping cannot reach them and the rules must be
  `:global()`. A generic name like `.content` or `.title` then leaks across the
  whole app — use `.bava-dialog-content` and the like.
- Portalled content (Dialog, Popover, Tooltip, Menu) mounts at `body` level,
  outside `#app` — `<Portal>` defaults its container to `document.body`.
  Positioning and edge handling work correctly in the webview; only stacking
  is our problem. See Stacking above.

### Measured Ark behaviours

From the 2026-09-16 spike. These are library behaviours, not bugs, and they
change how components and their tests are written:

- **Closing a dialog does not unmount it.** The content node stays in the DOM
  with `data-state="closed"`, `hidden` and `display: none`. Query by state,
  never by presence.
- **Binding `open` on a Tooltip does not position it.** Programmatic
  `bind:open` leaves the content mounted but hidden at 0×0; only real pointer
  events (`pointerover` / `pointerenter` / `pointermove`) open and position
  it. Write tooltip tests with pointer events.
- **A modal Dialog sets `pointer-events: none` on `body`** while open. This
  reaches the canvas — see `.ai/rules/canvas.md`.
- **Bundle cost is real.** Dialog + Tooltip + Portal alone took the bundle
  from 57.61 kB (21.20 gzip) to 173.51 kB (58.28 gzip). Not a network cost in
  a desktop app, but track it: if each further primitive adds similar weight,
  tree-shaking is not working.

## Component rules

- **Presentational only.** No IPC calls, no file access, no D2 knowledge, no
  product logic inside `components/`. A component receives props and emits
  events.
- One component per file. Logic in `.svelte.ts` modules, not in markup.
- **No local restyles.** If a screen needs a variant, add the variant to the
  component with a prop. Overriding a shared component's internals with
  `:global()` or deep selectors is forbidden.
- Every interactive component is keyboard-navigable and has a visible focus
  ring using `--color-focus-ring`. Desktop users keyboard more than web users
  and will notice immediately.
- Props typed, no `any`. Variants as string unions, never booleans that can
  combine illegally.
- Both themes checked before a component is called done.

## Inventory

**From Ark UI** (wrap, then use):

Accordion, Avatar, Checkbox, Clipboard, Collapsible, ColorPicker, Combobox,
Dialog, Editable, Field, Fieldset, FileUpload, Menu, NumberInput, Popover,
Progress, RadioGroup, SegmentGroup, Select, Slider, Splitter, Switch, Tabs,
Toast, Toggle, ToggleGroup, Tooltip, **TreeView**.

TreeView covers the file sidebar and Splitter may cover the pane layout —
check both before building either by hand.

**Built in-house** (no adequate primitive, or too app-specific):

| Component | Why in-house |
|---|---|
| `Pane` ✓ | A titled region of the shell, with the small-caps header. |
| `ViewSwitcher` ✓ | `Document │ Both │ Canvas`, over `Segments`. |
| `Segments` ✓ | A few exclusive choices, wrapping Ark's SegmentGroup. Use it rather than buttons with `role="radio"`, which lack arrow-key navigation. |
| `ShortcutsDialog` ✓ | Shortcut groups, as the caller derives them from the menu spec. |
| `StatusBar` ✓ | Engine, node count, error count, and an optional message — autosave paused, a command that failed. |
| `FileTree` ✓ | Workspace listing. Emits a path on activation; opens nothing itself. |
| `ConfirmDialog` ✓ | A question with fixed answers. Dismissing it is a cancel, never an accident. |
| `CanvasControls` ✓ | Tool rail with shortcut keys, and the zoom readout. |
| `Toolbar` | Contextual: changes with the current selection. |
| `LayoutEnginePicker` | Per `diagram` element, not per canvas. |
| `ErrorList` | D2 compiler diagnostics, click-to-jump to source line. |
| `EmptyState` ✓ | Repeated across file tree, canvas, search. `mark` adds the faded brand mark for "nothing open yet". |
| `Mark` ✓ | The brand mark, inlined from `src/brand/panda.svg` at one of four `--size-mark-*` sizes. |
| `ErrorDialog` ✓ | An unexpected failure: one sentence, collapsed details, Copy details, Open logs folder. Never a stack. |
| `PanelBoundary` ✓ | `<svelte:boundary>` around each shell region; a crash shows "This panel hit a problem" and Reload panel. |
| `Disclosure` ✓ | A collapsed-by-default section, wrapping Ark's Collapsible. |
| `AboutDialog` ✓ | Mark, wordmark, tagline, licence. No version until Milestone 16. |
| `Icon` ✓ | Single sprite wrapper so icon sizing is tokenised. No set is bundled until Milestone 9. |

✓ marks what exists. Build the rest as screens need them, not upfront — an
unused component is an unmaintained one.

**Wrapped from Ark so far**: `Dialog`, `Splitter`, SegmentGroup inside
`Segments`, and Collapsible inside `Disclosure`.

## Brand

The panda mark is **paper on ink, always** (`--color-mark`,
`--color-mark-tile`): bare on a dark ground, in its own ink tile on a light
one. It never inverts to ink on paper and never takes the accent — that is
reserved for selection and focus. Use `Mark`, never an `<img>` of the SVG: an
image cannot take its colour from a token.

One drawing at every size. Do not stretch, rotate, recolour, redraw for small
sizes, or place it on a mid-tone ground. 20px (`--size-mark-brand`) is the
floor for brand placements; system chrome may use `--size-mark-chrome`.

The wordmark is lowercase `bava` in Geist Medium (`--text-wordmark`,
`--tracking-wordmark`); the name in prose is `Bava`.

## Theme and the diagram

Scene elements are drawn by the frontend and take their colours from tokens
like everything else. **`diagram` elements are the exception**: their SVG is
rendered in Go and does **not** inherit CSS. The active theme's colour tokens
are passed to `Render` as options and applied by D2's theme system. **A theme
change must update both** — chrome via CSS custom properties, every diagram
element via a re-render.

The mapping lives in `internal/render/theme.go`, and D2's palette has a trap in
it: the neutrals `N1`–`N7` carry **text and canvas**, while the `B` and `A`
families carry **shapes**. Mapping stroke and fill onto `N4`/`N5` — the obvious
reading — leaves node borders D2's default blue whatever the theme says. Every
slot is mapped, because an unmapped one keeps its pale default and surfaces on
whichever shape type happens to use it: a cylinder nested in a container, or a
person shape, long after the theme looked right on a rectangle. That one was
caught by looking at a golden, not by a passing test.

Consequence: adding a colour token that the diagram uses means updating the
Go-side theme mapping in the same change. Tokens the chrome alone uses do not.

Watch for the canvas lagging the chrome by one render on theme toggle — that
is the symptom of the two paths being updated in the wrong order.

## Adding a component

1. Check the inventory. Reuse before building.
2. Check whether Ark UI provides the primitive before writing behaviour.
3. If it wraps an Ark primitive, the wrapper goes in `components/` and the
   screen imports the wrapper.
4. Tokens only — no literal values. Add missing tokens first.
5. Keyboard and focus states before visual polish.
6. Check both themes.
7. Add it to the inventory table above in the same change.