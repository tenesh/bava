# Canvas work (15.4)

Decisions for Milestone 15.4, settled with the user one at a time. 15.4a:
zoom to fit and to the selection, a drag the system cuts off, labels that
fit their shape. 15.4b: the command palette. 15.4c: paste from other apps.
15.4d: SQL table and UML class shapes.

## Decisions

1. **A label longer than its shape makes the shape taller** (2026-10-12,
   drawn as the mockup's "4.8 A label longer than its shape"). Every line
   shows; the shape grows as the label needs, and resizing it smaller stops
   at the label's height. Its width stays the user's. In every shape the
   label keeps clear of curved and slanted edges: an ellipse's or a
   diamond's label sits in the box inside it. Shrinking the text and
   cutting it off with an ellipsis were drawn and not chosen.

2. **A word wider than its shape breaks across lines** (2026-10-12): it is
   split where it meets the edge and carries on the next line, and the
   shape grows taller as for any label. Nothing spills past the sides; the
   width stays the user's. Growing the shape wider, and leaving the word
   sticking out as before, were not chosen.

3. **Zoom to Fit and Zoom to Selection fill the view** (2026-10-12, drawn
   as the mockup's "4.9 Zoom to fit"). View ▸ Zoom to Fit (`⇧1`) and Zoom to
   Selection (`⇧2`) zoom in or out, as far as it takes, to show what they fit
   with a margin, centred, within the canvas's limits (10% to 800%): one
   small box fills the view. Never zooming in past 100% was drawn and first
   chosen, then changed by the user the same day.

4. **A diamond's label keeps to its middle half** (2026-10-12, drawn as the
   mockup's "4.10 One word in a diamond"), and so every shape keeps its
   label in the box inside its outline, even when one short word must break
   there; the shape grows to hold the pieces. Widening the box toward the
   points until the longest word fits, and letting a label run over the
   slanted edges as before, were drawn and not chosen.

## 15.4b: the command palette

5. **The palette holds commands only** (2026-10-12, drawn as the mockup's
   "8.1 What the palette holds"): every menu command by name, with its menu
   path and its keys; Enter runs it; commands that cannot run now are left
   out. Pages stay with Search (⇧⌘F). Commands with pages, and one palette
   for commands, pages and words inside pages, were drawn and not chosen.

6. **⇧⌘P opens the palette** (2026-10-12; Ctrl+Shift+P on Windows and
   Linux). ⇧⌘K (beside ⌘K, Link) and ⌘P (Print elsewhere) were not chosen.

7. **Opened, the palette lists recent commands, then all by menu**
   (2026-10-12): the last few run from it at the top, then every command
   grouped by menu in menu order. The recent ones are kept in memory for the
   session, never saved. Listing all with nothing recent, and listing
   nothing until typed, were not chosen.

## 15.4c: paste from other apps

8. **Copied shapes go on the system clipboard as an SVG picture** (2026-10-13),
   with Bava's own data inside it, so Bava pastes them back as the same
   shapes in any window or page; other apps get the picture (vector drawing
   apps) or its markup (text editors). The `bava-canvas` block as text, and
   the words alone, were not chosen. The clipboard carries text only, so the
   SVG travels as text.

9. **Text pasted from another app becomes one text element** (2026-10-13),
   its line breaks kept, wrapped at a set width so a long paragraph is not
   one endless line; one undo step. One element per paragraph, and a shape
   per line, were not chosen.

10. **A picture pasted on the canvas becomes a picture element** (2026-10-13):
    a new kind of canvas element, its file saved in the Space's attachments,
    movable and resizable, drawn in exports and embeds. Saying where pictures
    can go instead (the page) was not chosen. Planned as its own part after
    the text and shapes paste.

11. **Pictures also come by drop, Insert ▸ Picture and Media** (2026-10-13):
    image files dropped on the canvas land where dropped; Insert ▸ Picture
    (and the canvas's + menu) opens the file picker; a picture dragged from
    the Space's Media reuses its attachment.

12. **A picture keeps its proportions when resized** (2026-10-13); Shift frees
    it, the opposite of shapes. Resizing freely like shapes was not chosen.

13. **A table's or class's rows are typed as lines** (2026-10-13): a
    double-click opens the whole body as text, one row a line, and leaving
    draws it. Editing cell by cell, or both ways, was not chosen.

14. **The file keeps the lines as typed** (2026-10-13): the element stores
    its name and its rows as one text, exactly as written; the columns are
    worked out each time it is drawn. Splitting rows into separate values in
    the file (normalising what was typed) was not chosen.

15. **An arrow attaches to a table's row** (2026-10-13): dropped on a row, it
    attaches beside that row and follows it when rows above are added or
    removed; a D2 diagram's links between columns arrive this way.
    Attaching only to the table as a whole was not chosen.

16. **A class's methods are told by their brackets** (2026-10-13): a line
    with ( ) is a method, any other a field; fields are drawn above a
    divider and methods below, whatever order they were typed in. A leading
    +, -, # or ~ is public, private, protected or package. A divider the
    user types was not chosen.

17. **Tables and classes are added from a Diagram group, or arrive from a D2
    diagram** (2026-10-13): the + panel's new "Diagram" category holds D2
    diagram, SQL table and UML class. A table or class is placed by a click
    or a drag, as a shape is, and opens for typing at once. D2's `sql_table`
    and `class` convert into them. No rail button or key of their own.
    Adding them only through the D2 diagram, a "Table and class" category
    of their own, and tiles in the Shape category were not chosen.

18. **Diagram from Code is renamed D2 diagram, and what adds to the canvas
    is grouped in the Canvas menu** (2026-10-13). "D2 diagram" everywhere: the
    menu, the + panel, the page's / menu, the dialog, the code's names, file
    names and living docs (names stored on disk, past plans, specs and
    decision rows unchanged). File ▸ Diagram from Code and File ▸ Picture
    move to the top of the Canvas menu: a Diagram submenu (D2 Diagram, SQL
    Table, UML Class) and Picture, all in the command palette. Naming the
    language the user writes is not a comparison, as the dialog's "Write D2"
    already did. Removing the feature, hiding it, leaving the items in File,
    and taking them off the menu were each considered and not chosen.
