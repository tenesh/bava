# Release checklist

What no automated test can see, checked by a person before each release.
Run it in full on each store's build, on macOS, Windows and Linux, in both
themes unless a line says otherwise. Write the date and the build at the top
of your notes. A change that adds something only a person can check adds
its line here, in the same change.

A **keyboard pass** means Tab order, arrow keys, Enter and Escape: a focus
ring always shows, and Escape closes and hands the keys back to what opened
it.

## Before you start

Start Bava as if it had never run:

- **macOS (App Store build):** delete `~/Library/Containers/com.tharabyte.bava`.
- **Windows (Store build):** Settings ▸ Apps ▸ Bava ▸ Advanced options ▸ Reset.
- **Linux (Flatpak):** delete `~/.var/app/com.tharabyte.bava`.

## Store sandboxes

- [ ] Open Space, pick a folder, quit, reopen: the Space opens without asking again.
- [ ] Move or rename a recent Space's folder: it reads "Can't open: find it again"; choosing it opens the folder dialog where it was; picking it restores it; Remove still removes it.
- [ ] Open a page on its own that shows a picture from its folder: a bar asks to allow the folder; allowing it shows the picture, and after a relaunch it shows without asking.
- [ ] A card for a file outside the Space reads "Outside this Space"; opening it asks for that file once, then opens it, and not again.
- [ ] Drop a picture from elsewhere onto a page: it shows, and still shows after a relaunch.
- [ ] Export a PDF and a zip to Desktop: both files are written.
- [ ] Linux: the folder and file dialogs are the system's own (the portal).

## Spaces and files

- [ ] New Space, Open Space, and switching between two with the switcher each land in the right place.
- [ ] Create, rename, reorder, move into a folder and duplicate pages and folders in the tree.
- [ ] Delete an item, restore it into a folder that was itself deleted, then empty the Trash.
- [ ] Quit and reopen: Bava returns to the last Space and page.
- [ ] Rename a page in Finder or Explorer, come back: Bava follows the change.
- [ ] Remove a Space from the start screen with "also delete data" on: its `.bava` folder is gone from disk.
- [ ] Keyboard pass: the Space tree, switcher, start screen, Trash, Space settings and the section tabs.

## Page

- [ ] Type, save, reopen: the page is as it was.
- [ ] Keyboard pass: the `/` menu, the bubble (Alt+F10 in, arrows along, Escape back), the block handle, the page's ⋯ and right-click menus, and the find bar (⌥⌘F lands in Replace).
- [ ] Tags by keyboard: chips, their remove buttons, Add tag, the suggestions, Backspace in an empty field reaches the last chip.
- [ ] Filtering a large Space by tags stays quick.
- [ ] Templates: Add ▸ New page from template and a folder's right-click submenu work; a template with a canvas can be edited, words and canvas, then Done.
- [ ] A canvas embed in the page redraws about a quarter second after drawing beside it, and after a theme change.
- [ ] Clicking an embed opens Both, with its frame selected and centred; the frame picker works by keyboard.

## Canvas

- [ ] Dragging and panning stay smooth with a few hundred elements.
- [ ] Rotate with and without Shift: Shift snaps the angle.
- [ ] Resize against other shapes with snapping on: it snaps; ⌘ moves freely. Alt+S ticks the menu item.
- [ ] Hover the selection toolbar: each tooltip shows.
- [ ] Double-click a line, and ⌘ double-click an arrow: both enter point editing; Shift-click, Alt, ⌘D and dragging a segment work there; ⌘Enter works from the menu key.
- [ ] Arrow ends dropped on overlapping shapes, a locked shape and into a frame attach as expected; an attached arrow follows rotate, resize and nudge.
- [ ] Text at a free arrow end, and "along" labels on vertical and leftward arrows, sit right.
- [ ] A styled label looks the same while typing and after.
- [ ] Type a long label into a rectangle, an ellipse, a diamond and a cloud: each grows taller as typed, the text inside its shape, in both themes; a long address breaks across lines.
- [ ] Mid-drag, raise a system alert, switch apps, or let a gesture take over (a trackpad's swipe, a touchscreen's palm): the drag ends where it was, on each system.
- [ ] View ▸ Zoom to Fit (⇧1) and Zoom to Selection (⇧2) fill the canvas with the drawing and with the selection.
- [ ] A code block of several lines stays visible while typing and fits after Escape.
- [ ] Diagram from Code: the preview keeps up while typing; switching engine visibly changes it; dragging a container brings its contents; a shape recolours.
- [ ] Arrow heads and labels match between the canvas and an export.
- [ ] By eye: line stubs, side dots, rounded corners, the anchor disc, cursors, a code block's bottom edge.
- [ ] Submenus: the highlight in light theme, and moving between them by mouse.
- [ ] While dragging a shape, an `x · y` readout shows below it and clears on release.
- [ ] Copy shapes and an arrow between them in one Bava window, paste in another: the same shapes, the arrow attached; on each system.
- [ ] Paste text from a browser and from an email app onto the canvas: one text element, its lines kept, a long paragraph wrapped.
- [ ] Copy shapes, then paste into a vector drawing app: the picture shows.
- [ ] Drop a picture from the Finder, Explorer and a Linux file manager onto the canvas: it lands where dropped; a PDF dropped there stays out.
- [ ] Paste a screenshot onto the canvas; drag a picture from Media onto it; File ▸ Picture.
- [ ] A canvas picture in a PDF export and in a frame embed; copy shapes with a picture into another Space and it comes along.
- [ ] Rename a picture in Media: every canvas showing it follows.

## Media

- [ ] macOS: a video shows its first frame until play, then plays in place.
- [ ] A YouTube card shows its thumbnail and opens in the browser; other online videos play in the page.
- [ ] Keyboard pass: the Media section (rows, Enter) and the Media dialog's grid (arrows).
- [ ] Dropdowns and ⋯ menus inside dialogs (Media's Type and Sort, Tags' Sort, the Tags and Templates menus) open, take keys and give focus back.

## Export

- [ ] Save dialogs suggest `<page>.pdf` and a sensible zip name.
- [ ] A page's PDF looks like the screen: fonts, pictures, equations, code, tables, callouts; dark fills to the edge; page numbers at the bottom centre of every page, the page itself showing under them; the Canvas on its own sheet.
- [ ] A Space's PDF: the contents' numbers match the sheets, bookmarks nest folders over pages, dark contents, page numbers.
- [ ] A Space's PDF of pages not open: attached arrows end at their shapes' edges; a tall or wide Canvas stays on one sheet; embeds of other pages' frames likewise.
- [ ] A large Space's PDF counts "Drawing N of M", Cancel stops it, and the window stays usable.
- [ ] Unzip a Space zip and open it as a Space: pages, pictures, templates and settings are all there.
- [ ] Keyboard pass: Export page, Export Space and their PDF settings, and File ▸ Export.
- [ ] A large Space's zip counts "Writing N of M", and Cancel leaves no file; a Space's PDF says "Printing N pages", and Cancel leaves no file.

## Import

- [ ] File ▸ Import ▸ Folder and ▸ Files open the system's own dialogs (Files offers pages and zips only), and a folder's right-click Import does too.
- [ ] Import a folder of notes with pictures from elsewhere on disk: it lands whole, its pictures show, and its links between pages still work.
- [ ] Import the same folder again: it comes in numbered, and nothing is overwritten.
- [ ] Import a Space's zip into another Space: pages, pictures and templates arrive; the Space's own settings are untouched.
- [ ] A large import counts "Importing N of M", the window stays usable, and Cancel leaves the Space as it was.
- [ ] Escape while importing, writing a zip or printing stops it; the dialog stays until it has stopped, then the status bar says it was cancelled.
- [ ] Import a zip made on a Linux machine holding "Plan: Q4.md" and both "A.md" and "a.md": the first is listed as left behind, the others come in as "A" and "a 2".
- [ ] Inside each store's sandbox: import a folder from outside the Space, and a page whose pictures sit outside the picked folder: those pictures stay missing with their links kept.
- [ ] Keyboard pass: the Import dialog, Into, Import and Cancel.

## Search

- [ ] ⇧⌘F and File ▸ Search open the palette.
- [ ] Keyboard pass: the palette, the page's find bar and the Canvas's (⌘F).
- [ ] ⇧⌘P (Ctrl+Shift+P) opens the command palette on each system, in the page, on the canvas and in the code editor; Undo run from it undoes where you were typing; a command that cannot run now is not offered.
- [ ] Searching a large Space is quick and shows at most 50 rows.

## Menus and keys

- [ ] Windows and Linux: the native menus show and every item works, punctuation shortcuts included (⌘, ⌘= ⌘- ⌘/ ⇧⌘[ ⇧⌘]).
- [ ] ⌘Z undoes in whichever editor has focus; Cut, Copy and Paste work on the canvas, the page and in a text field.

## Look

- [ ] The look on each system's webview, both themes; mono labels, sizes, dates and counts at real size.
- [ ] Icons at 16px (Finder list, Windows taskbar, Linux launcher) and 1024px.
- [ ] The mark in the title bar, the empty state and About.

## Logs and errors

- [ ] In a release build, a forced Go panic and a frontend exception both land in the log folder.
- [ ] With several errors queued, Escape dismisses one and the next still shows.
