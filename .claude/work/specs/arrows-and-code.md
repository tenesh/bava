# Arrows and lines that behave as drawn, and resizable code blocks (06.12)

> Historical: implemented (or superseded); kept as the record.

Decisions made with the user, recorded as they are made. Follows the user's
window report of 2026-09-26: code blocks cannot be resized; a selected line or
arrow shows box handles that do nothing; an end dropped on a shape's far side
lands on the near side; elbows do not route around shapes.

## Decisions

1. **A code block is resized like a shape, and wraps** (2026-09-26). The user
   sets its width (and it keeps it); long lines wrap onto the next line and the
   height grows to fit, so nothing is ever hidden. Reverses the 2026-09-20
   decision "A code block is sized by its code, and has no resize handles" and
   the 20-column floor of 06.9; `docs/file-format.md` and `docs/decisions.md`
   change before the code.

2. **Where an attached end sits: on the side that faces the other end**
   (2026-09-26). Straight and curved arrows keep to the facing side: the end
   sits where the line from its anchor towards its neighbour leaves the
   outline (orbit mode; today's Bava behaviour), so an arrow never crosses
   the shape it points at. A straight arrow dropped on B's bottom with A
   above ends on B's top. Elbow arrows keep the side the end was dropped on
   and route around the shapes, since an elbow's sides are what the user
   chose (`.claude/work/specs/arrows.md`).

3. **What a selected line or arrow shows: only what can be used**
   (2026-09-26, the user's choice). A two-point line or arrow, and
   any elbow arrow, shows no box, no resize handles and no rotation handle:
   only its point handles (and, for a two-point one, its middle). A bent line
   or arrow shows the box with its four corners and the rotation handle.
   Point handles are 5 screen px in radius, hit within 11; a middle handle is
   5 px, hidden under 40 px, and adds a point only after a 10 px drag. Box
   handles on a line with nothing to resize did nothing, so they are gone.

4. **The rest of a full arrow toolset comes in too** (2026-09-26): pinning an
   end inside a shape ("inside" mode; Alt forces it, Cmd/Ctrl
   turns attaching off, replacing Bava's Alt-means-free), a point-edit mode
   (double-click a line or arrow; outside it only a two-point one shows a
   middle handle), click-by-click drawing, and the drag details (Shift snaps a
   dragged point to 15°, the grab offset is kept, a new arrow needs a 20 px
   drag). Split for review: 06.12 carries decisions 1 to 3 and the drag
   details; 06.13 carries inside mode, point-edit mode and click-by-click
   drawing.

5. **An elbow's route is stored in its points** (2026-09-26, chosen by the
   user): the file holds the route the user sees. Switching a bent arrow
   to elbow replaces its bends with the route; switching away keeps only its
   ends. This amends 06.10's "switching kinds never loses a bend".

6. **Fewer shortcuts: only what is necessary** (2026-09-26, reviewed with the
   user). Kept: the universal ones (New, Open, Save, Save As, Undo, Redo, Cut,
   Copy, Paste, Select All, Delete, zoom in/out/actual size, Settings, and the
   platform roles), the canvas ones (tool letters V R O A L D T F C E, Esc,
   Enter, Delete, arrows with Shift for five, Space to pan, Duplicate, Group,
   Ungroup, Bring Forward, Send Backward), Flip (⇧H ⇧V), Lock (⇧⌘L) and the
   views (⌘1 ⌘2 ⌘3). Dropped as keys (the commands stay in menus, toolbar and
   right-click): Align left/right/top/bottom, Distribute, Bring to Front, Send
   to Back, Copy/Paste Styles, Copy as PNG, Unlock All, View Files, AI Pane,
   Help ▸ Keyboard Shortcuts, Export, Diagram from Code, Tab/⇧Tab, and `/`.
   Also from the audit: editors drop the platform-role keys too (Ctrl+M), the
   code block editor drops the menu's keys and indents with Tab, and
   `docs/shortcuts.md` is corrected (no ⌘D in the source editor; the code
   editor's Esc and Enter).

## 06.13

7. **Inside mode** (2026-09-26). An end dropped strictly inside a shape is
   pinned there: it sits at that spot, inside the shape, and moves with the
   shape (a plain inside test), so an arrow can point at a place within a
   shape, not only at its edge. An end dropped just outside, within
   reach, attaches to the edge (orbit, as today). Alt pins wherever the end
   lands on a shape; Cmd/Ctrl while dragging leaves the end unattached,
   replacing Bava's Alt-means-free. Stored
   per end as `startMode`/`endMode: "inside"` beside the anchor (absent is the
   edge). An elbow end is never pinned inside: an elbow attaches at an
   edge only, where its route can leave the shape.

8. **Point-edit mode** (2026-09-26, decision 4). Entered by
   double-clicking a line, Cmd/Ctrl+double-clicking an arrow (a plain
   double-click still edits its label), or Enter on a selected line. In it:
   every point and every segment middle is a handle; a click selects a point,
   Shift-click adds, a drag moves the selected points together; Delete
   removes the selected points (never below two); Alt+click on the canvas adds
   a point after the last. Escape, or a press off the element, leaves it.
   Outside the mode, only a two-point line or arrow shows its middle handle,
   so bends on a bent one are added in the mode, and a selected line stays
   uncluttered.

9. **Click-by-click drawing** (2026-09-26, decision 4). With
   the line or arrow tool, a press released before 20 px starts a multi-point
   line: each click adds a point, the next segment follows the pointer, and a
   click within 8 px of the last point, Enter or Escape finishes it. A drag still
   draws a two-point one. An arrow drawn this way attaches its first and last
   points as a dragged one does.

## 06.14

10. **A code block's height is resizable, taller only** (2026-09-26). The user
    can make a block taller than its code (empty space below it) but never
    shorter, so nothing it holds is hidden. Its width stays the user's, and
    its lines wrap to it. The height is stored as the block's `h`; the
    wrapped code's height is its floor.

11. **Lines and arrows: complete, from a checklist** (2026-09-26). The user
    asked why arrows still did not feel finished; slices had left parts out
    (elbow segments among them). The next milestone starts from a full
    inventory of line and arrow behaviour, agreed with the user, and builds
    every remaining item, elbow segment dragging included.

12. **All 90 items of the line and arrow inventory are built** (2026-09-26),
    in three milestones: 06.14 elbows (E), selection chrome, handles and
    cursors (S), the duplicate/paste bug (B23) and code block height; 06.15
    point editing (P) and creation (C); 06.16 binding (B), arrowheads (H),
    labels (L), curves (V), styling (T), transform (X) and the rest (O).
    Where an item conflicts with an earlier Bava decision, the inventory's
    behaviour wins unless the user says otherwise when the plan is presented.

13. **New arrows curved, new lines round** (2026-09-27): a new arrow or
    line bends smoothly as soon as it gains a point. The kind is written into each new element; absent keys keep their meaning. A
    two-point curved arrow is straight (inventory V2, built in 06.15).

14. **Three shortcuts added** (2026-09-27): `Q` keeps the tool; `⌘`/`Ctrl`+
    `Enter` edits an arrow's points; `⌘`/`Ctrl`+`D` in point editing
    duplicates the selected points.

15. **Neither delete removes by surprise** (2026-09-27): in point editing,
    `Delete` with no point selected does nothing; double-clicking a bend does
    nothing, so a stray key or click never loses the line or its shape.

16. **An arrow's label sits on its middle point** (2026-09-27), on the
    drawn line of a bent arrow. The middle point for an odd number of points, else the middle of the
    middle segment; a label the user slid keeps its `labelPosition`. Replaces
    Bava's halfway-along-the-length default.

