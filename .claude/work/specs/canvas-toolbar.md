# Canvas rail, insert panel and selection toolbar: decisions

Decided with the user on 2026-09-17 and 2026-09-18, from the user's Eraser
screenshots (reference only; nothing reads them) and review of the running
window. The screenshots are not vendored: they are another product's UI.

## Tool rail: decided 2026-09-18

A narrow vertical rail of icon buttons at the canvas's top left, in grouped
segments. Each button shows its key as a small letter in its corner and names
itself in a tooltip ("Rectangle  R"). Icons are Lucide.

| Group | Items |
|---|---|
| Insert | **+** (`/`): opens the insert panel; becomes × while open |
| Common | Select `V`, Rectangle `R`, Ellipse `O`, Arrow `A`, Line `L`, Draw `D`, Text `T` |
| Canvas | Frame `F`, Eraser (key from the Excalidraw baseline) |

The rail holds common shapes and actions only. Every other shape is in the
insert panel. The native Canvas ▸ Tools menu keeps listing every tool.

## Insert panel: decided 2026-09-18

Opens beside the rail from **+** or `/`.

- A search field, "Insert item", focused on open. Typing filters across every
  category's items.
- "All Categories": one row per category, each with an icon, a name, a
  one-line description, and a right-pointing chevron at the row's far right,
  clear of the text.
- Choosing a category shows a breadcrumb ("All Categories / Shape") and its
  items as a grid of labelled icon tiles.
- A footer names the highlighted item and reads "↑↓ to navigate · enter to
  insert".
- Only categories that work are listed. Today that is **Shape**: all nine
  shapes. Icon, Image, Diagram as code and AI Chat appear with the milestones
  that build them.
- Choosing a shape activates its tool, as the rail buttons do.

## Selection toolbar: decided 2026-09-18 (controls superseded by the baseline below)

Floats at the bottom centre of the canvas while something is selected, hidden
otherwise. Replaces the colour bar that floated at the top. Its controls depend
on what is selected; a mixed selection shows only what every item shares.

In 06.2 it offers only properties the file format already has (`fill`,
`stroke`, `color`) plus **More ⋯**. The properties below in italics need file
format additions and arrive in 06.3.

| Selection | Controls |
|---|---|
| Shape | Fill, Border, Label colour, *line style, width, corners*, More |
| Arrow, line | Colour, *line style, width, arrowheads*, More |
| Freehand stroke | Colour, *width*, More |
| Text | Colour, *size, align*, More |
| Frame | Border, Label colour, More |

**More ⋯**: Bring Forward, Send Backward, Bring to Front, Send to Back,
Group, Ungroup, Duplicate, Delete.

## Arrange: decided 2026-09-18

Four order commands for any selection: **Bring Forward** and **Send
Backward** move one step past the nearest overlapping-or-not neighbour in `z`;
**Bring to Front** and **Send to Back** move to the end. They are in More ⋯,
the native Arrange menu, and have shortcuts (`⌘]` forward, `⌘[` backward, `⌥⌘]` to front, `⌥⌘[` to back). `z` already exists in the file format.

## Title bar: decided 2026-09-17

- **AI** stays at the far right, styled as a proper bordered button with an
  icon and a pressed state.
- **macOS**: the standard hidden title bar (`MacTitleBarHidden`), not the
  inset toolbar variant, so the traffic lights sit near the 36px bar's centre.
  The draggable height matches the bar.

## Baseline and scope: decided 2026-09-18

Eraser's documentation does not describe its selection toolbar per element
(researched 2026-09-18), so **Excalidraw's properties panel is the baseline**
for what each element type offers, with these additions and changes from the
user:

- **Edges:** a shape's corners are sharp or round.
- **Multi-selection** can align (and Excalidraw's distribute comes with it).
- **Arrows are connectors, lines are not.** An arrow can attach to shapes; a
  line never attaches. Arrow routing is **straight, elbow or arc**.
- **Eraser tool** to clear elements by dragging over them.
- **Code block element:** code with a chosen language, syntax highlighted, in
  a well-styled block.
- **Right-click context menu** on an element: cut, copy, paste, send backward,
  bring forward, send to back, bring to front, duplicate, lock, delete, copy to
  clipboard as PNG, copy to clipboard as SVG, export selection. Grouped with
  separators, with submenus where a group is large (not one flat list).
- **Export opens a dialog** with export settings.

The exact controls and option values per element type are taken from the
Excalidraw research and recorded here before planning.

## Adapted baseline: agreed 2026-09-18

From Excalidraw's source (`master` `c0ad61c`, researched 2026-09-18), adapted
to Bava. All recommendations accepted by the user.

**Left out:** sloppiness, hachure and cross-hatch fills, font family choice
(Bava bundles only Geist and Geist Mono), sticky notes, laser, bucket fill,
element links, library, and "embed scene" in export (the `.md` file is the
scene).

**Colours:** Bava's theme-aware swatches, not a fixed hex palette. Arbitrary
hex stays in Milestone 15.

### Controls per element

| Element | Controls |
|---|---|
| Rectangle, diamond, other shapes | Stroke colour, fill colour, stroke width, stroke style, edges, opacity |
| Ellipse | As shapes, without edges |
| Arrow (connector) | Colour, width, style, type (straight, elbow, arc), start and end arrowheads, opacity |
| Line | Colour, width, style, edges, opacity; no arrowheads |
| Draw | Colour, width, opacity |
| Text | Colour, size, align, opacity |
| Shape label | Size, align, vertical align |
| Frame | Opacity, plus actions |
| Code block | Language, opacity |
| 2+ selected | Align: left, centre, right, top, middle, bottom |
| 3+ selected | Distribute: horizontal, vertical |

A group counts as one unit for align and distribute. A mixed selection shows
the controls that apply to any selected element, showing a mixed value where
they differ.

### Values

- Stroke width: thin 1, medium 2, bold 4.
- Stroke style: solid, dashed, dotted.
- Edges: sharp or round; round is a 32px radius on rectangles, proportional
  (25% of the longest side) on other shapes and lines.
- Arrow type: straight, elbow, arc. Elbow arrows are orthogonal and never
  rounded.
- Arrowheads: none, arrow, bar, triangle, triangle outline, circle, circle
  outline, diamond, diamond outline; ER set: one, many, one or many, exactly
  one, zero or one, zero or many.
- Text size: S 16, M 20, L 28, XL 36. Align left, centre, right; vertical top,
  middle, bottom (labels only).
- Opacity: 0 to 100 in steps of 10.

### Eraser

Key `E`. Dragging marks every element the trail crosses (drawn faded) and
deletes them on release; a click erases what is under it; Alt while dragging
restores. An element's group goes with it; locked elements are skipped. One
undo step.

### Context menu

On an element or selection, groups separated, submenus marked ▸:

1. Cut, Copy, Paste
2. Copy as ▸ PNG, SVG; Export selection…
3. Copy styles, Paste styles
4. Arrange ▸ Bring to Front, Bring Forward, Send Backward, Send to Back
5. Align ▸ six aligns, distribute horizontal and vertical (2+ units; distribute 3+)
6. Flip ▸ Horizontal, Vertical
7. Group, Ungroup
8. Duplicate, Lock
9. Delete

On empty canvas: Paste, Select All, Unlock All (when something is locked).

### Shortcuts

Excalidraw's, where they do not clash with Bava's menu: `⌘]` forward, `⌘[`
backward, `⌥⌘]` to front, `⌥⌘[` to back; `⌘D` duplicate; `⇧⌘L` lock; `E`
eraser; `⇧⌘←→↑↓` align; `⌥H`, `⌥V` distribute; `⌥⌘C`, `⌥⌘V` copy and paste
styles; `⇧H`, `⇧V` flip; `⇧⌥C` copy as PNG; `⇧⌘E` export. Each is checked
against the menu spec before it is bound.

### Export dialog

Live preview; Only selected (on when something is selected), Background,
Dark mode, Scale 1×/2×/3×; buttons PNG, SVG, Copy to clipboard. Padding fixed.

## Rotation: agreed 2026-09-18 (06.3)

- A rotate handle sits above the selection; dragging it rotates. Shift snaps to
  15° steps.
- A multi-selection or group rotates about its shared centre.
- Each element stores `angle` in the file (specified in `docs/file-format.md`
  first).
- Shapes, text, lines, strokes, frames and code blocks rotate. Elbow arrows do
  not: their segments stay orthogonal.
- Hit-testing, marquee, resize handles, the selection outline and later arrow
  attachment work with rotated boxes. Rotation lands before export (6.4) and
  connections (6.5) so both are built rotation-aware.

## Sequencing: agreed 2026-09-18

| Step | Scope | File format |
|---|---|---|
| 06.2 Interface | Window-check fixes, icon rail with Eraser, insert panel, selection toolbar with today's properties, context menu (cut, copy, paste, arrange, duplicate, delete, copy/paste styles, flip), align and distribute | none |
| 06.3 Styles and rotation | Width, style, edges, opacity, text size and align, vertical align, lock, arrow type and arrowheads, and their controls; rotation | additions |
| 6.4 Export | Copy as PNG/SVG, export selection, export dialog, for canvas elements; diagram elements join through `Render` in 6.6 | none |
| 6.5 Connections | As the roadmap: arrows attach to shapes; elbow and arc routing follows moves | additions |
| 6.7 Code block | Code element with language and highlighting (CodeMirror language support, Geist Mono) | addition |

Export moves forward from Milestone 15 and code blocks from Milestone 15.

## Comments: dropped 2026-09-18

Decided by the user: no comments. Bava is local only with no sharing, so a
comment has no one to address. The rail has no Comment tool.

## Colour: decided 2026-09-18

- **The swatch palette stays as it is**: the eight main hues (gray, blue,
  green, yellow, orange, red, purple, pink) plus the theme default, each
  resolving to a light and a dark value. Main colours only, no shades, as in
  Excalidraw's quick row. The file keeps storing the name.
- **A colour picker joins them** (06.3), for any colour. The picked value is
  stored once and **adjusted for the other theme** so it stays legible; the
  picker previews both. Not a pair of values: one colour, one documented rule.
  Asked and answered: Excalidraw stores a literal colour and inverts the whole
  canvas in dark mode, which Bava cannot do because it themes per element. The
  user confirmed Eraser's colours differ between themes, and Eraser's docs
  agree: `color` takes a name or a hex value, dark mode is a per-user setting
  (never stored in the file), and a team palette's "Colors adapt automatically
  for dark mode" (docs.eraser.io/custom-styles, /dark-mode). One authored
  colour, adapted at render, is what both products do.
- The picker's exact storage (`"#e03131"` beside a swatch name) and the
  adjustment rule are specified in `docs/file-format.md` before any code
  writes them.

## Toolbar colours show swatches only: decided 2026-09-18

The selection toolbar's colour controls show the swatch chip alone, with no
"Fill colour" text beside it. The name is in the tooltip. The bar is a row of
chips, not a row of labelled buttons.

## Constrained drawing and resizing: decided 2026-09-18

Holding **Shift** constrains, and is read continuously during the drag so
pressing or releasing it changes the preview at once:

- Drawing a rectangle, ellipse or any shape: a square, a circle, a shape in a
  square box.
- Drawing a line or arrow: snapped to 15° steps.
- Resizing: the selection keeps its proportions.

A resize never draws the marquee: the dashed rectangle belongs to dragging
empty space.

## Milestone 6.3 storage: decided 2026-09-18

Specified here, then in `docs/file-format.md` before any code writes it.

### New optional keys

| Key | Values | Absent | Elements |
|---|---|---|---|
| `strokeWidth` | 1, 2, 4 | 2 | shapes, line, arrow, stroke, frame |
| `strokeStyle` | solid, dashed, dotted | solid | as above |
| `edges` | sharp, round | sharp | shapes except ellipse; line |
| `opacity` | 0 to 100 | 100 | every element |
| `fontSize` | 16, 20, 28, 36 | 20 | text, and a shape's or frame's label |
| `align` | left, center, right | center in a shape, left in free text | text and labels |
| `verticalAlign` | top, middle, bottom | middle | labels |
| `locked` | true | not locked | every element |
| `arrowType` | straight, elbow, arc | straight | arrow |
| `startArrowhead`, `endArrowhead` | none, arrow, bar, triangle, triangle-outline, circle, circle-outline, diamond, diamond-outline | none at the start, arrow at the end | arrow |
| `angle` | degrees, 0 to 359, clockwise about the element's centre | 0 | every element except an elbow arrow |

Numbers rather than names for width and size, as Excalidraw stores them: a
later custom value needs no new vocabulary. Unknown values follow the existing
rule: drawn as the default, written back unchanged.

The ER arrowheads (one, many, one or many, zero or one, zero or many, exactly
one) arrive with connections in Milestone 6.5, where an arrow attaches to a
shape. Decided 2026-09-18.

### Colours: swatch name or literal

`fill`, `stroke` and `color` take **a swatch name or a literal `#rrggbb`**. A
value starting with `#` is literal; anything else is a swatch name, and an
unknown name still draws as the default and is written back unchanged.

**Adapting a literal colour**: it is drawn as stored where it reads well
against that theme's canvas; where it does not, its lightness is flipped and
nudged until it does, keeping its hue. The rule works from the value alone, so
the file never records which theme it was picked in, and a file opened by
another user in the other theme still reads.

### Locking: decided 2026-09-18

Excalidraw's behaviour: a locked element cannot be selected by click or
marquee, moved, resized, restyled or erased. It draws and exports normally.
Unlock All is the way back, from right-click on empty canvas or `⌥⇧⌘L`. Bava
does not offer Unlock on the element itself: hit-testing skips a locked
element, so a right-click on one is a right-click on empty canvas, and a menu
that cannot know what is under the pointer cannot single it out.

## The selection toolbar's layout: decided 2026-09-18

One adaptive row at the bottom of the canvas, showing only the controls the
selection takes, grouped with dividers: colours, then stroke (width, style,
edges, opacity), then text (size, align, vertical align), then arrows (type,
start head, end head), then align and distribute, then More.

A shape, an arrow and a text element each get a different, short set. When the
row does not fit the canvas, the controls that do not fit move into the More
menu rather than the bar growing, wrapping or scrolling.

Round edges follow Excalidraw: a fixed 32px radius on a rectangle, a quarter
of the shorter side on a polygon (diamond, hexagon, parallelogram) and on a
line; an ellipse has no Edges control, and neither do the already-curved
outlines (cylinder, document, person, cloud).

