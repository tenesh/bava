# Keyboard shortcuts

Every shortcut in Bava. The menu table is checked row by row against
`internal/app/menu/spec.json` by `frontend/src/shell/shortcuts-doc.test.ts`,
and the same data drives Help ▸ Keyboard Shortcuts.

## Menu shortcuts

Only necessary keys are bound; every other command lives in a menu, the
selection toolbar or the right-click menu. Kinds, all declared in `spec.json`:

| Kind | How it works |
|---|---|
| Accelerator (letter or digit with a modifier) | Bound natively, dispatched through the menu |
| Shortcut on punctuation (`⌘,` `⌘=` `⌘-` `⌘]` `⌘[`) | Matched by the page by physical key, since Wails on Windows never fires a punctuation accelerator. On macOS `⌘,` `⌘=` `⌘-` are native (`nativeOn`) |
| Canvas-scoped (`scope: "canvas"`) | Acts only while the canvas has the keyboard; elsewhere the key keeps its meaning (`⌘]` indents code, `⇧H` types H) |
| Hint (single keys, `⌫`) | Never bound, so text fields keep the key; the canvas handles it while no field has focus |

Page-handled shortcuts and hints show in the menu row on Windows only (the
only platform that right-aligns text after a tab).

| Menu | Item | macOS | Windows / Linux |
|---|---|---|---|
| Bava | Settings | `⌘,` | none |
| File | New Page | `⌘N` | `Ctrl+N` |
| File | Open Space | `⌘O` | `Ctrl+O` |
| File | Open File | `⇧⌘O` | `Ctrl+Shift+O` |
| File | Search | `⇧⌘F` | `Ctrl+Shift+F` |
| File | Save | `⌘S` | `Ctrl+S` |
| File | Save As | `⇧⌘S` | `Ctrl+Shift+S` |
| File: Preferences | Settings | none | `Ctrl+,` |
| Edit | Undo | `⌘Z` | `Ctrl+Z` |
| Edit | Redo | `⇧⌘Z` | `Ctrl+Shift+Z` |
| Edit | Cut | `⌘X` | `Ctrl+X` |
| Edit | Copy | `⌘C` | `Ctrl+C` |
| Edit | Paste | `⌘V` | `Ctrl+V` |
| Edit | Delete | `⌫` | `⌫` |
| Edit | Select All | `⌘A` | `Ctrl+A` |
| Edit | Find | `⌘F` | `Ctrl+F` |
| Edit | Find and Replace | `⌥⌘F` | `Ctrl+Alt+F` |
| View | Document | `⌘1` | `Ctrl+1` |
| View | Both | `⌘2` | `Ctrl+2` |
| View | Canvas | `⌘3` | `Ctrl+3` |
| View | Zoom In | `⌘=` | `Ctrl+=` |
| View | Zoom Out | `⌘-` | `Ctrl+-` |
| View | Actual Size | `⌘0` | `Ctrl+0` |
| View | Zoom to Fit | `⇧1` | `Shift+1` |
| View | Zoom to Selection | `⇧2` | `Shift+2` |
| Canvas: Tools | Select | `V` | `V` |
| Canvas: Tools | Rectangle | `R` | `R` |
| Canvas: Tools | Ellipse | `O` | `O` |
| Canvas: Tools | Arrow | `A` | `A` |
| Canvas: Tools | Line | `L` | `L` |
| Canvas: Tools | Draw | `D` | `D` |
| Canvas: Tools | Text | `T` | `T` |
| Canvas: Tools | Frame | `F` | `F` |
| Canvas: Tools | Code | `C` | `C` |
| Canvas: Tools | Eraser | `E` | `E` |
| Canvas | Group | `⌘G` | `Ctrl+G` |
| Canvas | Ungroup | `⇧⌘G` | `Ctrl+Shift+G` |
| Canvas: Arrange | Bring Forward | `⌘]` | `Ctrl+]` |
| Canvas: Arrange | Send Backward | `⌘[` | `Ctrl+[` |
| Canvas: Flip | Flip Horizontal | `⇧H` | `Shift+H` |
| Canvas: Flip | Flip Vertical | `⇧V` | `Shift+V` |
| Canvas | Duplicate | `⌘D` | `Ctrl+D` |
| Canvas | Edit Points | `⌘Enter` | `Ctrl+Enter` |
| Canvas | Lock | `⇧⌘L` | `Ctrl+Shift+L` |
| Canvas | Snap to Objects | `⌥S` | `Alt+S` |

Undo, Redo, Cut, Copy, Paste, Select All and Delete go to whatever has focus
(Diagram from Code's editor, a code block, the page, a text field, the
canvas), and nowhere while a dialog without an editor has focus or the canvas
is hidden. Editors drop their own bindings for keys the menu owns.

## Bound by native roles

From the platform's own menu items, not the spec, but counted in its clash
check (`RoleAccelerators` in `internal/app/menu/spec.go`).

| Shortcut | Action |
|---|---|
| `⌘W` / `Ctrl+W` | Close window |
| `⌘M` / `Ctrl+M` | Minimise |
| `⌃⌘F` | Enter full screen (unverified off macOS) |
| `⌘H` / `⌥⌘H` | Hide Bava / hide others (macOS) |
| `⌘Q` | Quit (macOS) |

## Reserved

`⌘B`, `⌘I`, `⌘U`, `⌘E`, `⌘K`, `⌘/` and `⇧⌘X` belong to the Document; a test in
`spec_test.go` fails if the menu takes one.

## Canvas keys

Not in the menu. Active while the canvas has focus, not in a text field or
Diagram from Code's editor.

| Key | Action |
|---|---|
| `Delete` / `Backspace` | Delete the selection; in point editing, the selected points (none: nothing; all: the line) |
| Arrow keys | Nudge one unit (`⇧`: five) |
| `Enter` | Type into the selected shape's label or text; on a selected line, edit its points; finish a line drawn point by point |
| `Esc` | Back to Select and clear the selection; finish typing a label, a point-by-point line, or point editing |
| `⌘Enter` / `Ctrl+Enter` | Finish typing a label (plain `Enter` is a new line); otherwise edit the selected line's or arrow's points |
| `Space` held | Drag to pan |
| `⌘Z` / `Ctrl+Z` while drawing a line point by point | Nothing until the line is finished |
| `Q` | Keep the drawing tool on after it draws (nothing selected); again to stop |

Insert panel (the rail's +): `↑↓←→` move, `Enter` inserts, `Esc` goes up or
closes, `⌫` on an empty search goes up.

## In a canvas code block's editor

| Key | Action |
|---|---|
| `Tab` / `⇧Tab` | Indent / outdent |
| `Enter` | New line |
| `Esc` | Finish editing, keep the code |

## In the Document

Active while the page has focus. `Ctrl` for `⌘` on Windows and Linux.

| Key | Action |
|---|---|
| `⌘B` / `⌘I` / `⌘U` | Bold / italic / underline |
| `⇧⌘X` | Strikethrough |
| `⌘E` | Inline code |
| `⌘K` | Link the selection |
| `⌘/` | Block menu for the caret's block |
| `⌥F10` / `Alt+F10` | Into the formatting bubble; `←` `→` move, `Esc` back to the page |
| `Tab` / `⇧Tab` | Indent / outdent a list item |
| `Enter` | New block; in a list a new item; on an empty item, leave the list |
| `⌫` at the start of a heading | Back to text |
| `/` at line start or after a space | Block menu; `↑` `↓` choose, `Enter` inserts, `Esc` closes |
| `⌘F` / `⌥⌘F` | Find / Find and Replace; `Enter` and `⇧Enter` step, `Esc` closes |
| `:` and a name | Emoji picker; `↑` `↓`, `Enter` or `Tab` inserts, `Esc` closes |
| `@` or `[[` at line start or after a space | Dates, then the Space's pages; `Enter` or `Tab` inserts a date chip or page link |
| Click a link | Its card: address, Open, Edit, Remove; `Esc` closes |
| `⌘`-click a link | Follow it (heading, page, or web address in the browser) |
| Click a date chip, or `Enter` on a selected one | Calendar; arrows move, `Enter` picks, `Esc` closes |
| `⌥Enter` / `Alt+Enter` in a link | Its card, focus on the first button |
| `Enter` on a selected equation | Edit its TeX |
| `Enter` in a toggle's summary | Into the toggle, opening it |
| `⌘Enter` / `⇧⌘Enter` | New block after / before the caret's block (a list item gets a new item; a table or toggle title, a line after the whole block). On an empty item or empty first/last line of a quote, callout or toggle, move out one level; an empty middle line stays inside |
| `+` beside a block, `⌥`-click | Add a block after it (`⌥`: before) with the `/` menu open |

In a code block:

| Key | Action |
|---|---|
| `Enter` | New line |
| `Tab` / `⇧Tab` | Indent / outdent two spaces, every line the selection touches |
| `⌘Enter` / `⇧⌘Enter` | A new line after / before the block |
| `↓` on the last line | Onto the line after the block |
| `⌫` in an empty block | Back to text |

In a table:

| Key or gesture | Action |
|---|---|
| `Tab` / `⇧Tab` | Next / previous cell, text selected; `Tab` in the last cell adds a row |
| `Enter` | New line in the cell |
| Arrow keys at a cell's edge | Into the next cell |
| Drag across cells | Select them |
| Right-click in a cell | Table menu: insert, move, merge, split, headers, align, colour, delete |
| Drag a column's edge | Its width |
| Paste tab-separated rows | A table, or cells filled from the caret |

Typed at line start, then a space:

| Type | Makes |
|---|---|
| `#` to `######` | Heading 1 to 6 |
| `-` or `*` | Bulleted list |
| `1.` / `a.` / `i.` | Numbered / lettered / Roman list |
| `[]` | To-do |
| `>` | Quote |
| `---` (no space) | Divider |
| ```` ``` ```` and a language (then space or `Enter`) | Code block |
| `$$` (then `Enter`) | Equation |
| `[!info]`, `[!note]`, `[!success]`, `[!warning]`, `[!error]` at a quote's start | That callout |
| `$x^2$` inside a line | Inline equation |

## In the Files tree

| Key or gesture | Action |
|---|---|
| `↑` `↓` | Move between rows |
| `→` `←` | Open or close a folder (or move into and out of it) |
| `Enter` or a click | Open a page; open or close a folder |
| `F2` | Rename (a page keeps its `.md`) |
| `⌫` / `Delete` | Move to the Trash |
| Typing letters | Jump to a row starting with them |
| Drag a row | Onto a folder's middle: into it. Between rows: there |
| `⌘N` / `Ctrl+N` | New page beside the open one, named in the tree first |

## In the Media dialog

| Key | Action |
|---|---|
| `Enter` in the rename field | Rename; an unusable name is shown under the field, which stays open |
| `Esc` in the rename field | Cancel the rename; the dialog stays open |
| `Esc` again | Close the dialog |

## On the canvas

`⌘` means `Ctrl` on Windows and Linux.

| Gesture | Action |
|---|---|
| `⌘F` with the Canvas holding the keys, or the Document hidden | Find on the Canvas: matches outlined, the current one selected and in view; `Enter` / `⇧Enter` step, `Esc` closes |
| Drag with a shape tool | Create it; `⇧` for a square or circle |
| Drag with Line or Arrow | Draw it (at least 20 px); `⇧` snaps to 15° |
| Drag with Arrow onto a shape | Attach: ended inside pins it there, just outside attaches to the edge; `⌥` pins, `⌘` leaves it free (inverted with attaching off in Settings ▸ Canvas). The start is read at the press |
| Click with Line or Arrow | Draw point by point (`⇧` snaps to 15°); finish by clicking the last point, Done, `Enter` or `Esc`. Back on the first point closes a loop; an arrow finishes on a click just outside a shape, attached; an elbow on its second click |
| Double-click a line, or `⌘`-double-click an arrow | Point editing: click selects (`⇧` toggles), drag around points selects, drag moves them (the line moves whole), `⌫` removes, `⌥` shows and `⌥`-click adds the next point, `⌘D` duplicates, `Esc` or a click elsewhere finishes |
| Drag an end of a selected arrow | Attach as above (the shape lights up; `⇧` takes the shape under the pointer, no middle snap) or drop on empty canvas to let go. Both ends may share a shape. It aims at the drop spot, snapping to a side's middle just outside it. An elbow end keeps its side, snaps to its middle when level (middles shown as dots), and routes around shapes |
| Drag a segment handle on a selected elbow | Move that segment sideways and keep it; an end segment gains a short stub |
| Double-click a moved elbow segment's handle | Back to automatic routing |
| Drag the disc where an attached end aims | Move the aim on its shape (onto another shape attaches; `⌥` pins; off every shape, free) |
| Drag the middle of a selected straight line or arrow | Add a bend after 10 px (on a bent one, in point editing) |
| Drag a point of a selected line or arrow | Move it; `⇧` snaps to 15° about its neighbour |
| Drag a selected arrow's label | Slide it along the arrow after 10 px (a handle over it wins); clicking the label selects the arrow |
| Drag an attached arrow by its body | Move it and let go of shapes not moving with it; an attached elbow does not move alone, one attached at both ends only with both shapes |
| Click with Text | Place text and type; nothing is added until you type. By a free arrow end, that end attaches to it |
| Double-click a shape, frame or text | Edit its label or text |
| Drag a selection handle | Resize; `⇧` keeps proportions |
| Drag the handle above the selection | Rotate about the centre; `⇧` snaps to 15° |
| Scroll, or middle-button drag | Pan |
| `⌘` + scroll, or pinch | Zoom about the pointer |
| Click with Select | Select the topmost element; on one of several selected, only it |
| `⇧`-click | Add or remove (removal on release, so `⇧`-drag still moves) |
| Drag on empty space | Marquee select |
| Drag a selection | Move it, from any element or empty space inside; `⇧` keeps to one axis |
| Drag, resize or draw a shape with Snap to Objects on (`⌥S`, Settings ▸ Canvas) | Snap to edges, side middles, centres and equal spacing (drags only) within 8 px on screen, with guides; `⌘` moves freely (with it off, `⌘` snaps). Text clicks snap; a line or arrow dragged by its body snaps as a box. Never: drawing lines, dragging points, bends or segments, rotating, nudging, resizing one turned element |
| `⌥`-drag a selection | Move a copy, selected after |
| Drag with Draw | Freehand stroke |
| Drag with Eraser | Fade what the trail crosses, delete on release; `⌥` restores |
| Click with Eraser | Delete the topmost element under the pointer |

`⇧` and `⌥` are read during a drag, and release commits what is shown. A drag,
resize or erase is one undo step. Shapes without a key (diamond, cylinder,
hexagon, parallelogram, document, person, cloud) are in the insert panel and
Canvas ▸ Tools.

## Caveats

- The Delete hint shows `⌫` everywhere; on Windows and Linux it is Backspace.
- Not yet checked at a running window: how tab-separated hints render in each
  native menu, and every row on Windows and Linux.
