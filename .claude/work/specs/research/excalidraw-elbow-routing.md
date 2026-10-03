# Excalidraw's elbow arrow routing (reference for 06.12)

Read 2026-09-26 from Excalidraw (MIT) at `5db42c3`. Paths relative to its
`packages/`; `EA` is `element/src/elbowArrow.ts`. Behaviour and constants are
adopted; no code is copied (so no NOTICE entry). Units are scene px.

## Constants
| Name | Value | Where |
|---|---|---|
| `BASE_PADDING` | 40 | EA:111 |
| `DEDUP_TRESHOLD` | 1 | EA:110 |
| binding gap | 5 + strokeWidth/2 | binding.ts:117,125-131 |
| binding reach | clamp(15/(1.5·min(zoom,1)), 15, 30) | binding.ts:133-143 |
| search cone multiplier | 2 | heading.ts:236 |
| unbound end box | point ± 2 | EA:1296-1307 |

## Headings
Unit vectors RIGHT, DOWN, LEFT, UP (heading.ts:31-34). `vectorToHeading(v)`:
x > |y| RIGHT; x <= -|y| LEFT; y > |x| DOWN; else UP (heading.ts:37-49).
- Unbound end: heading towards the other end.
- Bound end near its shape: `headingForPointFromElement`: the shape's rotated
  box scaled 2x about its centre, split into four triangles (top, right,
  bottom, left) by the centre; the triangle the point is in names the side
  (heading.ts:231-281). Headings point outward from the shape.
- Bound end far away: heading of (point - shape centre).

## Boxes and grid
- Each bound shape's box: its rotated box padded on the heading side by
  gap·6 with an arrowhead, gap·2 without, 1 elsewhere (EA:1308-1333).
- Overlap: start point strictly inside the end box padded 40, or the reverse
  (EA:1334-1354). Then point boxes are used and no side splitting.
- Dynamic boxes (EA:1666-1842): each shape's box grown by padding (heading
  side 40 - (30 with arrowhead, else 10), other sides 40; overlapping: 40 on the
  heading side, 0 elsewhere). Facing edges of the two boxes meet at the midline
  between the shapes; outer edges reach the common bounds plus padding.
- Grid (EA:1851-1906): x lines at both dynamic boxes' left/right edges, the
  common bounds' left/right, and the start/end x when that heading is
  vertical; y lines likewise. Nodes at every intersection.
- Dongles (EA:1908-1922): each end projected onto its dynamic box's edge in
  its heading direction. The search runs dongle to dongle.

## Search (A*, EA:1535-1644)
- 4-connected over grid addresses. Skip a neighbour when: closed; the move's
  midpoint is strictly inside either dynamic box; it reverses the previous
  direction (the start heading at the start); it would reach the end dongle
  moving in the end heading (coming from inside the shape).
- bm = manhattan(start dongle, end dongle).
- g = g + manhattan(step) + (direction change ? bm³ : 0).
- h = manhattan(to end) + estimatedBends · bm², where estimatedBends (0 to 4)
  comes from the current and end headings and relative position
  (EA:1924-2037). Bends are minimised first, length second.
- If either dongle is inside the other's dynamic box, search with no
  obstacles. No path: no route (fall back to a straight Z).
- Result: start point + path + end point.

## Post-processing (EA:1101-1119)
Drop interior points within 1 px of the previous; drop interior points where
the path continues on the same axis; store points relative to the first; angle
is always 0.

## Moving shapes, fixed segments
A bound shape moving recomputes the ends and re-runs the search. Fixed
(user-dragged) middle segments are stored as `fixedSegments` and kept across
moves; out of scope for 06.12 unless decided otherwise.
