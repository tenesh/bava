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
8. Duplicate, Lock / Unlock
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
