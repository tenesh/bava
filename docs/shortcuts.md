# Keyboard shortcuts

Every shortcut in the product. The menu section is checked against
`internal/app/menu/spec.json` by `frontend/src/shell/shortcuts-doc.test.ts`:
a menu shortcut added without its row here fails the suite. The same data
drives Help ▸ Keyboard Shortcuts, so the dialog cannot drift either.

Desktop users keyboard more than web users do, and a tool whose shortcut is
undocumented may as well not have one.

## Menu shortcuts

Everything in the menu, as each platform shows it. Three kinds, all declared in
`spec.json`:

- **Accelerators** — letters and digits with a modifier — are bound natively
  and dispatch through the menu.
- **Shortcuts** on punctuation keys (`⌘,` `⌘=` `⌘-` `⌘/` `⇧⌘[` `⇧⌘]`) are
  handled by the page, matched by physical key — Wails on Windows matches
  accelerators by virtual-key name and never fires a punctuation one. On macOS
  `⌘,` `⌘=` `⌘-` `⌘/` are real menu accelerators instead (`nativeOn`), since
  AppKit matches them correctly; `⇧⌘[` `⇧⌘]` stay page-handled there, because
  Shift changes the character AppKit compares.
- **Hints** — single keys, and `⌫` for Delete — are never bound: a native
  accelerator on a bare key would steal it from every text field. The canvas
  handles them itself, only while no text field has focus.

Only Windows right-aligns text after a tab in a menu label, so page-handled
shortcuts and hints appear in the menu row on Windows only. On macOS and Linux
the row shows native accelerators alone, and this table — or Help ▸ Keyboard
Shortcuts — lists the rest.

| Menu | Item | macOS | Windows / Linux |
|---|---|---|---|
| Bava | Settings… | `⌘,` | — |
| File | New | `⌘N` | `Ctrl+N` |
| File | Open… | `⌘O` | `Ctrl+O` |
| File | Save | `⌘S` | `Ctrl+S` |
| File | Save As… | `⇧⌘S` | `Ctrl+Shift+S` |
| File | Settings… | — | `Ctrl+,` |
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
| View | Files | `⌥⌘1` | `Ctrl+Alt+1` |
| View | AI Pane | `⌥⌘I` | `Ctrl+Alt+I` |
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
| Canvas | Group | `⌘G` | `Ctrl+G` |
| Canvas | Ungroup | `⇧⌘G` | `Ctrl+Shift+G` |
| Canvas | Bring to Front | `⇧⌘]` | `Ctrl+Shift+]` |
| Canvas | Send to Back | `⇧⌘[` | `Ctrl+Shift+[` |
| Help | Keyboard Shortcuts | `⌘/` | `Ctrl+/` |

Undo, Redo, Cut, Copy, Paste, Select All and Delete go wherever focus is: the
source editor, a text field, or the canvas — and nowhere while a dialog has
focus or the canvas is hidden. The source editor's own bindings for keys the
menu owns are removed, so a key press has one meaning.

## Bound by native roles

These come with the platform's own menu items, not from the spec. They are
still counted when the spec is checked for clashes (`RoleAccelerators` in
`internal/app/menu/spec.go`).

| Shortcut | Action |
|---|---|
| `⌘W` / `Ctrl+W` | Close window |
| `⌘M` / `Ctrl+M` | Minimise |
| `⌃⌘F` | Enter full screen — the role's own binding; unverified off macOS |
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

- Resize and rotate handles — Milestone 6.
- Find — Milestone 15.
- The Delete hint shows `⌫` on every platform; Windows and Linux users read it
  as Backspace, which is what it does.
- **Not yet checked at a running window on any platform**: how a tab-separated
  hint renders in each native menu, and every row above on Windows and Linux.
