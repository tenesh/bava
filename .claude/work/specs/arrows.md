# Arrows you can shape (Milestone 06.10)

Decisions made with the user, recorded as they are made. Background and
Excalidraw references: `.claude/work/specs/excalidraw-comparison.md`, section
3 and appendix A2.

## Decisions

1. **Arrows and lines are both bendable** (2026-09-26). Both get points the
   user can add, drag and delete, edited the same way; a line is an arrow
   without heads. As Excalidraw does.

2. **A bend is added by dragging the middle of a straight piece** (2026-09-26).
   A selected arrow or line shows a handle at the middle of each segment;
   dragging it inserts a point there. Existing points are handles to drag;
   double-clicking one deletes it. No separate editing mode, and no
   click-by-click drawing.

3. **Bends by arrow kind** (2026-09-26). Straight: bends are sharp corners.
   Arc: the curve passes smoothly through the bends (with none, it keeps
   today's single bow). Elbow: routes itself and shows no bend handles; bends
   already made stay in the file and return when switched back. Switching
   kinds never loses anything. A line's `edges: round` smooths through its
   bends as an arc does.

4. **An attached end aims at the spot it was dropped on: Excalidraw's edge
   mode** (2026-09-26). Each attached end remembers a spot on its shape, as a
   fraction of the shape's box. The end stops on the outline, a gap clear of
   it, on the line from that spot towards the arrow's neighbouring point (the
   next bend, or the other end), and keeps aiming there as either shape moves.
   Dropped just outside a side, within reach of its middle, it snaps to that
   middle (Excalidraw's rule for ordinary arrows). No "inside"
   mode. An end with no remembered spot (every existing file) aims at the
   shape's centre, which is today's behaviour. Changes what Bava writes: one
   value per attached end, specified in `docs/file-format.md` before the code.

5. **Dragging an attached arrow's body lets it go** (2026-09-26). The arrow
   moves, and each end attached to a shape that is not moving with it
   detaches (its binding and remembered spot are removed). Dropping an end
   back on a shape reattaches it. As Excalidraw does.

6. **An arrow's label can be slid along it** (2026-09-26). Dragging a label
   moves it along the path; its place is stored as a fraction of the path's
   length, and it follows the bends. Absent means the middle, today's
   behaviour. One more value in the file.

7. **Alt on a handle edits the handle** (2026-09-26, from review). Alt on an
   arrow's end already means "drag it but leave it unattached", so Alt on any
   handle of the selected line or arrow (an end, a bend, a segment's middle, the
   label) keeps editing that handle. An Alt-copy starts from anywhere else on
   it. Shift, by contrast, skips the handles so Shift-click still deselects.
