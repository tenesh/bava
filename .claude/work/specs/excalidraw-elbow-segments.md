# Excalidraw's elbow fixed segments, and a design for Bava

Read-only study of Excalidraw (MIT) at the commit vendored in the scratchpad.
Paths are relative to `packages/`. `EA` is `element/src/elbowArrow.ts`, `LEE`
is `element/src/linearElementEditor.ts`, `APP` is
`excalidraw/components/App.tsx`. Descriptions only; no code is copied.

Companion: `excalidraw-elbow-routing.md` (the router itself) and
`excalidraw-lines-inventory.md` rows E7 to E11.

## 0. The one idea

A fixed segment does not store a position the route must reach. The position
lives in `points`, like every other segment. `fixedSegments` only marks
**which segment, by index, the router must not touch**, and records its two
ends so a drag can tell which entry changed. After every operation Excalidraw
re-derives each entry's `start`/`end` from the points (EA:880-885). Once any
segment is fixed, the arrow stops being routed: it keeps its exact number of
segments and only the legs at each end adapt (EA:1150-1155).

## 1. Data

- `FixedSegment = { index, start, end }` (`element/src/types.ts:385-389`).
  `start` and `end` are `LocalPoint`s.
- **Coordinate space.** Local to the arrow's `x, y`. For an elbow,
  `normalizeArrowElementUpdate` (EA:2102-2154) always rebases so that
  `x, y` is the first point and `points[0]` is `[0, 0]`; so fixed segment
  coordinates are relative to the arrow's start point. Positions are clamped
  to plus or minus 1e6 (`MAX_POS`, EA:902, 2118-2141).
- **Index.** Segment `i` runs from `points[i-1]` to `points[i]`. Valid indices
  are `1 .. points.length-1`. The midpoint handle for index `i` is the middle
  of those two points (LEE:976-990); handle indices are 1-based for the same
  reason (LEE:1020-1045 returns `position + 1`).
- **Order.** Kept sorted by index (LEE:2317-2319); release relies on array
  neighbours being index neighbours (EA:303-304).
- **Absent or empty** means fully routed; the element stores `null`, never
  `[]` (EA:2148-2149).
- **Invariants** (dev-only asserts, EA:934-976): every fixed segment is
  horizontal or vertical; every route segment is horizontal or vertical; the
  first segment (index 1) and the last (index `len-1`) are never fixed. The
  last is enforced for real only by renormalisation, which drops such
  entries (EA:232-235).
- **Two companion flags** on the element, `startIsSpecial` and
  `endIsSpecial` (`types.ts:405-420`): true when the first (last) leg is a
  generated 40-unit stub pair, so the next end move regenerates it rather
  than keeping it (section 5).

## 2. Dispatcher: `updateElbowArrowPoints` (EA:907-1167)

Every `mutateElement` on an elbow with `points` or `fixedSegments` in the
update, or with an empty update, goes here (`element/src/mutateElement.ts:56-75`).
Order of checks:

1. Fewer than 2 points: return as is (EA:922-924).
2. A 2-point update means "new start and end, keep the middle": expanded to
   the full array with only first and last replaced (EA:981-991). This is how
   bound-shape moves arrive (LEE:1697-1702 sends only the two ends).
3. Missing bound element, empty scene, or binding id mismatch with no other
   update: normalise the given points as they are (EA:1016-1032, 1060-1069).
4. **Renormalise** when the update carries none of points, fixedSegments,
   startBinding, endBinding (EA:1074-1081). App sends `{}` on pointer-up after
   a linear-element interaction (APP:11608-11619) and after dragging a shape
   with bound elbows (APP:11557-11571).
5. No-op short circuit when bindings and points are unchanged (EA:1084-1096).
6. **No fixed segments**: full route (EA:1101-1120). Note this runs before
   release: releasing the last fixed segment is a plain full reroute.
7. **Fewer fixed segments than before**: `handleSegmentRelease` (EA:1124-1126).
8. **No points in the update** (only fixedSegments): `handleSegmentMove`
   (EA:1131-1140).
9. Points and fixedSegments both given (resize): taken verbatim (EA:1145-1147).
10. Otherwise, ends moved with fixed segments present: `handleEndpointDrag`
    (EA:1156-1166).

Ends and headings come from `getElbowArrowData` (EA:1192+). A bound end's
heading is the side of the shape it sits on; a free end's heading is simply
toward the other end point (`element/src/binding.ts:1559-1563`). Outside a
drag, the "hovered" elements are just the bound ones (EA:1227-1242).

## 3. Dragging a segment

### 3.1 Pointer path (APP:10662-10711, LEE:2269-2354)

- Active when an elbow is selected and the press landed on a segment
  midpoint handle (`initialState.segmentMidpoint.index`). Handles are hidden
  on segments shorter than `POINT_HANDLE_SIZE / 2` = 5 screen px
  (LEE:231, 943-948, 836-848), so those cannot be grabbed.
- Each pointer move: the pointer is grid-snapped unless Ctrl/Cmd is held
  (APP:10670-10674). If the stored index is negative it is re-found by hit
  test (APP:10676-10693).
- `moveFixedSegment(index, x, y)` (LEE:2269-2356) accepts any index
  `1 .. len-1`, including first and last (LEE:2289):
  - Orientation of the segment from its current two points (LEE:2290-2294).
  - **The move is absolute, not a delta**: a horizontal segment takes the
    pointer's `y`, a vertical one the pointer's `x`; the along-axis
    coordinates stay those of `points[index-1]` and `points[index]`
    (LEE:2303-2313). Since the handle sits on the segment the jump is small,
    but it exists.
  - The entry is inserted or replaced in an index-keyed map, then sorted
    (LEE:2296-2319), and written as `fixedSegments` only. **The segment is
    fixed from the first pointer move**; a click without movement fixes
    nothing.
  - Tracking across moves: before mutating it counts fixed entries with a
    lower index (`offset`, LEE:2321-2323); after the mutation (which may
    insert stub points and shift indices) the moved segment is
    `fixedSegments[offset]`, whose new index becomes the handle's index for
    the next move (LEE:2329-2354). So the drag follows the segment by its
    ordinal among fixed segments, not by its index.

### 3.2 `handleSegmentMove` (EA:465-704)

Inputs: the arrow before the move and the proposed `fixedSegments`.

1. **Which entry moved** (EA:473-495): the first entry whose index is new at
   that array position, or whose `start` and `end` both changed in exactly
   one axis (x changed on both, xor y changed on both). None: return points
   unchanged.
2. `firstSegmentIdx` / `lastSegmentIdx`: whether index 1 / index `len-1` was
   already fixed in the old list (EA:497-502; normally never).
3. **First-segment padding, bound start only** (EA:504-532). If the moved
   entry is index 1 and the start is bound: let `L` be the moved segment's
   length; if `L < BASE_PADDING + 5` (45) the pad is `L/2`, else
   `BASE_PADDING` (40), signed by the start heading (positive for right and
   down). The moved segment's `start` is pushed that far along the heading
   axis, so the dragged piece begins 40 out from the shape.
4. **Last-segment padding, bound end only** (EA:534-558): the same for index
   `len-1`, pushing its `end` along the end heading.
5. Everything to scene space (EA:560-576).
6. **The two points of the moved segment**: with `startIdx = index-1` and
   `endIdx = index`, `points[startIdx] = start`, `points[endIdx] = end`
   (EA:601-602). Before that, the orientation of the neighbouring segments is
   read (EA:582-594, skipping a neighbour of zero length), and the outer
   neighbour points get the moved coordinate on the axis that keeps their
   segment orthogonal: `points[startIdx-1]` takes `start`'s y if the previous
   segment is horizontal, else its x (EA:597-600); likewise
   `points[endIdx+1]` from `end` (EA:603-606). For a perpendicular move this
   is a no-op on the outer points; the two perpendicular neighbours simply
   stretch or shrink.
7. **Neighbouring fixed segments** (EA:608-637): a fixed segment at
   `startIdx` gets its `end` set to the moved `start` (and its `start`
   realigned on its own perpendicular axis); a fixed segment at `endIdx+1`
   gets its `start` set to the moved `end`. They lengthen or shorten, they
   never move sideways.
8. **Stub at the start** (EA:639-663), when index 1 was not already fixed and
   `startIdx === 0` (the first segment was dragged): the start leg's axis is
   the start heading's axis if bound, else the axis of the (already moved)
   first segment. Prepend a corner point: on that axis it takes the moved
   `start`'s coordinate, on the other the original start point's. If bound,
   also prepend the original start point (point 0 was overwritten by step 6).
   Every fixed index shifts by 2 if bound, 1 if free.
   - Bound, heading right, first segment horizontal dragged to `y'`:
     `S, (S.x+40, S.y), (S.x+40, y'), (p1.x, y'), p2, ...`; the dragged
     segment is now index 3.
   - Free: `S, (S.x, y'), (p1.x, y'), ...`; now index 2.
9. **Stub at the end** (EA:665-686), when `endIdx === len-1`: append a corner
   point (end heading's axis: moved `end`'s coordinate on it, original end
   point's on the other), then the original end point if bound. No index
   shift (indices count from the start). Quirk: the axis always comes from
   `endHeading`, even for a free end, whose heading points at the start; when
   that axis disagrees with the dragged segment, the appended corner equals
   the moved `end` and the true end point is lost. The start side avoids this
   by using the segment's own axis when free (EA:641-643).
10. Normalise; **both special flags become false** (EA:688-703).

Renormalisation does not run inside the move; it runs on pointer-up
(section 6).

## 4. Releasing a segment (double-click its handle)

### 4.1 Pointer path (APP:7268-7329, LEE:2358-2368)

On double-click with an elbow selected, the midpoint handle under the pointer
gives an index; `deleteFixedSegment` writes `fixedSegments` without that
index. Then the hovered handle is recomputed, since indices may have changed.
Double-clicking a segment that was not fixed changes nothing (the move
handler finds no moved entry). Releasing the only fixed segment goes to the
full route (EA:1101), not to the release handler.

### 4.2 `handleSegmentRelease` (EA:282-460)

1. The removed entry is the first old index missing from the new list
   (EA:287-298). `prev` and `next` are its array neighbours in the old list:
   the nearest fixed segments on each side, or none (EA:302-304).
2. **Sub-route** (EA:306-342): from `prev.end` (or, with no `prev`, the
   arrow's start with its start binding) to `next.start` (or the arrow's end
   with its end binding). A side that has a fixed neighbour routes as a free
   point: no binding, heading toward the other end. Arrowheads are ignored
   for padding. Routed with the normal pipeline: route, drop short segments,
   keep corners (EA:344-361).
3. **Splice** (EA:369-402): old points `0 .. prev.index-1` (up to and
   including `prev.start`), then the sub-route (which begins at `prev.end`
   and ends at `next.start`), then old points `next.index .. len-1` (from
   `next.end`). Without `prev` the head is the sub-route; without `next` the
   tail is.
4. **Reindex** (EA:404-420): entries after the removed index shift by
   `restored.length - (next.index - prev.index)` (with `prev.index` 0 and
   `next.index` `len` when absent).
5. **Tidy the joins** (EA:422-452): walk the result; a point whose incoming
   and outgoing headings are equal is dropped (indices after it minus 1); a
   point where the heading reverses (a U-turn along one line) is doubled,
   inserting a zero-length segment so horizontal and vertical keep
   alternating (indices after it plus 1).
6. Normalise; both special flags false (EA:454-459).

## 5. Ends moving with fixed segments present: `handleEndpointDrag` (EA:706-900)

Used when an end is dragged or a bound shape moves (2-point update). Key
rule: keep the interior exactly, rebuild only the point next to each end.

1. **Kept points** (EA:742-747): indices `2 + s .. len-1 - (2 + e)` of the
   old points, where `s`/`e` are 1 when that end is special. So the old point
   1 (or the stub pair at 1 and 2) and the old second-to-last point (or the
   stub pair) are discarded; everything between is kept verbatim, fixed or
   not.
2. **Start leg** (EA:749-814). `second` = old point `1+s`, `third` = old point
   `2+s`; the kept segment `second -> third` has an axis.
   - **Parallel case**: start is bound and the start heading's axis equals
     that segment's axis (so a single corner would make the arrow leave the
     shape along its side). Insert two points: `A` = start moved
     `BASE_PADDING` (40) along its heading; `B` = on the kept segment's line
     at `A`'s along-axis coordinate (for a horizontal kept segment:
     `(A.x, third.y)`). The route is `S, A, B, third, ...`; `B` replaces the
     old `second` as the start of the kept segment. If the start was not yet
     special, it becomes special and every fixed index above 1 shifts by +1
     (EA:789-796).
   - **Normal case**: one corner, perpendicular to the kept segment: for a
     horizontal kept segment `(S.x, second.y)`, for a vertical one
     `(second.x, S.y)` (EA:798-803). If the start was special, it stops
     being so and fixed indices above 1 shift by -1 (EA:804-811).
   - Then the start point itself is prepended.
3. **End leg** (EA:816-876): the mirror, with `secondToLast` = old point
   `len-2-e` and `thirdToLast` = `len-3-e`, the end heading, and 40 along it.
   Toggling `endIsSpecial` never shifts indices.
4. **Fixed segments are re-derived** from the new points: each keeps its
   index, `start = points[index-1]`, `end = points[index]` (EA:878-885).
5. Consequence: the kept segments keep their perpendicular positions; the
   segment next to each leg changes only in length. A special stub always
   sits exactly 40 from the shape and follows it; a normal corner keeps its
   along-axis coordinate from the old point, so it does not follow the shape
   (it can even run back through it when the shape moves past it; Excalidraw
   does not guard that).
6. Throws if fewer than three points exist on a side (EA:754-758, 825-829).

## 6. Renormalisation: `handleSegmentRenormalization` (EA:113-280)

Runs on pointer-up (section 2 step 4). Only when fixed segments exist; else
returns the arrow unchanged (EA:272-279).

1. **Collinear pass** (EA:124-176), over the original points, from i = 2:
   when segment `i` has the same heading as segment `i-1` (same direction,
   not just the same axis; a zero-length segment counts as heading left by
   `vectorToHeading`, `element/src/heading.ts:36-48`), point `i-1` is a
   straight-through. If segment `i` is fixed its `start` becomes
   `points[i-2]`; if segment `i-1` is fixed it is removed (so a fixed
   segment merged into an unfixed successor loses its fixed status); the
   point is dropped and every index above `i-1` minus 1.
2. **Degenerate pass** (EA:178-230), over that result, from i = 3: when
   segment `i-1` is shorter than `DEDUP_TRESHOLD` (1), segments `i-2` and
   `i-1` are removed (and their fixed entries), points `i-2` and `i-1`
   dropped, indices above `i-2` minus 2, and point `i` replaced by a point
   that keeps segment `i-2`'s line: horizontal segment `i` gives
   `(p.x, points[i-2].y)`, vertical gives `(points[i-2].x, p.y)`. The first
   segment is never examined.
3. Drop fixed entries at index 1 or `len-1` (EA:232-235).
4. **None left**: full reroute from the current ends, flags null
   (EA:236-256). This is visible as a jump on release.
5. Otherwise normalise, keeping both special flags (EA:258-269).

## 7. Edge cases and constants

| Name | Value | Where | Meaning |
|---|---|---|---|
| `BASE_PADDING` | 40 | EA:111 | stub length; also router padding |
| short-segment threshold | `BASE_PADDING + 5` = 45 | EA:509 | below it the first/last-drag stub is `L/2` |
| `DEDUP_TRESHOLD` | 1 | EA:110 | degenerate segment length; also `validateElbowPoints` tolerance (EA:2293-2304) |
| `POINT_HANDLE_SIZE` | 10 px | LEE:231 | handles hidden under 5 screen px (LEE:946-947) |
| `MAX_POS` | 1e6 | EA:902 | clamp on normalised positions |
| grid snap | on unless Ctrl/Cmd | APP:10670-10674 | segment drag snaps the pointer |

- Special flags are cleared by any segment move or release (EA:701-702,
  457-458) and set only by end moves.
- Stubs from a segment drag are not special: a later shape move keeps their
  along-axis position (section 5.5), while stubs from an end move follow.
- `removeElbowArrowShortSegments` (EA:2184-2200) only acts on 4+ points;
  `getElbowArrowCornerPoints` (EA:2156-2182) keeps first and last and drops
  points where the axis does not change.
- A binding whose element is missing makes the dispatcher keep the points as
  given (EA:1016-1032).

## 8. Design for Bava

### 8.1 What differs in Bava

- `points` is a flat `[x0, y0, x1, y1, ...]` relative to the arrow's `x, y`,
  and `x, y` is the top-left of the drawn box, not the first point:
  `settledAround` (`canvas/binding.ts:529-547`) shifts `x, y` and every point
  whenever the box changes. Anything stored in the arrow's own coordinates
  must shift with it.
- `reroute` (`binding.ts:457-473`) runs after every change and every preview
  frame, and `elbowRoute` (`binding.ts:236-270`) ignores stored interior
  points: it routes from the two ends, cached by ends.
- A drag's preview is computed from the press-time scene each frame (one
  pointer path, preview equals release), so a segment drag never needs to
  track a shifting index within the drag.

### 8.2 Data in the file

`fixedSegments?: { index: number; start: [number, number]; end: [number, number] }[]`
on `arrow` with `arrowType: "elbow"`, sorted by index, in the arrow's own
coordinates (already in `docs/file-format.md:203`). Rules:

- `index` is the truth for which segment is frozen; `points` is the truth
  for where it is. `start`/`end` are always rewritten as
  `points[index-1]`, `points[index]` after every operation (Excalidraw
  EA:880-885 does the same), so the file stays readable and diffable and
  never disagrees with the route.
- On load, drop entries whose index is outside `2 .. pointCount-2` (first
  and last never fixed), whose two points are not axis-aligned, or
  duplicates. Empty after that:
  remove the key (fully routed).
- `settledAround` must shift `start`/`end` by the same `(-left, -top)` as the
  points, or simply re-derive them from the settled points.
- No `startIsSpecial`/`endIsSpecial` keys. Bava derives them (8.4, step 2).
- Switching arrow type, or the "to elbow" command, drops `fixedSegments`.

### 8.3 Module and types

A new pure module `canvas/elbow-segments.ts`, beside `elbow.ts`, working in
scene space on `Point[]` (convert at the boundary in `binding.ts`):

```ts
type Fixed = number[]; // sorted segment indices; start/end are derived
type End = ElbowEnd & { bound: boolean };
type Shaped = { points: Point[]; fixed: Fixed };
```

Constants: `ELBOW_PADDING = 40` (the planned `--size-elbow-padding` token
value), `ELBOW_SHORT = ELBOW_PADDING + 5`, `DEGENERATE = 1`.

### 8.4 Functions

**`moveSegment(points, fixed, index, coordinate, start: End, end: End): Shaped`**
Called by the pointer layer on every move of a segment drag, always on the
press-time points and fixed list.

1. `coordinate` is the new perpendicular coordinate: the segment's own
   coordinate at press plus the pointer delta on that axis (grid-snapped when
   Bava snaps). Bava uses a delta, not Excalidraw's absolute pointer, so the
   segment does not jump to the cursor on the first move.
2. Set that coordinate on `points[index-1]` and `points[index]` (the
   neighbours stretch; nothing else moves).
3. If `index === 1`: if `start.bound`, first move the segment's start along
   the start heading by `pad = L < ELBOW_SHORT ? L/2 : ELBOW_PADDING`
   (L = segment length, sign from the heading); then insert the corner
   (on the start leg's axis: the moved start's coordinate; on the other: the
   original start's) and, if bound, the original start again before it.
   Leg axis: the heading's if bound, the dragged segment's if free. Shift
   every fixed index by 2 (bound) or 1 (free).
4. If `index === last`: the mirror at the end, but take the leg axis from
   the dragged segment when the end is free (fixing Excalidraw's quirk in 3.2
   step 9). No index shift.
5. Add the (possibly shifted) index to `fixed`, keep sorted.

**`releaseSegment(points, fixed, index, start: End, end: End, route): Shaped | null`**
`route` is `routeElbow` (or a wrapper returning the Z fallback). Returns
null when `fixed` minus `index` is empty: the caller removes the key and
routes fully.

1. `prev` = largest fixed index below `index`, `next` = smallest above.
2. Sub-route ends: from `points[prev]` (prev's end) as a free end, or from
   `start` when there is no `prev`; to `points[next-1]` (next's start) as a
   free end, or `end`. Improvement over Excalidraw's "heading toward the
   other point": give a free sub-route end the direction it must continue
   in. At `prev.end` the heading is prev's direction of travel; at
   `next.start` the heading is the opposite of next's direction of travel.
   With Bava's search (`elbow.ts:162-234`, no reversal of the first heading,
   no arrival moving outward) this rules out the U-turns Excalidraw patches
   with doubled points.
3. Splice as 4.2 step 3; reindex entries above `index` by
   `subRoute.length - (next - prev)` (with `prev` 0 and `next` the point count
   when absent).
4. Drop straight-through points at the two joins, adjusting indices as 4.2
   step 5. With the headings of step 2 no reversal can occur; keep the
   doubling as a guard.

**`adaptEnds(points, fixed, start: End, end: End): Shaped`**
Called from `reroute` for every elbow with fixed segments. Must be
idempotent: same input ends, same output.

1. Needs at least 4 points; otherwise drop `fixed` and route fully.
2. Derive "special" without a stored flag: the start is special when it is
   bound, the stored first segment lies on the start heading's axis, and its
   length is `ELBOW_PADDING` within 0.5. The only way that shape arises
   besides Excalidraw's stub is a router leg of exactly 40; treating that as
   a stub gives the same points (the regenerated `A` and `B` coincide with
   the old ones), so the heuristic is safe. Same at the end.
3. Keep points `2+s .. last-2-e`, exactly as EA section 5 step 1.
4. Start leg and end leg exactly as section 5 steps 2 and 3 (parallel case
   inserts `A` at 40 along the heading and `B` on the kept segment's line;
   normal case one corner perpendicular to the kept segment). Adjust fixed
   indices by +1 or -1 only when the derived special state changes.
5. Optional guard Bava can add (not in Excalidraw): in the normal case, if
   the new corner lies behind the bound start (against its heading) and the
   kept segment after it is not fixed, move the corner to 40 along the
   heading instead, so a shape moved past the corner does not send the leg
   back through itself.

**`renormalise(points, fixed): Shaped | null`**
Section 6, with a tolerance of 0.5 for "same line" because `tidy` rounds
stored values. Returns null when no fixed index survives (caller routes
fully). One deliberate difference: on a collinear merge the merged segment
stays fixed if either part was (Excalidraw drops a fixed predecessor's
status, EA:157-162). Idempotent, so it can run on every `reroute`.

### 8.5 How `reroute` calls them

In `elbowRoute` (`binding.ts:236`), after computing `from` and `to` as today:

1. No `fixedSegments`: unchanged (cached full route).
2. With `fixedSegments`: skip the cache; take the stored points in scene
   space; `adaptEnds(points, fixed, from, to)`; then `renormalise`. A null
   from either means drop the key and fall through to the full route.
3. Return points and fixed indices; `routeFor` becomes able to return the new
   `fixedSegments` too (a second return value, or `reroute` calls an
   elbow-specific function), and `reroute` writes both through
   `settledAround`, which re-derives `start`/`end` from the settled points.
4. `changed` (`binding.ts:510-520`) also compares `fixedSegments`.

Pointer layer (`canvas/pointer.ts`):

- Segment drag: on press, snapshot points and fixed; each move calls
  `moveSegment` on the snapshot and writes points plus fixed; `reroute`
  then runs `adaptEnds` and `renormalise` as for any change. Because each
  frame starts from the snapshot, the preview is exactly what the release
  commits. The handle stays under the pointer by recomputing its index from
  the returned list (the moved segment's new index is returned alongside).
- Double-click on a segment handle that is fixed: one history transaction
  with `releaseSegment` (or, when it returns null, the key removed and a full
  route). On a free segment: nothing.
- Handles: one per segment of at least 5 screen px, hollow when free, filled
  when fixed (plan 06.14 Task 3).

### 8.6 Tests to write first

- Middle segment dragged by +30: only its two points move; it is fixed; the
  neighbours stretch; other fixed indices unchanged.
- First segment dragged, bound right: two points prepended, stub 40 (and
  `L/2` when `L < 45`), fixed indices +2; free start: one point, +1.
- Last segment dragged, free end whose segment axis disagrees with the
  heading: the end point survives.
- Shape moved with a fixed segment: interior points identical; only legs
  change; perpendicular move of the shape onto the kept segment's axis
  inserts the 40 stub pair; moving back removes it; indices follow.
- `adaptEnds` twice with the same ends gives the same result.
- Release the middle of three fixed segments: points outside `prev`..`next`
  untouched, indices after it reindexed; release the only one: key removed,
  full route.
- Renormalise: collinear merge keeps fixed status; a sub-unit segment
  collapses the jog; a fixed index reaching 1 or last is dropped.
- `settledAround` shift: `fixedSegments` start/end equal the settled points.
- File round trip of `fixedSegments`; invalid entries dropped on load.
