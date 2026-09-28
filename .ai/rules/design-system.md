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
| `_color.scss` | semantic colour only; see below |
| `_space.scss` | `--space-half`, `--space-1` … `--space-12` (4px unit), `--border-width`, fixed chrome heights and named sizes |
| `_type.scss` | family, size, weight, line-height, letter-spacing |
| `_radius.scss` | `--radius-sm/md/lg/xl/full`, and named radii (handles, round shapes, the mark's tiles) |
| `_elevation.scss` | shadows and overlay layering |
| `_motion.scss` | durations and easings |
| `_z.scss` | named stacking levels; see Stacking below |

**Colour tokens are semantic, never literal.** `--color-surface-raised`, not
`--color-gray-100`. `--color-border-subtle`, not `--color-gray-300`. Literal
scales may exist as private SCSS variables feeding the semantic layer, but
nothing outside `tokens/` may reference them.

The test: switching to dark mode should not require touching any file outside
`tokens/`. If it does, a component contains a literal.

**This is enforced, not merely stated.** `src/styles/no-literals.test.ts` fails
the suite on any hex, `rgb()`/`hsl()`, or `px` value outside `tokens/`, in
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

**No hover or pressed tokens exist yet.** The mockups contain no such states:
checked, rather than assumed. They arrive with the first component that needs
one, which is what this file already says to do.

**Shape colours are not tokens.** The swatches in the design's colour picker
are content a user chooses per element; they live in the scene file, not
here.

**No component writes a literal value.** No hex codes, no `px` outside the
token files, no one-off shadows. If a value is needed that no token provides,
add the token; do not inline it.

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
against desktop editors (Linear, Zed, Sublime), not web apps.

## Ark UI usage

- `@ark-ui/svelte` provides behaviour and accessibility. All visual styling
  is ours.
- **Wrap every Ark primitive in a project component before using it in a
  screen.** Screens import from `components/`, never `@ark-ui/svelte`
  directly. This keeps the swap surface to one file per primitive.
- Ark components are **compound** (`Root` / `Trigger` / `Content` / `Item`).
  Keep that structure inside the wrapper rather than flattening it to a single
  prop-driven component: flattening loses composition and fights the library.
- **Ark's docs show React examples in places.** Svelte usage differs. Read the
  Svelte tab, or query Context7 with library id `/chakra-ui/ark`. Never port a
  React snippet by hand.
- **Prefix class names used on Ark's own elements.** Ark renders those elements
  itself, so Svelte's scoping cannot reach them and the rules must be
  `:global()`. A generic name like `.content` or `.title` then leaks across the
  whole app. Use `.bava-dialog-content` and the like.
- Portalled content (Dialog, Popover, Tooltip, Menu) mounts at `body` level,
  outside `#app`: `<Portal>` defaults its container to `document.body`.
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
  reaches the canvas; see `.ai/rules/canvas.md`.
- **Bundle cost is real.** Dialog + Tooltip + Portal alone took the bundle
  from 57.61 kB (21.20 gzip) to 173.51 kB (58.28 gzip). Not a network cost in
  a desktop app, but track it: if each further primitive adds similar weight,
  tree-shaking is not working.

## Component rules

- **Every button answers the pointer.** A text button is `.bava-button`
  (`primary`, `danger`, `ghost`), an icon on its own is `.bava-icon-button`,
  both in `styles/controls.scss` with hover, pressed, disabled and focus
  states and the `--color-control-*` / `--color-accent-*` tokens. Buttons
  point and disabled controls refuse (`base.scss`). A button that must look
  different keeps its own class but styles `:hover` and `:active` itself;
  `styles/buttons.test.ts` fails any that does not.
- **`hidden` always wins.** Ark keeps closed dialogs, menus and popovers in
  the page with the `hidden` attribute. A wrapper that sets `display` on one
  of those parts would show every closed one at once and cover the window, a
  failure jsdom tests cannot see. `base.scss` forces `[hidden]` to
  `display: none !important`; never remove it, and never undo it on a part.
- **A pane fills its region.** `Pane` is `height: 100%`; the regions are blocks,
  so without it a pane shrinks to its header and the canvas stage inside is
  zero tall, which also clips the tool rail. jsdom does no layout, so no unit
  test catches this: measure in a browser.
- **An empty state's padding sits inside its height** (`box-sizing:
  border-box`); otherwise a full-height empty state overflows and its pane
  shows a scrollbar.
- **A menu opened at a point reads the point through `positioning.getAnchorRect`**
  (`atPoint`), not `anchorPoint`. A menu mounted once and opened later was
  placed from the anchor it had at mount: off the bottom of the window. jsdom
  computes no positions, so only a running window shows this.
- **Popups unmount when closed** (`lazyMount unmountOnExit`). Ark closes
  content with `hidden`, and any `display` rule on the content overrides it:
  the shape menu sat open over the window controls that way.

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

TreeView covers the file sidebar and Splitter may cover the pane layout;
check both before building either by hand.

**Built in-house** (no adequate primitive, or too app-specific):

| Component | Why in-house |
|---|---|
| `Pane` ✓ | A region of the shell: `titled` shows the small-caps header, `bare` (Document, Canvas) keeps only the accessible name. |
| `ViewSwitcher` ✓ | `Document │ Both │ Canvas`, over `Segments`. |
| `Segments` ✓ | A few exclusive choices, wrapping Ark's SegmentGroup. Use it rather than buttons with `role="radio"`, which lack arrow-key navigation. |
| `ShortcutsDialog` ✓ | Shortcut groups, as the caller derives them from the menu spec; each key its own keycap (`keycaps.ts`). |
| `StatusBar` ✓ | The Space and the page's path, then, at the far end, what is being worked on: the canvas's engine and node count, or the document's words and characters (`shell/status-context.ts` picks the side); an optional message: autosave paused, a command that failed. |
| `PageHeader` ✓ | Above a page: its folders and name as a breadcrumb, Locked when it is, and the ⋯ page menu's button. Reports the press; the menu is a `ContextMenu` the caller opens. |
| `SlashMenu` ✓ | The `/` menu's list at the caret, the `:` emoji suggestions and the `@` menu (`label` names the list): the matching items, grouped, each with an optional quiet `detail`, the active one marked; keys stay in the editor, a press reports the item. |
| `FormatBubble` ✓ | The toolbar over selected text: turn into, bold, italic, underline, strike, code, link, text colour, highlight. Presses keep the selection (mousedown held); the menus open as `ContextMenu`s at the button. |
| `BlockHandle` ✓ | Left of the hovered block: + to add a block after it, and the grip that drags it or opens its block menu. |
| `FindBar` ✓ | Find and replace across the top of the page: the field, "n of m", previous and next, the replace field, Replace, Replace all, close. Enter and ⇧Enter step, Escape closes. |
| `LinkField` ✓ | The link field over selected text: address, Enter to link, Remove to unlink, Escape to leave it. With `placeholder` and `removeLabel` (null for no Remove) it also takes a medium's caption, its file's new name, and a web address for `/` Web link and Online video. Enter applies it from its own key handler too, since a script's key submits no form. Its field and FindBar's share `.bava-field` in `controls.scss`. |
| `MediaViewer` ✓ | An image full screen over Ark's Dialog (`size="viewer"`, headless): Escape or a click outside leaves. |
| `EquationField` ✓ | The field over an equation: its TeX, the equation drawn live below by the caller's `render`, Enter to save, Shift+Enter for a new line, Escape to leave it. |
| `EmojiPicker` ✓ | A search and every emoji under its group; a pick gives the character, Escape or a press outside closes it. The caller supplies the emoji and group names. |
| `LinkCard` ✓ | The card under a clicked link: its address, Open, Edit, Remove; a missing page says so and offers the one page with its name. Escape or a press outside closes it; focus stays in the page. |
| `DatePicker` ✓ | A calendar under a date chip, over Ark's `DatePicker` (inline): the chip's month, its day chosen; a pick gives `YYYY-MM-DD`. Escape or a press outside closes it. |
| `SpaceTree` ✓ | The Files tree of a Space, wrapping Ark's TreeView (expand, keys, typeahead, F2 rename), with drag to move and reorder added on top; a new page or folder is named in place. Rules in `files/tree.ts`. Reports actions; opens nothing itself. |
| `SpaceSwitcher` ✓ | The Space's name atop the side pane, opening recent Spaces and Space actions; wraps Ark's Menu. |
| `StartScreen` ✓ | Nothing open: the mark, New Space, Open Space, Open file, recent Spaces. |
| `TrashDialog` ✓ | A Space's Trash: restore, delete, empty, search, total size. Restore and Delete show on the hovered, focused or chosen row, hidden by opacity so Tab still reaches them. |
| `NewSpaceDialog` ✓ | New Space: the folder's name and where it is made. |
| `SpaceSettingsDialog` ✓ | Rename the Space, its default page width, show its folder. |
| `SectionTabs` ✓ | Sections chosen from a list on the left, one shown at a time (Settings), each with an icon, under an optional heading; wraps Ark's Tabs, vertical. |
| `ConfirmDialog` ✓ | A question with fixed answers. Dismissing it is a cancel, never an accident. |
| `CanvasControls` ✓ | The zoom readout and its buttons. |
| `CanvasSection` ✓ | Settings ▸ Canvas: attach arrows to shapes, snap ends to side middles, snap to objects (`settings/`). |
| `ToolRail` ✓ | The canvas tool rail: grouped icon buttons, a key letter in each corner, a tooltip naming each; one panel, the tool lock (`Q`) last, behind a hairline. Layout in `canvas/rail.ts`. |
| `InsertPanel` ✓ | Search, category rows (right chevron clear of the text), a category's tile grid, footer hint. State in `shell/insert.svelte.ts`. |
| `SelectionToolbar` ✓ | Bottom-centre toolbar for a selection: `StyleBar` pickers, line actions (Edit points, Close or Open line; Done alone while a line is drawn by clicks), align and distribute, More. Model in `canvas/toolbar.ts`. |
| `ContextMenu` ✓ | A menu opened at a point, wrapping Ark's Menu, with nested submenus. Used for right-click and More. Tree in `canvas/context-menu.ts`. |
| `Tooltip` ✓ | Names a control (and its key) on hover and keyboard focus, wrapping Ark's Tooltip. It renders the button itself, or wraps a control the caller renders through `trigger`, which avoids a button inside a button. |
| `ToolIcon` ✓ | Interface icons by id: Lucide (ISC), plus the in-house parallelogram. |
| `Toolbar` | Contextual: changes with the current selection. |
| `LayoutEnginePicker` ✓ | TALA, Dagre or ELK over `Segments`, with a direction control, hidden while TALA is chosen (TALA ignores direction), when a line says TALA chooses its own direction; the one place that rule lives in the interface. In the Diagram from Code dialog; per `diagram` element when that element exists, never per canvas. |
| `ErrorList` | D2 compiler diagnostics, click-to-jump to source line. |
| `EmptyState` ✓ | Repeated across file tree, canvas, search, and the no-file window. `mark` adds the faded brand mark for "nothing open yet"; `hints` lists keys beside what they do. |
| `Splash` ✓ | The launch cover: one centred column of mark, wordmark, indeterminate `Progress` and a status line; the footer at the bottom. The caller decides when startup is over. |
| `Progress` ✓ | Wraps Ark's Progress. `value: null` is indeterminate: use it whenever nothing reports real progress. |
| `Mark` ✓ | The brand mark, inlined from `src/brand/panda.svg` at one of four `--size-mark-*` sizes. |
| `ErrorDialog` ✓ | An unexpected failure: one sentence, the details shown as labels and values (`detail-rows.ts`), Copy details, Open logs folder. Never a stack. |
| `PanelBoundary` ✓ | `<svelte:boundary>` around each shell region; a crash shows "This panel hit a problem" and Reload panel. |
| `StyleBar` ✓ | Fill, border and text pickers as swatch chips, named by their tooltip, wrapping Ark's Popover and RadioGroup. Each popover holds the swatches and a `#rrggbb` field for any other colour. A group inside `SelectionToolbar`, which draws the surface. |
| `OptionPicker` ✓ | One property from a few icon choices (stroke width, line style, edges, text size, alignment, arrow type, arrowheads): a chip opening a popover of radio options; options marked `more` wait behind a More row unless one is current (the crow's-foot heads). Generic over its value; options in `canvas/property-options.ts`. |
| `OpacityPicker` ✓ | Opacity on a slider in steps of ten, in a popover, wrapping Ark's Slider. |
| `DiagramDialog` ✓ | Write D2, see it, insert it: a `SourcePane` editor flush beside a live preview on the dotted canvas ground, diagnostics beneath, the `LayoutEnginePicker` in the footer before Cancel and Insert, Insert disabled while it does not compile. The editor is created when the portalled host appears, not at mount. Uses `Dialog` at `size="diagram"`, `flush`. |
| `Dialog` ✓ | Wraps Ark's Dialog. A ruled header (15px title, optional `subtitle`, `actions`, `closable` X), a padded body, and an optional ruled `footer` for the buttons. `variant="alert"` keeps a short question in one box (`align="center"` and `leading` for About). Named `size`s (`narrow`, `medium`, `wide`, and one per dialog that keeps its own size); `flush` runs the body to the edges; `headless` hides the header from sight but keeps it naming the dialog. A screen never restyles the frame from outside: add an option here instead. By default it is as wide as what it holds. |
| `ExportDialog` ✓ | Export settings over a live preview: Only selected, Background, Dark mode, Scale, and the PNG, SVG and Copy buttons. Padding is fixed. State in `canvas/export/exporter.svelte.ts`. |
| `Toggle` ✓ | An on/off setting, wrapping Ark's Switch; `variant="row"` puts the label first and the switch at the row's end. Disabled rather than hidden when it does not apply, so it still explains itself. |
| `Disclosure` ✓ | A collapsed-by-default section, wrapping Ark's Collapsible. Unused for now; kept for the document's toggle blocks. |
| `AboutDialog` ✓ | Centred: mark, title, tagline, licence, Close. No version shown yet. |
| `Icon` ✓ | Single sprite wrapper so icon sizing is tokenised. No set is bundled until Milestone 9. |

✓ marks what exists. Build the rest as screens need them, not upfront: an
unused component is an unmaintained one.

**Wrapped from Ark so far**: `Dialog`, `Splitter` (unused for now), `Tooltip`, `Progress`, SegmentGroup inside
`Segments`, Collapsible inside `Disclosure`, Menu inside `ContextMenu`, and
Popover with RadioGroup inside `StyleBar` and `OptionPicker`, Slider inside
`OpacityPicker`, Switch inside `Toggle`, TreeView inside `SpaceTree`, Menu
inside `SpaceSwitcher`, and Tabs inside `SectionTabs`.

**Syntax colours** are `--syntax-*` in `tokens/_color.scss`, one per run kind
in `canvas/code/highlight.ts`, plus `--color-code-surface` for the panel. A
kind without a colour draws as nothing, so `tokens.test.ts` checks the set in
both themes.

**Shape swatches** are tokens in `styles/tokens/_swatches.scss`
(`--swatch-<name>-fill`, `-stroke`, `-text`, in both themes), with
`--color-shape-fill`, `--color-shape-stroke`, `--color-shape-text` as the
unstyled default and `--color-selection-handle` for the selection. The names
live once, in `canvas/palette.ts`.

## Brand

The panda mark is **paper on ink, always** (`--color-mark`,
`--color-mark-tile`): bare on a dark ground, in its own ink tile on a light
one. It never inverts to ink on paper and never takes the accent, which is
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
change must update both**: chrome via CSS custom properties, every diagram
element via a re-render.

The mapping lives in `internal/render/theme.go`, and D2's palette has a trap in
it: the neutrals `N1`–`N7` carry **text and canvas**, while the `B` and `A`
families carry **shapes**. Mapping stroke and fill onto `N4`/`N5` (the obvious
reading) leaves node borders D2's default blue whatever the theme says. Every
slot is mapped, because an unmapped one keeps its pale default and surfaces on
whichever shape type happens to use it: a cylinder nested in a container, or a
person shape, long after the theme looked right on a rectangle. That one was
caught by looking at a golden, not by a passing test.

Consequence: adding a colour token that the diagram uses means updating the
Go-side theme mapping in the same change. Tokens the chrome alone uses do not.

Watch for the canvas lagging the chrome by one render on theme toggle; that
is the symptom of the two paths being updated in the wrong order.

## Adding a component

1. Check the inventory. Reuse before building.
2. Check whether Ark UI provides the primitive before writing behaviour.
3. If it wraps an Ark primitive, the wrapper goes in `components/` and the
   screen imports the wrapper.
4. Tokens only: no literal values. Add missing tokens first.
5. Keyboard and focus states before visual polish.
6. Check both themes.
7. Add it to the inventory table above in the same change.
## `:global()` belongs to Svelte, not to stylesheets
In a `.svelte` component it scopes a rule outward. In a plain stylesheet under
`styles/`, sass emits it verbatim and the browser drops the whole rule: four
code-editor rules were dead that way. Use plain descendant selectors there;
`no-literals.test.ts` compiles the stylesheet and fails on `:global`.
