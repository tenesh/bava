# Design system

Tokens, the look, and the component inventory. The code in
`frontend/src/styles/` and `frontend/src/components/` is the truth.

## Tokens
CSS custom properties, authored in SCSS under `styles/tokens/`, emitted on
`:root` and redefined under `:root[data-theme="dark"]`.

| File | Holds |
|---|---|
| `_color.scss` | semantic colour, `--syntax-*` per code run kind, `--color-code-surface` |
| `_space.scss` | `--space-half`, `--space-1` … `--space-12` (4px unit), `--border-width`, named sizes |
| `_type.scss` | family, size, weight, line-height, letter-spacing |
| `_radius.scss` | `--radius-sm/md/lg/xl/full`, named radii |
| `_elevation.scss` | shadows and overlay layering |
| `_motion.scss` | durations and easings |
| `_z.scss` | stacking levels (below) |
| `_swatches.scss` | `--swatch-<name>-fill/-stroke/-text`; names live once in `canvas/palette.ts` |

Colour names: `surface`, `surface-raised`, `surface-sunken`, `surface-overlay`,
`surface-nav` · `border-subtle`, `border-strong`, `border-hairline` ·
`text-primary`, `text-secondary`, `text-muted`, `text-faint`, `text-prose` ·
`accent`, `accent-contrast`, `accent-subtle` · `selection` · `focus-ring`,
`focus-halo` · `danger`, `danger-subtle` · `ok`, `pending` · `backdrop` ·
`canvas-bg`, `canvas-dot` · `note-fill`, `note-border` · the seven `diagram-*`.

## Token rules
- **Semantic, never literal**: `--color-surface-raised`, not a grey scale. Dark
  mode never needs a change outside `tokens/`.
- **No literal values** (hex, `rgb()`, `px`, one-off shadows) outside `tokens/`;
  add the token. `no-literals.test.ts` enforces it. `frontend/tests/harness/`
  is exempt.
- **`:global()` only in `.svelte` files.** In a stylesheet the browser drops
  the whole rule; use descendant selectors.

## The look
Quiet and precise, black and white (`.claude/work/specs/look.md`).
- The accent is the ink: `accent` equals `text-primary`, as do the focus ring
  and canvas handles, guides and attach outline (`tokens.test.ts`). Neutrals
  are pure greys. Red deletes, green is saved, amber unsaved. No accent setting.
- Labels (pane headers, groups, menu headings) are `--font-label`,
  `--tracking-label`, capitals. Sizes, dates, paths, counts, keys are
  `--font-data` (`tabular-nums` where aligned). A page's h6 is not a label.
- No coloured edge on one side: a chosen row is a full `selection` fill (hover
  `accent-subtle`).
- Shadows only on what floats. Corners 3 to 6px on controls, 10px on dialogs.
- Text selection is `selection` on `::selection` in `base.scss`.
- Desktop density: 13px base, 4px unit.

## Stacking
Ark sets no z-index: portalled content hides behind chrome unless placed.
Never a raw `z-index`; one portal root, at `--z-portal`.

| Token | Layer |
|---|---|
| `--z-base` | default plane |
| `--z-canvas` | scene surface |
| `--z-chrome` | panels, toolbars, sidebar, status bar |
| `--z-floating` | tool rail, contextual toolbar |
| `--z-overlay` | backdrops |
| `--z-portal` | dialogs, popovers, menus, tooltips |
| `--z-toast` | toasts |

## Ark UI
- **Wrap every primitive in `components/`**; screens never import
  `@ark-ui/svelte`. Keep the compound structure inside the wrapper.
- **Prefix classes on Ark's own elements** (`.bava-dialog-content`): they need
  `:global()`, so a generic name leaks app-wide.
- **Closed is not unmounted**: query by `data-state`, never presence.
- **`hidden` always wins**: `base.scss` forces `[hidden]` to `display: none
  !important`. Popups use `lazyMount unmountOnExit`.
- **Tooltips open only on real pointer events**; `bind:open` leaves them 0×0.
- **A modal Dialog sets `pointer-events: none` on `body`**, reaching the canvas.
- **A menu at a point** reads it through `positioning.getAnchorRect` (`atPoint`).
- **Open a field from a menu item a frame later**, or the menu takes focus back.

## Component rules
- Every button answers the pointer: `.bava-button` (`primary`, `danger`,
  `ghost`) or `.bava-icon-button` (`controls.scss`). Custom ones style `:hover`
  and `:active` (`buttons.test.ts`).
- `Pane` is `height: 100%`, or the canvas inside is zero tall.
- Presentational only: no IPC, files, D2 or product logic. Variants are props
  (string unions), never local restyles of a shared component.
- Keyboard-navigable with a visible `--color-focus-ring`; both themes checked.
- Everything that floats closes on a press outside (Ark's, or `pressAway` in
  `components/press-away.ts`); the Find bar stays until closed. A new floating
  piece gets a row in `frontend/tests/integration/components.spec.ts`.
- Add a component: check this inventory and Ark first, then add its row here.

## Inventory
Ark primitives not yet wrapped: Accordion, Avatar, Checkbox, Clipboard,
Collapsible, ColorPicker, Combobox, Editable, Field, Fieldset, FileUpload,
NumberInput (in `NumberField`), Toast, ToggleGroup. Build when a screen needs.

| Component | What it is (Ark primitive) |
|---|---|
| `AboutDialog` | Mark, title, tagline, licence |
| `BlockHandle` | + and grip left of a hovered block |
| `CanvasControls` | Zoom readout and buttons |
| `CanvasSection` | Settings ▸ Canvas (lives in `settings/`) |
| `ConfirmDialog` | Fixed answers; dismiss is cancel; `tone: 'danger'`, optional `check` |
| `ContextMenu` | Menu at a point, nested (Menu); `within` inside a dialog; look in `styles/menus.scss` |
| `DatePicker` | Calendar under a date chip, gives `YYYY-MM-DD` (DatePicker) |
| `Dialog` | Ruled header, body, footer; named `size`s, `flush`, `headless`, `variant="alert"`; `dismissible={false}` and `onEscape` while work under way must end first (Dialog) |
| `D2DiagramDialog` | D2 source beside live preview, diagnostics, engine picker, Insert |
| `EmojiPicker` | Search and grouped emoji |
| `EmptyState` | Empty panes; `mark`, `hints`, `size` (`pane` for a whole pane with nothing open) |
| `EquationField` | TeX field over an equation, live render |
| `ErrorDialog` | One sentence, detail rows, Copy details, Open logs folder; never a stack |
| `ExportDialog` | Export canvas: PNG, SVG, Copy over a preview |
| `FindBar` | Find and replace; `look="floating"` for the canvas |
| `FormatBubble` | Toolbar over selected text; keeps the selection |
| `FramePicker` | `/` Embed frame list |
| `ImportDialog` | Import: what comes in as it lands, Into, renames, progress and Cancel |
| `Icon` | SVG path wrapper, tokenised size |
| `InsertPanel` | Insert search, categories, tiles; the Icon category's picker |
| `IconGrid` | The icon picker's grid, a page at a time (Segments for its tabs) |
| `Keycaps` | A shortcut as mono key boxes |
| `LayoutEnginePicker` | TALA, Dagre, ELK; direction hidden under TALA |
| `LinkCard` | Card under a clicked link |
| `LinkField` | Link field over text; also captions, names, web addresses |
| `Mark` | The brand mark at `--size-mark-*` |
| `MediaDialog` | Media grid or list, rename, delete (Dialog) |
| `MediaSection` | Attachments under Files; rows drag into the page |
| `MediaThumb` | Attachment picture or kind icon |
| `MediaViewer` | Full-screen image (Dialog) |
| `NewSpaceDialog` | Name and location; refusals shown under the field |
| `NumberField` | Mono number field (NumberInput) |
| `OpacityPicker` | Opacity in steps of ten (Popover, Slider) |
| `OptionPicker` | One property from icon choices (Popover, RadioGroup) |
| `PageExportDialog` | Export page: PDF or Markdown zip |
| `PageHeader` | Breadcrumb, Locked, page menu button |
| `PageTags` | A page's tags and Add tag |
| `Pane` | A shell region, `titled` or `bare` |
| `PanelBoundary` | `<svelte:boundary>` per region, Reload panel |
| `PdfOptions` | Paper, orientation, margins, theme, page numbers |
| `PdfPreview` | First sheet in a sandboxed frame |
| `Portal` | Moves content into the portal root, staying in the caller's tree; Ark's `Portal` only inside Ark popups |
| `Progress` | `value: null` is indeterminate (Progress) |
| `SaveTemplateDialog` | Name and group for a template |
| `SearchPalette` | Search across a Space; state in `files/search.svelte.ts` |
| `CommandPalette` | Every menu command by name (⇧⌘P); groups from `shell/palette.ts` |
| `SectionTabs` | Vertical sections (Tabs) |
| `Segments` | Few exclusive choices (SegmentGroup); never `role="radio"` buttons |
| `Select` | Dropdown choice (Select) |
| `SelectionToolbar` | Bottom-centre selection toolbar; model in `canvas/toolbar.ts` |
| `ShortcutsDialog` | Shortcut groups from the menu spec |
| `SlashMenu` | `/`, `:` and `@` lists at the caret |
| `SpaceExportDialog` | Export Space: PDF or zip, progress |
| `SpaceSettingsDialog` | Rename, page width, show folder |
| `SpaceSwitcher` | Space name and recent Spaces (Menu) |
| `SpaceTree` | Files tree, drag to move (TreeView); rules in `files/tree.ts` |
| `Splash` | Launch cover |
| `Splitter` | Side pane split (Splitter) |
| `StartScreen` | Nothing open: mark, New, Open, recent |
| `StatusBar` | Space, path, context counts, message |
| `StyleBar` | Fill, border, text swatches (Popover, RadioGroup) |
| `TagChip` | One tag, `#name` in mono |
| `TagFilter` | Files tag filter |
| `TagsDialog` | Manage tags |
| `TemplateBar` | Above a template being edited |
| `AccessBar` | Above a page on its own whose folder a store's sandbox has not allowed; Allow access |
| `TemplatesDialog` | The Space's templates |
| `Toggle` | On/off; disabled rather than hidden (Switch) |
| `ToolIcon` | Lucide plus `DRAWN_ICONS` in `tool-icons.ts` |
| `ToolRail` | Canvas tools; layout in `canvas/rail.ts` |
| `Tooltip` | Names a control on hover and focus (Tooltip) |
| `TrashDialog` | Restore, delete, empty |
| `ViewSwitcher` | `Document │ Both │ Canvas` over `Segments` |
| `ZipContents` | Zip export preview tree |

## Brand
- The panda is paper on ink, always (`--color-mark`, `--color-mark-tile`):
  never inverted, recoloured or set on `accent`. Use `Mark`, never an `<img>`.
- One drawing at every size; 20px (`--size-mark-brand`) is the floor for brand
  placements. Wordmark: lowercase `bava`, Geist Medium; in prose, `Bava`.

## The D2 preview's theme
The D2 diagram's preview is Go-rendered SVG and ignores CSS; the frontend
sends no `opts.theme`. If it is themed: in `internal/render/theme.go`, D2's
`N1`-`N7` colour text and canvas while `B` and `A` colour shapes; map every slot.
