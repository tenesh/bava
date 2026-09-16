# Keyboard shortcuts

Every shortcut in the product. A new one is added here in the same change that
adds it to the code — the build loop gates on it.

Desktop users keyboard more than web users do, and a tool whose shortcut is
undocumented may as well not have one.

## Canvas tools

Single keys, active while the canvas has focus. They are ignored while a text
field or the source editor has focus, so typing D2 does not switch tools.

| Key | Tool |
|---|---|
| `V` | Select |
| `R` | Rectangle |
| `O` | Ellipse |
| `A` | Arrow |
| `L` | Line |
| `D` | Draw (freehand) |
| `T` | Text |
| `F` | Frame |
| `Esc` | Back to Select |

## Editing

Bound as of Milestone 5.5. All of these are ignored while a text field or the
source editor has focus, so the editor keeps its own undo and typing never
deletes a selection.

| Shortcut | Action |
|---|---|
| `⌘Z` / `Ctrl+Z` | Undo |
| `⇧⌘Z` / `Ctrl+Shift+Z` | Redo |
| `⌘C` / `Ctrl+C` | Copy |
| `⌘V` / `Ctrl+V` | Paste, offset so the copy is visible |
| `⌘A` / `Ctrl+A` | Select all |
| `Delete` / `Backspace` | Delete the selection |
| `Tab` | Select next element |
| `⇧Tab` | Select previous element |
| Arrow keys | Nudge the selection one unit |
| `Esc` | Back to Select, and clear the selection |

## On the canvas

| Gesture | Action |
|---|---|
| Drag with a shape tool | Create that shape |
| Click with Select | Select the topmost element |
| `⇧`-click | Add to or remove from the selection |
| Drag on empty space | Marquee select |
| Drag a selection | Move every selected element |
| Drag with Draw | Freehand stroke |

A drag is one undo step, however many pointer events it took.

## Not yet implemented

Listed so the gaps are visible rather than discovered:

- Grouping and ungrouping have operations but no shortcuts bound.
- Zoom has on-screen controls only; `⌘+` / `⌘-` are unbound.
- Resize and rotate handles — Milestone 6.
- The view switcher (`Document | Both | Canvas`) has no shortcut.
- Settings has no shortcut.
