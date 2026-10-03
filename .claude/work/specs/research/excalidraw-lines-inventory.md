# Lines and arrows: Excalidraw against Bava, a complete inventory

The checklist decision 11 of `06.12-arrows-and-code.md` asks for: every
behaviour of Excalidraw's lines and arrows (sharp, round, elbow; lines,
including closed ones), and whether Bava already does it. Read 2026-09-26
from Excalidraw (MIT) at commit `5db42c3` and from Bava's working tree after
commit `bbe5aa9` (06.13). Decisions already recorded in `arrows.md` and
`06.12-arrows-and-code.md` are taken as given; a row that restates one says so.

Out of scope, as asked: touch and pen, collaboration, roughness and
sloppiness, grid mode. Behaviour behind Excalidraw's `COMPLEX_BINDINGS`
feature flag, which is off by default (`common/src/utils.ts:1185-1190`), is
marked "not applicable".

**Paths.** Excalidraw paths are relative to its `packages/`; `App.tsx` is
`excalidraw/components/App.tsx`. Bava paths are relative to `frontend/src/`
(so `canvas/pointer.ts`), except `docs/` and `.claude/`. "Screen px" means a
length divided by the zoom. "Unverified" means the source was not read far
enough, or the code lives in a dependency not in the tree (roughjs).

**Status.** same; partly (Bava does some of it, or does it differently);
missing; better in Bava; not applicable. The Notes column says when the item
would change the file format (`docs/file-format.md`).

## 1. Creation

| # | Behaviour | Excalidraw (value, file:line) | Bava today (file:line) | Status | Notes |
|---|---|---|---|---|---|
| C1 | Drag draws a two-point line or arrow | element created at the press with two points, grown by the drag, finalised on release (`App.tsx:10269-10357`, `App.tsx:11781-11820`) | `canvas/pointer.ts:1064-1096` | same | |
| C2 | Minimum length | a release under `MINIMUM_ARROW_SIZE` 20 screen px turns the press into click-by-click drawing (`common/src/constants.ts:26`, `App.tsx:11743-11780`); the element is drawn from the first move | 20 screen px (`styles/tokens/_space.scss:54`, `canvas/pointer.ts:754-757`); the preview draws nothing until 20 px (`canvas/pointer.ts:1072`) | built 06.15 | Only the preview under 20 px differs |
| C3 | Click-by-click drawing | each click commits a point; a click within `LINE_CONFIRM_THRESHOLD` 8 screen px of the last point finishes (`common/src/constants.ts:27`, `App.tsx:10231-10255`) | `canvas/pointer.ts:676-683`, `canvas/pointer.ts:1154-1174`, `styles/tokens/_space.scss:57` | same | 06.13 decision 9 |
| C4 | Next segment follows the pointer between clicks | `App.tsx:8015-8060` | `App.svelte:948-953`, `canvas/pointer.ts:503-509` | same | |
| C5 | Pointer back inside the 8 px zone of the last point hides the floating segment | the uncommitted point is removed (`App.tsx:8066-8101`) | segment always drawn to the pointer (`canvas/pointer.ts:503-509`) | built 06.15 | |
| C6 | Shift snaps each click-drawn segment to 15° | `LinearElementEditor.handlePointerMove` uses `_getShiftLockedDelta` (`element/src/linearElementEditor.ts:337-352`) | raw pointer used (`canvas/pointer.ts:503-509`, `canvas/pointer.ts:681`) | built 06.15 | |
| C7 | Arrow drawn by clicks finishes when a click lands on a shape | a click whose end binds in orbit to another element finalises and binds at once (`App.tsx:10221-10255`) | the click only adds a point (`canvas/pointer.ts:678-683`) | built 06.15 | |
| C8 | Line drawn by clicks closes into a loop | a click back on the first point (within 8 screen px, `element/src/utils.ts:512-526`) finishes the line, snaps the last point onto the first and marks it a polygon (`App.tsx:10158-10178`, `excalidraw/actions/actionFinalize.tsx:310-334`) | none | built 06.15 | Changes the file format (a closed flag, see P18) |
| C9 | Elbow drawn by clicks | only two points: the second click finishes (`App.tsx:10180-10191`) | the arrow tool always draws a straight arrow, so an elbow cannot be drawn directly (`canvas/pointer.ts:1088-1096`) | built 06.15 | Depends on C13 |
| C10 | Finishing keys and button | Esc or Enter finishes; a Done button shows while drawing (`excalidraw/actions/actionFinalize.tsx:423-438`) | Enter and Esc (`canvas/pointer.ts:511-538`); no button | built 06.15 | |
| C11 | Changing tool mid-line finishes it | unverified | `App.svelte:387-399` | same | Excalidraw side unverified |
| C12 | Shift angle snap while dragging | 15° (`SHIFT_LOCKING_ANGLE`, `common/src/constants.ts:31`), and also snaps to the segment's own starting angle within 2.5° (`element/src/sizeHelpers.ts:187-217`) | 15° (`canvas/pointer.ts:1070`, `canvas/constrain.ts:12`) | built 06.15 | The extra "own angle" snap is missing |
| C13 | A new element takes the last-used style | `currentItem*` state: arrow type, heads, stroke, roundness, opacity (`excalidraw/appState.ts:33-45`, `App.tsx:10285-10337`); every property change updates it (`excalidraw/actions/actionProperties.tsx:1774`, `:1976-1978`, `:2229`) | always the file-format defaults (`canvas/pointer.ts:1088-1096`, `canvas/style.ts:212-222`) | built 06.15 | No file change; per-viewer state |
| C14 | Defaults | arrow type round, line roundness round (`excalidraw/appState.ts:44-45`); start head none, end head arrow (`excalidraw/appState.ts:33,40`) | straight, sharp, none, arrow (`canvas/style.ts:212-222`) | built 06.15 | Heads match; kinds differ |
| C15 | What is selected after drawing | back to Select, the new element selected with its point handles (`App.tsx:11791-11812`, `excalidraw/actions/actionFinalize.tsx:344-408`) | `canvas/pointer.ts:765-772`, `canvas/pointer.ts:1171-1173` | same | |
| C16 | Tool lock | `Q` or the lock button keeps the tool, and nothing is selected after a draw (`App.tsx:5776-5779`, `App.tsx:10414-10416`, `App.tsx:11791-11817`) | none | built 06.15 | |
| C17 | Binding while drawing, highlight while dragging | start bound at the press, end at the release (`App.tsx:10343-10383`, `excalidraw/actions/actionFinalize.tsx:88-137`) | `canvas/pointer.ts:1085`, `canvas/pointer.ts:1348-1359`, `canvas/pointer.ts:300-322` | same | |
| C18 | Highlight of the shape under the pointer before pressing, with the arrow tool | `App.tsx:7975-8011` | only once a press or click-drawing is under way (`canvas/pointer.ts:300-322`) | built 06.15 | |
| C19 | Modifiers at the press | Alt at the press pins the start inside (`App.tsx:10404`); Ctrl/Cmd at the press turns binding off (`App.tsx:10142-10148`) | Alt and Cmd/Ctrl are read at the release for both ends (`canvas/pointer.ts:1085`, `canvas/pointer.ts:1342-1345`) | built 06.15 | |
| C20 | A slip makes nothing | invisibly small elements are deleted on finish (`excalidraw/actions/actionFinalize.tsx:155-178`, `:300-308`) | `canvas/pointer.ts:1072`, `canvas/pointer.ts:1158-1162` | same | |

## 2. Selection chrome, handles and cursors

| # | Behaviour | Excalidraw (value, file:line) | Bava today (file:line) | Status | Notes |
|---|---|---|---|---|---|
| S1 | Two-point line or arrow | no box; a handle on each point and one on the middle (`element/src/transformHandles.ts:328-354`, `excalidraw/renderer/interactiveScene.ts:1197-1208`) | `canvas/selection-chrome.ts:44-49`, `canvas/stage.ts:438-486` | same | 06.12 decision 3 |
| S2 | Bent line or arrow | box with corner handles and the rotate handle (`element/src/transformHandles.ts:57-62`, `:343-353`), padded 10 px beyond the points (`element/src/transformHandles.ts:312-316`) | corners and rotate (`canvas/selection-chrome.ts:48-49`), box drawn tight on the bounds (`canvas/stage.ts:410-431`) | built 06.14 | Only the padding differs |
| S3 | Elbow arrow | no box, no rotate; handles on the two ends, and a handle at the middle of every segment (hollow when free, solid when fixed), hidden when the segment is under 5 screen px (`element/src/transformHandles.ts:284-288`, `excalidraw/renderer/interactiveScene.ts:1116-1118`, `:1158-1185`, `element/src/linearElementEditor.ts:943-950`) | ends only (`canvas/stage.ts:452`, `canvas/arrows.ts:216`) | built 06.14 | Segment handles: E7 |
| S4 | Handle sizes | point radius 5, 10 in point editing; hit within 11 screen px (`element/src/linearElementEditor.ts:231`, `:1433-1458`, `excalidraw/renderer/interactiveScene.ts:1107-1110`) | `styles/tokens/_space.scss:47-50`, `canvas/stage.ts:444-447` | same | |
| S5 | Middle handle hidden on a short segment | under 4 × 10 = 40 screen px, measured along the curve on a round one (`element/src/linearElementEditor.ts:935-974`) | `styles/tokens/_space.scss:44`, `canvas/pointer.ts:1316-1325` | same | |
| S6 | Point looks | selected points filled; a point lying on its neighbour drawn 1.5 to 2 times larger (`excalidraw/renderer/interactiveScene.ts:268-289`, `:1120-1127`) | selected filled (`canvas/stage.ts:457`); no enlargement | built 06.14 | |
| S7 | Hover highlight of a point or middle | a translucent 10 px disc under the hovered handle (`excalidraw/renderer/interactiveScene.ts:163-216`, `:1756-1769`) | none | built 06.14 | |
| S8 | Middle handle under the label | the middle keeps precedence, so a labelled arrow can still be bent at its middle (`element/src/linearElementEditor.ts:1154-1168`, `App.tsx:8473-8485`) | the middle is hidden and the label wins (`canvas/stage.ts:470-476`, `canvas/pointer.ts:362-365`) | built 06.14 | Opposite precedence |
| S9 | Focus point indicator and drag | a selected two-point bound arrow (not elbow) shows each end's anchor as a small disc with a dashed line to the end, radius `10/1.5/1.5` (`element/src/binding.ts:119`, `excalidraw/renderer/interactiveScene.ts:1215-1360`, `:1771-1787`, `element/src/arrows/focus.ts:37-100`); dragging it moves the anchor, or onto another shape, without moving the end; Alt makes it inside (`element/src/arrows/focus.ts:211-340`, `App.tsx:10774-10784`) | none | built 06.14 | No file change: the anchor is already stored |
| S10 | Cursors | pointer over a point, middle or focus handle; grab over an arrow label, grabbing while dragging it; move over the element (withheld over a bound elbow); crosshair-style tool cursor (`App.tsx:8430-8555`, `App.tsx:8322-8366`, `excalidraw/components/App.arrowText.ts:296`) | no canvas cursor is ever set: nothing in `frontend/src` assigns one to the canvas | built 06.14 | Also resize cursors on box handles |
| S11 | Cursor while drawing by clicks | pointer in the confirm zone and over the loop-closing point (`App.tsx:8062`, `:8074`, `:8103-8105`) | none | built 06.14 | |
| S12 | Hit area of a line | max(strokeWidth/2 + 0.1, 0.85 × 8 = 6.8 screen px) (`App.tsx:6808-6816`, `common/src/constants.ts:274-281`) | 4 screen px (`styles/tokens/_space.scss:39`, `App.svelte:130-133`) | built 06.14 | |
| S13 | A selected bent line is grabbed anywhere in its box | `App.tsx:6824-6842` | by its path only (`canvas/pointer.ts:230-240`; the box counts for a multi-selection only, `canvas/pointer.ts:437-438`) | built 06.14 | |
| S14 | Locked line shows no point handles | `excalidraw/renderer/interactiveScene.ts:1805-1809` | a locked element cannot be selected (`canvas/pointer.ts:1274`) | same | |

## 3. Point editing mode

| # | Behaviour | Excalidraw (value, file:line) | Bava today (file:line) | Status | Notes |
|---|---|---|---|---|---|
| P1 | Enter by double-click | a line, or Cmd/Ctrl + double-click an arrow (`App.tsx:7254-7267`) | `canvas/pointer.ts:560-569`, `App.svelte:1018-1023` | same | 06.13 decision 8 |
| P2 | Enter by keyboard | Enter on a line, Cmd/Ctrl+Enter on an arrow (`App.tsx:5877-5893`) | Enter on a line (`canvas/pointer.ts:530-538`); the canvas ignores Cmd/Ctrl keys (`canvas/keymap.ts:35`) | built 06.15 | Cmd/Ctrl+Enter on an arrow missing |
| P3 | Enter by a button | "Edit line" / "Edit arrow" in the properties panel (`excalidraw/actions/actionLinearEditor.tsx:27-104`) | none | built 06.15 | |
| P4 | Not for an elbow | `excalidraw/actions/actionLinearEditor.tsx:45-50`, `App.tsx:5889` | `canvas/pointer.ts:581` | same | |
| P5 | Leave | Esc (`excalidraw/actions/actionFinalize.tsx:423-424`); a press elsewhere, unverified | Esc, or a press off the line (`canvas/pointer.ts:516-527`, `canvas/pointer.ts:1266-1267`) | same | Press-off unverified on Excalidraw's side |
| P6 | What the mode shows | no box; every point at 10 px radius; every middle (`element/src/transformHandles.ts:334-338`, `excalidraw/renderer/interactiveScene.ts:1108-1110`, `:1198`) | `canvas/selection-chrome.ts:40`, `canvas/stage.ts:445-469` | same | |
| P7 | Selecting points | click selects; Shift-click adds; Shift-click on a selected point removes it only if released without a drag (`element/src/linearElementEditor.ts:1204-1213`, `:784-799`) | Shift-click toggles at the press (`canvas/pointer.ts:1242-1247`), so a Shift-drag from a selected point drops it from the drag | built 06.15 | |
| P8 | Box-select points | a marquee in the mode selects the points inside; Shift adds (`element/src/linearElementEditor.ts:248-309`) | a press off the line ends the mode (`canvas/pointer.ts:1261-1267`) | built 06.15 | |
| P9 | Drag the selected points together, grab offset kept | `element/src/linearElementEditor.ts:471-604` | `canvas/pointer.ts:820-837` | same | |
| P10 | Shift while dragging one point | snaps it to 15° about its neighbour (`element/src/linearElementEditor.ts:542-556`) | outside the mode yes (`canvas/pointer.ts:873`); inside the mode no (`canvas/pointer.ts:820-837`) | built 06.15 | |
| P11 | Delete with no point selected | does nothing: deleting the whole line is "most likely a mistake" (`excalidraw/actions/actionDeleteSelected.tsx:225-231`) | deletes the line (`canvas/pointer.ts:544-553`, `App.svelte:1097-1105`) | built 06.15 | Documented in `docs/shortcuts.md:111` |
| P12 | Selection after deleting points | the point before the first deleted one (`excalidraw/actions/actionDeleteSelected.tsx:263-268`) | none (`canvas/pointer.ts:605`) | built 06.15 | |
| P13 | Deleting down to few points | all points selected deletes the element (`excalidraw/actions/actionDeleteSelected.tsx:233-251`) | refuses to leave fewer than two (`canvas/pointer.ts:599`) | built 06.15 | |
| P14 | Alt adds a point | while Alt is held a segment from the last point to the pointer is previewed (Shift snaps it); Alt+click commits it after the last point, selected, and the same press drags it (`element/src/linearElementEditor.ts:1099-1140`, `:1258-1335`) | Alt+click adds on release, after the last point or before an attached end; no preview, no drag (`canvas/pointer.ts:1197-1212`, `:1257-1260`, `:671-674`) | built 06.15 | |
| P15 | Dragging a middle adds a point | at once in the mode; outside it after 10 screen px (`element/src/linearElementEditor.ts:1736-1830`) | always after 10 screen px (`canvas/pointer.ts:865`) | built 06.15 | |
| P16 | Duplicate points | Cmd/Ctrl+D inserts a point halfway to the next for each selected one (the last is copied 30, 30 away) (`excalidraw/actions/actionDuplicateSelection.tsx:44-61`, `element/src/linearElementEditor.ts:1500-1574`) | none | built 06.15 | |
| P17 | Select All in the mode | does nothing (`excalidraw/actions/actionSelectAll.ts:28-30`) | ends the mode and selects everything (`canvas/pointer.ts:1181-1187`) | built 06.15 | |
| P18 | Merge the ends: close a line | dragging an end onto the other (within 8 screen px) snaps them together and makes a line a polygon (`element/src/linearElementEditor.ts:738-775`, `element/src/utils.ts:512-526`) | none | built 06.15 | Changes the file format: a closed flag, Excalidraw's `polygon` (`element/src/types.ts:379-383`) |
| P19 | Close or open a line by command | "Convert to polygon" / "Break polygon": adds a closing point (or reuses a last point within 20, `LINE_POLYGON_POINT_MERGE_DISTANCE`), opening clears the fill (`excalidraw/actions/actionLinearEditor.tsx:106-212`, `element/src/shape.ts:1138-1180`, `common/src/constants.ts:608`) | none | built 06.15 | File format, as P18 |
| P20 | A closed line stays closed | dragging or deleting the first or last point moves the other with it (`element/src/linearElementEditor.ts:1590-1603`, `:1627-1632`, `:1665-1684`) | none | built 06.15 | |
| P21 | Fill of a closed line | a line takes a background colour, drawn only while its path is a loop (`element/src/shape.ts:243-253`, `element/src/comparisons.ts:3-14`); a filled loop is grabbed from inside (`element/src/collision.ts:85-98`) | a line takes `stroke` only (`canvas/style.ts:13-20`, `docs/file-format.md:223`) | built 06.15 | File format: `fill` on `line` |
| P22 | Keyboard nudge of points | none: arrow keys move the whole selection (`App.tsx:5805-5876`) | the whole element moves (`App.svelte:1106-1119`) | same | |
| P23 | Undo granularity | one step per drag, add or delete (`excalidraw/actions/actionDeleteSelected.tsx:271`, `element/src/linearElementEditor.ts:1115`) | `canvas/pointer.ts:601-606`, `canvas/pointer.ts:759` | same | |
| P24 | Double-click a point deletes it | not in Excalidraw: a double-click on a line in the mode does nothing (`App.tsx:7330-7337`) | removes the bend (`App.svelte:1012-1017`, `canvas/pointer.ts:615-630`) | built 06.15 | Bava-only (06.10 decision 2); keep unless told otherwise |
| P25 | Dragging the line itself in the mode | moves the whole line, unverified (`App.tsx:10925-10940`) | clears the point selection and moves nothing (`canvas/pointer.ts:1261-1265`) | built 06.15 | Excalidraw side unverified |
| P26 | Moving a bend re-aims attached ends | `element/src/linearElementEditor.ts:2470-2525` | `canvas/binding.ts:457-473` | same | |

## 4. Elbow arrows

| # | Behaviour | Excalidraw (value, file:line) | Bava today (file:line) | Status | Notes |
|---|---|---|---|---|---|
| E1 | Routing | A* over a grid built from the padded boxes; each bend costs more than any length (`element/src/elbowArrow.ts:1437-1644`, `:1851-1906`) | `canvas/elbow.ts:76-240` | same | `excalidraw-elbow-routing.md` |
| E2 | Padding round the shapes | `BASE_PADDING` 40 on far sides, less on the heading side (40 - 30 with a head, - 10 without), so a head gets extra room (`element/src/elbowArrow.ts:111`, `:1308-1333`, `:1666-1842`) | 20 on every side, shared between close shapes (`canvas/elbow.ts:30`, `:81-99`, `styles/tokens/_space.scss:37`) | built 06.14 | Built 06.14: Excalidraw pads the heading side less but grows the shape there first, so the net is 40 on every side |
| E3 | Headings | a bound end leaves by the side it is on (triangles of the box scaled 2x); a free end faces the other end (`element/src/heading.ts:231-281`, `element/src/binding.ts:1550-1579`) | `canvas/elbow.ts:42-60`, `canvas/binding.ts:245-257` | same | |
| E4 | Corners drawn rounded | each corner a quadratic curve of radius min(16, half of either neighbouring segment) (`element/src/shape.ts:915-920`, `:1018-1081`) | sharp corners (`canvas/arrows.ts:33-34`, `canvas/stage.ts:776-782`, `canvas/export/svg.ts:124-134`) | built 06.14 | No file change |
| E5 | Snap to a side's middle | a band 5% of the side (clamped 5 to reach) along each axis, from inside or outside; a diamond also snaps to its edges' middles; all four middles shown as dots while an elbow end is dragged (`element/src/utils.ts:640-715`, `:769-786`, `excalidraw/renderer/interactiveScene.ts:503-529`) | the straight-arrow rule: outside only, within reach of a middle (`canvas/binding.ts:338-353`); no dots | built 06.14 | |
| E6 | End kept off a box corner | a point near a rectangle's corner is moved just past it (`element/src/binding.ts:1614-1622`, `:1741-1830`) | no explicit rule; effect unverified | built 06.14 | Built 06.14: holds by construction (a corner anchor leaves by one side, a gap out); kept as a guard test |
| E7 | Segment handles | see S3 (`excalidraw/renderer/interactiveScene.ts:1158-1185`) | none | built 06.14 | |
| E8 | Drag a middle segment | moves it perpendicular to itself, at once (no threshold), and fixes it: `fixedSegments` of `{start, end, index}` (`App.tsx:10662-10711`, `element/src/linearElementEditor.ts:2269-2352`, `element/src/types.ts:385-401`) | none | built 06.14 | Changes the file format (fixed segments) |
| E9 | Drag the first or last segment | inserts a stub 40 (or half the segment when short) out from the shape (`element/src/elbowArrow.ts:504-558`, `:639-700`) | none | built 06.14 | |
| E10 | Release a fixed segment | double-click its handle (`App.tsx:7268-7329`, `element/src/linearElementEditor.ts:2354-2364`, `element/src/elbowArrow.ts:282-460`) | none | built 06.14 | |
| E11 | Fixed segments survive moves | a shape move or an end drag keeps the segment count; only the end legs adapt (`element/src/elbowArrow.ts:1142-1166`, `:706-900`) | none | built 06.14 | |
| E12 | Tidy route | points within 1 and straight-through corners dropped (`element/src/elbowArrow.ts:1101-1119`) | `canvas/elbow.ts:240-241` | same | |
| E13 | Limits | no point editing, orbit binding only, no rotation (`excalidraw/actions/actionLinearEditor.tsx:45-50`, `element/src/binding.ts:1156-1170`, `element/src/transformHandles.ts:284-288`) | `canvas/pointer.ts:581`, `canvas/pointer.ts:1342-1345`, `canvas/rotate.ts:71-73` | same | |
| E14 | Switching to elbow | two points, angle cleared, fixed segments cleared, each binding recomputed with the elbow midpoint snap (`excalidraw/actions/actionProperties.tsx:2077-2189`) | bends replaced by the route, inside modes cleared, anchors kept as they were (`canvas/style.ts:171-178`); a free arrow's angle is not cleared (unverified effect) | built 06.14 | 06.12 decision 5 |
| E15 | Switching away from elbow | only the ends kept; each end re-bound at its current spot (`excalidraw/actions/actionProperties.tsx:2088-2112`, `:2190-2221`) | only the ends kept, anchors kept (`canvas/style.ts:175-178`) | built 06.14 | |
| E16 | Dragging a bound elbow by its body | not possible, and no move cursor; in a multi-selection it moves only if both its shapes move (`element/src/dragElements.ts:46-67`, `App.tsx:8350-8355`) | it moves and lets go of its shapes (`canvas/pointer.ts:1044-1058`) | built 06.14 | Behaviour differs |

## 5. Binding

| # | Behaviour | Excalidraw (value, file:line) | Bava today (file:line) | Status | Notes |
|---|---|---|---|---|---|
| B1 | What an end stores | element id, a 0 to 1 point on its upright box, mode `inside` or `orbit` (`element/src/types.ts:316-333`) | `canvas/scene.ts:58-75`, `docs/file-format.md:197-202` | same | |
| B2 | What can be a target | rectangle, diamond, ellipse, image, embeds, frame, text not in a container; never arrows or lines (`element/src/typeChecks.ts:184-202`) | every shape, text and code; never arrow, line, stroke, group, frame (`canvas/binding.ts:447`) | built 06.16 | Frames: B3 |
| B3 | Frames | bindable from outside only; an end inside a frame binds to its children (`element/src/collision.ts:322-326`); a point clipped by an enclosing frame is not a target (`element/src/collision.ts:317-319`) | never a target (`canvas/binding.ts:298-301`) | built 06.16, in part | Frames are targets from outside and an end inside one goes to its child; "a point clipped by its frame" does not apply, as Bava frames do not clip |
| B4 | Reach | clamp(15 / (1.5 × min(zoom, 1)), 15, 30) (`element/src/binding.ts:133-143`) | `canvas/binding.ts:214-227` | same | |
| B5 | Picking a target | front to back; a filled shape or image containing the point hides what is behind it; the nearest outline wins, unless a smaller shape overlapping it (over 25% overlap, under 75% of its area) contains the point (`element/src/collision.ts:346-478`) | the smallest shape in reach, no occlusion (`canvas/binding.ts:303-321`) | built 06.16 | |
| B6 | Locked shapes | cannot be bound but still hide what is behind (`element/src/collision.ts:352-354`, `:403-405`) | skipped and hide nothing (`canvas/binding.ts:306`) | built 06.16 | |
| B7 | Modes and modifiers | inside when dropped strictly inside, orbit when within reach outside, Alt forces inside, Cmd/Ctrl held turns binding off (`element/src/binding.ts:830-893`, `App.tsx:5787-5803`, `App.tsx:6078-6089`) | `canvas/pointer.ts:913-935`, `canvas/pointer.ts:1342-1345` | same | 06.13 decision 7 |
| B8 | Binding preference | a setting turns binding off; Cmd/Ctrl then turns it on (`excalidraw/actions/actionToggleArrowBinding.tsx:6-25`, `App.tsx:5792-5796`) | none | built 06.16 | |
| B9 | `skip` mode, and inside after hovering 700 ms | `App.tsx:1191-1505`, `common/src/constants.ts:612`; behind `COMPLEX_BINDINGS`, off | none | not applicable | |
| B10 | Gap | 5 + the target's strokeWidth / 2 (`element/src/binding.ts:117`, `:125-131`) | 4 (`canvas/binding.ts:27`, `styles/tokens/_space.scss:35`) | built 06.16 | |
| B11 | Where an orbit anchor is stored | the drop point projected onto the shape's diagonals (centre lines for curved shapes) along the line from the neighbour (`element/src/utils.ts:810-903`); the end then sits where the anchor-to-neighbour line meets the outline, a gap out (`element/src/binding.ts:1948-2104`) | the drop point taken onto the outline (`canvas/binding.ts:338-365`); the end placed by the same ray rule (`canvas/binding.ts:56-83`, `:161-212`) | built 06.16 | Same at the drop; diverges once a shape moves |
| B12 | Side-middle snap (straight and round) | within reach + strokeWidth/2 of a middle, from outside only; the nearest middle shown as a dot, the snapped one in the highlight colour; a "midpoint snapping" setting; off while Shift is held (`element/src/utils.ts:717-741`, `:788-808`, `excalidraw/renderer/interactiveScene.ts:477-556`, `excalidraw/actions/actionToggleMidpointSnapping.tsx:6-22`, `element/src/binding.ts:180-183`) | within reach, from outside (`canvas/binding.ts:338-353`); no dots, no setting, still on with Shift | built 06.16 | |
| B13 | Highlight of the target | the shape's own outline (rectangle, ellipse, diamond path) in a highlight blue, width clamp(1.75, strokeWidth, 4) screen px, animated, plus middle dots (`excalidraw/renderer/interactiveScene.ts:123-131`, `:292-557`) | its rotated bounding box, 2 screen px, handle colour (`canvas/stage.ts:238-257`) | built 06.16 | |
| B14 | Highlight while dragging an existing end, and while drawing by clicks | `element/src/linearElementEditor.ts:606-611`, `App.tsx:8110-8121` | `canvas/pointer.ts:300-315` | same | |
| B15 | Shift while dragging an end | the target is found under the pointer, not the snapped end; the middle snap is off; the other end is re-projected (`element/src/binding.ts:733-749`, `:888-890`, `:940-954`) | found at the snapped end, snap still on (`canvas/pointer.ts:908-915`) | built 06.16 | |
| B16 | Both ends on one shape | allowed: both become inside at their drop points; its bends move with the shape (`element/src/binding.ts:777-828`, `:1415-1419`, `element/src/linearElementEditor.ts:1706-1713`) | the second end is refused (`canvas/pointer.ts:915`, `canvas/pointer.ts:1356-1357`) | built 06.16 | No file change |
| B17 | Following a shape | anchors are fractions of the upright box, turned with it (`element/src/binding.ts:1321-1428`, `:2646-2663`) | `canvas/binding.ts:89-94`, `:457-473` | same | |
| B18 | Guards against an inverted arrow | an end whose outline point lies inside the other, overlapping shape, or an arrow under `BASE_ARROW_MIN_LENGTH` 10, falls back to the anchor itself (`element/src/binding.ts:118`, `:2037-2094`) | only the "no direction" guard (`canvas/binding.ts:189-197`) | built 06.16 | |
| B19 | Dragging a bound arrow by its body | lets go of shapes not moving with it; a lone bound arrow first needs 10 scene px (`element/src/dragElements.ts:130-158`) | lets go (`canvas/pointer.ts:1041-1058`) after 3 screen px (`styles/tokens/_space.scss:41`) | built 06.16 | Threshold only; 06.10 decision 5 |
| B20 | Resizing or rotating a bound arrow | a lone one lets go of both ends; in a multi-transform, of shapes not included (`element/src/resizeElements.ts:241-252`, `:464-475`, `:930-945`) | stays bound; a rotation of an attached arrow is thrown away (`canvas/binding.ts:465-468`) | built 06.16 | |
| B21 | Arrow keys on a bound arrow | a bound arrow whose shape is not selected does not move (`App.tsx:5812-5835`) | it moves and its bound ends re-aim back (`App.svelte:1106-1119`, `canvas/binding.ts:457-473`) | built 06.16 | |
| B22 | Deleting a bound shape | the arrow lets go and stays (`excalidraw/actions/actionDeleteSelected.tsx:278-281`, `element/src/binding.ts:2297-2311`) | the id is kept, the end freezes and is marked detached (`canvas/binding.ts:37-42`, `canvas/stage.ts:855-882`, `docs/file-format.md:261-265`) | kept (06.16) | Kept as Bava: the `CLAUDE.md` rule that a binding whose target disappears freezes and is marked detached outranks decision 12 |
| B23 | Duplicate, copy/paste, Alt-drag | copies bind to the copied shapes; an end whose shape was not copied lets go (`element/src/binding.ts:2225-2295`, `element/src/duplicate.ts:441`) | Alt-drag lets go (`canvas/pointer.ts:1009-1028`); Duplicate and Paste keep the original shape's id (`canvas/edit.ts:72-88`, `canvas/references.ts:24-49`), so the copy re-aims onto the original's shapes and lands on top of the original | built 06.14 | A bug users will hit |
| B24 | Moving a group or frame with the arrow in it | stays bound when its shapes move too (`element/src/dragElements.ts:141-147`) | `canvas/pointer.ts:1053` | same | |
| B25 | Arrow raised above the shape it binds to | `element/src/zindex.ts:153-187`, called on every end drag (`element/src/linearElementEditor.ts:407-423`, `:613-631`) | a new arrow is drawn on top (`canvas/pointer.ts:1091`); re-binding never restacks | built 06.16 | |
| B26 | Focus point drag | see S9 | | (counted in S9) | |
| B27 | Binding to text | text not in a container (`element/src/typeChecks.ts:200`) | text and code (`canvas/binding.ts:447`) | same | |
| B28 | Binding to arrows or to arrow labels | never (`element/src/typeChecks.ts:184-202`) | never (`canvas/binding.ts:447`) | same | |
| B29 | Text attached to a free arrow end | with the text tool, a click by an unbound end makes a text anchored at the tip (`element/src/arrowEndpointText.ts:1-288`, `excalidraw/components/App.arrowText.ts`) | none | built 06.16 | File format: text as a target already works |
| B30 | Re-anchoring when a shape changes type | `element/src/binding.ts:1219-1317`, `excalidraw/components/ConvertElementTypePopup.tsx:483` | Bava has no shape conversion | not applicable | |

## 6. Arrowheads

| # | Behaviour | Excalidraw (value, file:line) | Bava today (file:line) | Status | Notes |
|---|---|---|---|---|---|
| H1 | Catalogue | arrow, bar, circle, circle outline, triangle, triangle outline, diamond, diamond outline, and six cardinality heads (one, many, one or many, exactly one, zero or one, zero or many), behind "more" in the picker; legacy names mapped (`element/src/types.ts:342-367`, `element/src/arrowheads.ts:3-21`, `excalidraw/components/IconPicker.tsx:68-88`) | the eight and none (`canvas/arrows.ts:86-121`, `canvas/property-options.ts:31-41`) | built 06.16 | New names change the file format (`docs/file-format.md:207-209`) |
| H2 | Sizes | arrow 25 at a 20° half-angle, bar 15 at 90°, diamond 12, crowfoot 15, cardinality marker 20, others 15 at 25° (`element/src/bounds.ts:710-744`) | 10 for every kind (`styles/tokens/_space.scss:29`, `canvas/stage.ts:895`, `canvas/arrows.ts:86-121`) | built 06.16 | |
| H3 | Short arrows | the head is capped at half the last segment, a quarter for diamonds (`element/src/bounds.ts:814-836`) | none | built 06.16 | |
| H4 | Stroke width | heads stroked at the line's width; only a circle's diameter grows (+ strokeWidth - 2) (`element/src/bounds.ts:842-845`) | stroked at the line's width (`canvas/stage.ts:919`); circle fixed | built 06.16 | |
| H5 | Outline heads | filled with the canvas background, hiding the line under them (`element/src/shape.ts:385-402`, `:418-422`, `:455-459`) | hollow: the line shows inside (`canvas/stage.ts:916-917`, `canvas/export/svg.ts:178-179`) | built 06.16 | |
| H6 | Dashed and dotted lines | heads solid on dashed; dotted heads on dotted, with a tighter gap (`element/src/shape.ts:326-343`, `:366`, `:426-427`) | always solid (`canvas/stage.ts:903-920`, `canvas/export/svg.ts:182-183`) | built 06.16 | |
| H7 | Start and end independent; defaults none and arrow | `excalidraw/actions/actionProperties.tsx:1944-2036`, `excalidraw/appState.ts:33,40` | `canvas/property-options.ts:115-116`, `canvas/style.ts:220-221` | same | |
| H8 | Swapping heads | flipping a selection made only of bound arrows swaps their heads (`excalidraw/actions/actionFlip.ts:116-129`) | a flip mirrors the points and the ends re-aim; heads unchanged (`canvas/edit.ts:170-187`) | built 06.16 | |
| H9 | Head follows the curve | tangent at the curve's end (`element/src/bounds.ts:761-811`) | last routed segment (`canvas/arrows.ts:70-79`, `canvas/stage.ts:894-902`) | same | |
| H10 | Lines have no heads | `element/src/comparisons.ts:68` | `canvas/style.ts:125-131` | same | |

## 7. Labels on arrows

| # | Behaviour | Excalidraw (value, file:line) | Bava today (file:line) | Status | Notes |
|---|---|---|---|---|---|
| L1 | Editing | double-click or Enter on an arrow opens its label (`App.tsx:5894-5914`, `App.tsx:7389-7420`) | `App.svelte:1024-1026`, `App.svelte:1135-1145` | same | |
| L2 | Default place | the middle point (odd count) or the middle segment's middle (`element/src/linearElementEditor.ts:1942-1961`) | half the path's length (`canvas/arrows.ts:154-180`) | built 06.16 | Same on a two-point arrow; Bava's rule was judged better in `excalidraw-comparison.md` section 3 |
| L3 | Sliding it along the path | stored as a 0 to 1 `labelPosition`, grab offset kept (`element/src/linearElementEditor.ts:1963-2035`, `:2107-2120`) | `canvas/pointer.ts:839-858`, `canvas/arrows.ts:186-206` | same | 06.10 decision 6 |
| L4 | Label drag threshold and cursor | 10 screen px; grab, then grabbing (`excalidraw/components/App.arrowText.ts:296-305`) | 3 screen px (`canvas/pointer.ts:841`); no cursor | built 06.16 | |
| L5 | Hitting the label | the label is grabbable where it extends beyond the arrow, and a click on it selects the arrow (`excalidraw/components/App.arrowText.ts:255-280`, `App.tsx:6844-6852`) | only once the arrow is selected (`canvas/pointer.ts:1328-1335`); selection is by the path alone (`canvas/pointer.ts:230-240`) | built 06.16 | |
| L6 | Wrap width | max(0.7 × the arrow's width, fontSize × 11) (`element/src/textElement.ts:511-521`, `common/src/constants.ts:419-420`) | the path's length (`canvas/stage.ts:819`, `canvas/export/svg.ts:156`) | built 06.16 | |
| L7 | Line hidden behind the label | the arrow is clipped out of the label box plus 5 (`element/src/renderElement.ts:787-817`, `common/src/constants.ts:418`) | the line runs through the text, on canvas and in export (`canvas/stage.ts:811-828`, `canvas/export/svg.ts:151-167`) | built 06.16 | |
| L8 | Label font size | the label is a text element with its own size; a Shift-resize scales it (`element/src/resizeElements.ts:904-915`) | arrows take no `fontSize` (`canvas/style.ts:129-131`, `docs/file-format.md:189`) | built 06.16 | File format: `fontSize` on `arrow` |
| L9 | Label colour | follows the arrow's stroke colour, unverified | the theme's text colour always (`canvas/paint.ts:106`, `canvas/style.ts:17-20`) | built 06.16 | Checked in 06.16: a label takes the stroke colour (`App.tsx:7080-7095`, `:3110-3125`) |
| L10 | Labels on lines | none: text containers exclude lines (`element/src/types.ts:305-310`) | none (`canvas/stage.ts:795`) | same | |

## 8. Curves

| # | Behaviour | Excalidraw (value, file:line) | Bava today (file:line) | Status | Notes |
|---|---|---|---|---|---|
| V1 | Kinds | sharp, round, elbow (`common/src/constants.ts:585-589`) | straight, arc, elbow (`canvas/property-options.ts:106-114`) | same | |
| V2 | Round with two points | a curve through two points is straight (`element/src/shape.ts:934-935`; roughjs behaviour unverified) | an arc bows 0.2 of its length, always to the left (`canvas/arrows.ts:12-16`, `:45-63`) | built 06.15 | |
| V3 | Round through bends | a smooth curve through every point, roughjs `curve` (`element/src/shape.ts:934-935`; its tension unverified) | Catmull-Rom at tension 0.4 through every point (`canvas/curves.ts:22-56`, `canvas/paint.ts:24`, `canvas/arrows.ts:32`) | same | Tension unverified |
| V4 | Middles and label on the curve | measured along the curve (`element/src/linearElementEditor.ts:954-1015`, `:2037-2066`) | `canvas/arrows.ts:214-231` | same | |
| V5 | Round toggle on lines | sharp or round (`excalidraw/actions/actionProperties.tsx:1748-1778`) | `edges` on `line` (`canvas/style.ts:112`, `canvas/paint.ts:127-129`) | same | |

## 9. Styling specific to lines and arrows

| # | Behaviour | Excalidraw (value, file:line) | Bava today (file:line) | Status | Notes |
|---|---|---|---|---|---|
| T1 | Stroke widths | 1, 2, 4 (`common/src/constants.ts:477-484`) | `canvas/property-options.ts:51-58` | same | |
| T2 | Dash patterns | dashed [8, 8 + width], dotted [1.5, 6 + width], and a non-solid line drawn 0.5 thicker (`element/src/shape.ts:168-170`, `:200-216`) | dashed [6, 6], dotted [2, 4], whatever the width (`canvas/paint.ts:69-79`, `styles/tokens/_space.scss:65-66`) | built 06.16 | |
| T3 | Opacity 0 to 100 | `excalidraw/actions/actionProperties.tsx:956` | `canvas/paint.ts:95` | same | |
| T4 | Fill on a line | see P21 | | (counted in P21) | |
| T5 | Roundness never on an elbow | `excalidraw/actions/actionProperties.tsx:1755-1757` | arrows take no `edges` (`canvas/style.ts:112`) | same | |

## 10. Transform

| # | Behaviour | Excalidraw (value, file:line) | Bava today (file:line) | Status | Notes |
|---|---|---|---|---|---|
| X1 | Resize a bent line by its box | points rescaled; Shift keeps the ratio (`element/src/resizeElements.ts:275`, `:839-868`) | `canvas/pointer.ts:938-960`, `canvas/resize.ts:95-112` | same | |
| X2 | A two-point line has no box | `element/src/transformHandles.ts:353` | `canvas/selection-chrome.ts:48` | same | |
| X3 | Rotate a bent line, Shift in 15° steps | `element/src/resizeElements.ts:225-233` | `canvas/pointer.ts:795-816` | same | |
| X4 | Rotate or resize a bound arrow | see B20 | | (counted in B20) | |
| X5 | Flip | mirrors lines; a selection of only bound arrows swaps heads instead; the selection is re-centred so repeated flips do not drift (`excalidraw/actions/actionFlip.ts:110-195`) | mirrors about the drawn bounds (`canvas/edit.ts:170-187`) | built 06.16 | Head swap: H8 |
| X6 | Scale several elements with lines among them | points rescaled, bindings kept (`element/src/resizeElements.ts:1216-1330`, detail unverified) | `canvas/pointer.ts:947-959`, then re-aim | same | |
| X7 | Dragging a whole arrow | see B19 | | (counted in B19) | |
| X8 | Alt-drag copies | `excalidraw/components/App.duplicate.ts:195` (unverified) | `canvas/pointer.ts:997-1032` | same | |
| X9 | Duplicate and paste of a bound arrow | see B23 | | (counted in B23) | |
| X10 | Copy and paste styles | stroke colour, fill, width, style, opacity, roundness and, arrow to arrow, both heads (`excalidraw/actions/actionStyles.ts:118-186`) | colours only (`canvas/style.ts:63-93`) | built 06.16 | |
| X11 | Changing a line into an arrow and back | the shape switch cycles line, sharp, curved and elbow arrow, keeping points where it can (`excalidraw/components/ConvertElementTypePopup.tsx:115-120`, `:529-601`) | the arrow kind only; no line to arrow (`canvas/style.ts:155-186`) | built 06.16 | |

## 11. Anything else a user would notice

| # | Behaviour | Excalidraw (value, file:line) | Bava today (file:line) | Status | Notes |
|---|---|---|---|---|---|
| O1 | Undo while drawing by clicks | a history capture is scheduled per committed point (`App.tsx:8033`); what one undo does mid-line is unverified | one step when the line is finished (`canvas/pointer.ts:1154-1174`) | built 06.16 | Unverified |
| O2 | Cross-cutting items listed above | cursors (S10), tool lock (C16), remembered style (C13), hover highlight before pressing (C18), label hole (L7), rounded elbow corners (E4) | | (counted above) | |

## Summary: every item that is partly or missing

**Creation (13: 6 partly, 7 missing)**
- C2 partly: nothing is drawn while a new line is shorter than 20 px.
- C5 partly: the floating segment stays when the pointer is back on the last point.
- C6 missing: Shift snap while drawing by clicks.
- C7 missing: a click on a shape finishes an arrow drawn by clicks.
- C8 missing: clicking the first point closes a line drawn by clicks (file format).
- C9 missing: drawing an elbow directly (two clicks finish it).
- C10 partly: no Done button while drawing by clicks.
- C12 partly: Shift snap lacks the segment's own-angle stop.
- C13 missing: new elements take the last-used style (arrow kind, heads, stroke).
- C14 partly: defaults differ (Excalidraw round arrows and round lines).
- C16 missing: tool lock.
- C18 missing: target highlight on hover with the arrow tool before pressing.
- C19 partly: Alt and Cmd/Ctrl read at the release, not at the press.

**Selection chrome, handles and cursors (10: 5 partly, 5 missing)**
- S2 partly: a bent line's box is not padded 10 px.
- S3 partly: an elbow shows no segment handles.
- S6 partly: overlapping points are not enlarged.
- S7 missing: hover highlight under a point or middle.
- S8 partly: the label, not the middle handle, wins where they overlap.
- S9 missing: focus point indicators and dragging them.
- S10 missing: canvas cursors of every kind.
- S11 missing: cursor feedback while drawing by clicks.
- S12 partly: line hit area 4 px, not 6.8.
- S13 missing: a selected bent line is not grabbed inside its box.

**Point editing (17: 10 partly, 7 missing)**
- P2 partly: Cmd/Ctrl+Enter does not edit an arrow's points.
- P3 missing: an "Edit line/arrow" button.
- P7 partly: Shift-click toggles at the press, so Shift-drag drops the point.
- P8 missing: marquee selection of points.
- P10 partly: no Shift snap when dragging a point in the mode.
- P11 partly: Delete with nothing selected deletes the line instead of nothing.
- P12 partly: no point selected after deleting points.
- P13 partly: deleting every point does not delete the element.
- P14 partly: Alt-add has no preview segment and cannot be dragged in the same press.
- P15 partly: dragging a middle in the mode waits 10 px.
- P16 missing: Cmd/Ctrl+D duplicates points.
- P17 partly: Select All ends the mode.
- P18 missing: dragging an end onto the other closes a line (file format).
- P19 missing: close/open polygon command (file format).
- P20 missing: a closed line keeps its ends together.
- P21 missing: fill of a closed line (file format).
- P25 partly: dragging the line in the mode does not move it (Excalidraw side unverified).

**Elbow arrows (12: 6 partly, 6 missing)**
- E2 partly: margin 20 on all sides, not 40 with less on the heading side.
- E4 missing: rounded corners, radius 16.
- E5 partly: elbow side-middle snap band, inside snapping, diamond edge middles, middle dots.
- E6 partly: corner avoidance (unverified).
- E7 missing: segment handles.
- E8 missing: dragging a middle segment fixes it (file format).
- E9 missing: dragging the first or last segment adds a stub.
- E10 missing: double-click releases a fixed segment.
- E11 missing: fixed segments survive shape moves and end drags.
- E14 partly: switching to elbow keeps old anchors and a free arrow's angle.
- E15 partly: switching away keeps old anchors instead of re-binding.
- E16 partly: a bound elbow can be dragged away by its body.

**Binding (18: 13 partly, 5 missing)**
- B2 partly: frames are not targets.
- B3 partly: frames bindable from outside, and ends inside a frame reach its children.
- B5 partly: target choice ignores occlusion by filled shapes and uses "smallest" not "nearest".
- B6 partly: locked shapes do not hide what is behind.
- B8 missing: a setting to turn binding off.
- B10 partly: gap ignores the target's stroke width.
- B11 partly: orbit anchors are stored on the outline, not on the diagonals.
- B12 partly: side-middle snap lacks dots, the setting, the stroke-width reach, and Shift off.
- B13 partly: highlight is a box, not the shape's outline.
- B15 partly: Shift does not take the target under the pointer or turn the snap off.
- B16 missing: both ends on one shape.
- B18 missing: guards against inverted arrows on overlapping shapes and very short arrows.
- B19 partly: body-drag threshold 3 px, not 10.
- B20 partly: resizing or rotating a bound arrow does not let go (rotation is lost).
- B21 partly: arrow keys move a bound arrow whose shape is not selected.
- B23 partly: Duplicate and Paste of a bound arrow keep the original shapes (bug).
- B25 missing: arrow raised above the shape it binds to.
- B29 missing: text attached to a free arrow end.

**Arrowheads (7: 4 partly, 3 missing)**
- H1 partly: no cardinality heads (file format).
- H2 partly: one 10-unit size for every kind.
- H3 missing: heads shrink on short arrows.
- H4 partly: a circle head does not grow with stroke width.
- H5 missing: outline heads hide the line under them.
- H6 partly: dotted lines do not get dotted heads.
- H8 missing: swapping heads by flipping bound arrows.

**Labels on arrows (7: 5 partly, 2 missing)**
- L2 partly: default place is half the length, not the middle point or segment.
- L4 partly: label drag threshold 3 px and no grab cursor.
- L5 partly: the label is not hittable unless the arrow is selected.
- L6 partly: wrap width is the path length, not max(0.7 × width, 11 × fontSize).
- L7 missing: the line is not hidden behind the label (canvas and export).
- L8 missing: label font size on arrows (file format).
- L9 partly: label colour does not follow the arrow (Excalidraw side unverified).

**Curves (1: 1 partly)**
- V2 partly: a two-point arc bows; Excalidraw's round arrow is straight until bent.

**Styling (1: 1 partly)**
- T2 partly: dash and dot lengths do not grow with stroke width.

**Transform (3: 3 partly)**
- X5 partly: flip does not swap heads on bound arrows or re-centre the selection.
- X10 partly: Copy/Paste Styles copies colours only.
- X11 partly: no line to arrow conversion.

**Anything else (1: 1 partly)**
- O1 partly: undo steps while drawing by clicks (unverified).
