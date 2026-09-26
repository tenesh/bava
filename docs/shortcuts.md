# Keyboard shortcuts

Every shortcut in the product. The menu section is checked against
`internal/app/menu/spec.json` by `frontend/src/shell/shortcuts-doc.test.ts`:
a menu shortcut added without its row here fails the suite. The same data
drives Help ▸ Keyboard Shortcuts, so the dialog cannot drift either.

Desktop users keyboard more than web users do, and a tool whose shortcut is
undocumented may as well not have one.

## Menu shortcuts

Only what is necessary is bound (decided 2026-09-26, `docs/decisions.md`).
Every other command, from align and distribute to Export and Help, is in its
menu, the selection toolbar or the right-click menu, without a key. Three
kinds, all declared in `spec.json`:

- **Accelerators** (letters and digits with a modifier) are bound natively
  and dispatch through the menu.
- **Shortcuts** on punctuation keys (`⌘,` `⌘=` `⌘-`, and `⌘]` `⌘[`) are
  handled by the page, matched by physical key: Wails on Windows matches
  accelerators by virtual-key name and never fires a punctuation one. On macOS
  `⌘,` `⌘=` `⌘-` are real menu accelerators instead (`nativeOn`), since AppKit
  matches them correctly.
- **Canvas-scoped shortcuts** (`scope: "canvas"`: Bring Forward, Send
  Backward, Flip, Duplicate and Lock) act only while the canvas has the
  keyboard. Anywhere else the key keeps its own meaning: `⌘]` indents in the
  source editor, and `⇧H` types a capital H.
- **Hints** (single keys, and `⌫` for Delete) are never bound: a native
  accelerator on a bare key would steal it from every text field. The canvas
  handles them itself, only while no text field has focus.

Only Windows right-aligns text after a tab in a menu label, so page-handled
shortcuts and hints appear in the menu row on Windows only. On macOS and Linux
the row shows native accelerators alone, and this table (or Help ▸ Keyboard
Shortcuts) lists the rest.

| Menu | Item | macOS | Windows / Linux |
|---|---|---|---|
| Bava | Settings… | `⌘,` | none |
| File | New | `⌘N` | `Ctrl+N` |
| File | Open… | `⌘O` | `Ctrl+O` |
| File | Save | `⌘S` | `Ctrl+S` |
| File | Save As… | `⇧⌘S` | `Ctrl+Shift+S` |
| File | Settings… | none | `Ctrl+,` |
| Edit | Undo | `⌘Z` | `Ctrl+Z` |
| Edit | Redo | `⇧⌘Z` | `Ctrl+Shift+Z` |
| Edit | Cut | `⌘X` | `Ctrl+X` |
| Edit | Copy | `⌘C` | `Ctrl+C` |
| Edit | Paste | `⌘V` | `Ctrl+V` |
| Edit | Delete | `⌫` | `⌫` |
| Edit | Select All | `⌘A` | `Ctrl+A` |
| View | Document | `⌘1` | `Ctrl+1` |
| View | Both | `⌘2` | `Ctrl+2` |
| View | Canvas | `⌘3` | `Ctrl+3` |
| View | Zoom In | `⌘=` | `Ctrl+=` |
| View | Zoom Out | `⌘-` | `Ctrl+-` |
| View | Actual Size | `⌘0` | `Ctrl+0` |
| Canvas | Select | `V` | `V` |
| Canvas | Rectangle | `R` | `R` |
| Canvas | Ellipse | `O` | `O` |
| Canvas | Arrow | `A` | `A` |
| Canvas | Line | `L` | `L` |
| Canvas | Draw | `D` | `D` |
| Canvas | Text | `T` | `T` |
| Canvas | Frame | `F` | `F` |
| Canvas | Code | `C` | `C` |
| Canvas | Eraser | `E` | `E` |
| Canvas | Group | `⌘G` | `Ctrl+G` |
| Canvas | Ungroup | `⇧⌘G` | `Ctrl+Shift+G` |
| Canvas | Bring Forward | `⌘]` | `Ctrl+]` |
| Canvas | Send Backward | `⌘[` | `Ctrl+[` |
| Canvas | Flip Horizontal | `⇧H` | `Shift+H` |
| Canvas | Flip Vertical | `⇧V` | `Shift+V` |
| Canvas | Duplicate | `⌘D` | `Ctrl+D` |
| Canvas | Lock | `⇧⌘L` | `Ctrl+Shift+L` |

Undo, Redo, Cut, Copy, Paste, Select All and Delete go wherever focus is: the
source editor with focus (the document's, or the one in Diagram from Code), a
code block's editor, a text field, or the canvas; and nowhere while a dialog
without an editor has focus or the canvas is hidden. Every editor drops its
own bindings for keys the menu owns, the window's items included, so a key
press has one meaning.

## Bound by native roles

These come with the platform's own menu items, not from the spec. They are
still counted when the spec is checked for clashes (`RoleAccelerators` in
`internal/app/menu/spec.go`).

| Shortcut | Action |
|---|---|
| `⌘W` / `Ctrl+W` | Close window |
| `⌘M` / `Ctrl+M` | Minimise |
| `⌃⌘F` | Enter full screen (the role's own binding; unverified off macOS) |
| `⌘H` / `⌥⌘H` | Hide Bava / hide others (macOS) |
| `⌘Q` | Quit (macOS) |

## Reserved

`⌘B`, `⌘I`, `⌘U`, `⌘K` and `⇧⌘X` are kept free for prose formatting in
Milestone 8. A test in `spec_test.go` fails if the menu takes one.

## Canvas keys

Not in the menu. Active while the canvas has focus, ignored while a text field
or the source editor has it.

| Key | Action |
|---|---|
| `Delete` / `Backspace` | Delete the selection; in point editing, the selected points (with none selected, the line itself) |
| Arrow keys | Nudge the selection one unit |
| `⇧` + arrow keys | Nudge the selection five units |
| `Enter` | Type into the selected shape's label, or the selected text; on a selected line, edit its points; while drawing a line point by point, finish it |
| `Esc` | Back to Select, and clear the selection; while typing a label, finish typing; while drawing a line point by point, finish it; in point editing, leave it |
| `⌘Enter` / `Ctrl+Enter` | Finish typing a label (plain `Enter` is a new line) |
| `Space` held | Drag to pan |

In the insert panel, opened from the rail's +: `↑↓←→` move, `Enter` inserts,
`Esc` goes up or closes, `⌫` on an empty search goes up.

## In a code block's editor

| Key | Action |
|---|---|
| `Tab` / `⇧Tab` | Indent / outdent |
| `Enter` | New line |
| `Esc` | Finish editing and keep the code |

## On the canvas

| Gesture | Action |
|---|---|
| Drag with a shape tool | Create that shape; hold `⇧` for a square (a circle, a square box) |
| Drag with Line or Arrow | Draw it (a drag of at least 20 px); hold `⇧` to snap to 15° steps |
| Drag with Arrow onto a shape | Attach the arrow to it: ended inside the shape it is pinned there, just outside it attaches to the edge; hold `⌥` to pin it, `⌘` / `Ctrl` to leave it free |
| Click with Line or Arrow | Start a line point by point: each click adds a point; click the last point again, or press `Enter` or `Esc`, to finish |
| Double-click a line, or `⌘` / `Ctrl` + double-click an arrow | Edit its points: click to select one (`⇧` adds), drag to move the selected, `⌫` removes them, `⌥`-click adds one after the last, `Esc` or a click elsewhere finishes |
| Drag an end of a selected arrow | Attach it to a shape (inside it pins, just outside attaches to the edge, and the shape lights up; `⌥` pins, `⌘` / `Ctrl` leaves it free), or drop it on empty canvas to let go; it keeps aiming at the spot it was dropped on, and snaps to a side's middle when dropped just outside it. An elbow's end stays on the side it was dropped on, and the elbow routes around the shapes |
| Drag the middle of a selected straight line or arrow | Add a bend there, once dragged 10 px (on a bent one, in point editing) |
| Drag a point of a selected line or arrow | Move it; it keeps where you grabbed it, and `⇧` snaps it to 15° steps about its neighbour |
| Double-click a bend | Remove it |
| Drag the label of a selected arrow | Slide it along the arrow |
| Drag an attached arrow by its body | Move it, and let go of any shape not moving with it |
| Click with Text | Place text and start typing; nothing is added until you type |
| Double-click a shape, frame or text | Type into its label or text |
| Drag a selection handle | Resize; hold `⇧` to keep the proportions, from any handle |
| Drag the handle above the selection | Rotate about its centre; hold `⇧` to snap to 15° steps |
| Scroll | Pan |
| `⌘` / `Ctrl` + scroll, or pinch | Zoom about the pointer |
| Middle-button drag | Pan |
| Click with Select | Select the topmost element; on one of several selected, select only it |
| `⇧`-click | Add to or remove from the selection; a selected element is removed on release, so a `⇧`-drag still moves the selection |
| Drag on empty space | Marquee select |
| Drag a selection | Move every selected element, from any of them or from empty space inside the selection; hold `⇧` to keep to one axis |
| `⌥`-drag a selection | Move a copy and leave the originals; the copy is selected after |
| Drag with Draw | Freehand stroke |
| Drag with Eraser | Fade what the trail crosses, delete it on release; `⌥` while dragging restores |
| Click with Eraser | Delete the topmost element under the pointer |

`⇧` and `⌥` are read while you drag: pressing or releasing either changes what
you see at once, and the release commits exactly that.

A drag, a resize or an erase is one undo step, however many pointer events it
took. Shapes, strokes, moves and resizes draw live while you drag.

The shapes without a key (diamond, cylinder, hexagon, parallelogram, document,
person, cloud) are in the insert panel (the rail's +) and in Canvas ▸ Tools.

## Not yet implemented

- Find: Milestone 15.
- The Delete hint shows `⌫` on every platform; Windows and Linux users read it
  as Backspace, which is what it does.
- **Not yet checked at a running window on any platform**: how a tab-separated
  hint renders in each native menu, and every row above on Windows and Linux.
