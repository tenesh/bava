# Excalidraw's object snapping, and a design for Bava

Read-only study of Excalidraw (MIT) at commit `5db42c3`, the clone in the
scratchpad. Paths are relative to `packages/`. `SN` is
`excalidraw/snapping.ts`, `APP` is `excalidraw/components/App.tsx`, `RS` is
`excalidraw/renderer/renderSnaps.ts`, `DE` is `element/src/dragElements.ts`,
`TOG` is `excalidraw/actions/actionToggleObjectsSnapMode.tsx`. Behaviour
only; no code is copied.

Units: "screen px" is CSS pixels on the canvas; "scene units" is the file's
space. Excalidraw turns every screen length into scene units by dividing by
the zoom.

## 1. When snapping is on

- **Setting.** `objectsSnapModeEnabled`, off by default (`excalidraw/appState.ts:130`).
  It persists to the browser, not to exported files (`appState.ts:282`). A host
  can force it with a prop, which hides the toggle (`TOG:29-31`, `APP:873`, `APP:906`).
- **Toggle.** Alt+S (`TOG:32-33`, `excalidraw/actions/shortcuts.ts:96`); a
  "Snap to objects" checkbox under the main menu's Preferences
  (`excalidraw/components/main-menu/DefaultItems.tsx:514-528`,
  `excalidraw/locales/en.json:260`); listed in the help dialog
  (`excalidraw/components/HelpDialog.tsx:298-301`).
- **Grid is exclusive.** Turning snapping on turns grid mode off (`TOG:23`);
  turning grid on (Cmd/Ctrl+') turns snapping off
  (`excalidraw/actions/actionToggleGridMode.tsx:24`, `:33`).
- **Cmd/Ctrl inverts it, per event.** The modifier is Meta on macOS and Ctrl
  elsewhere (`common/src/keys.ts:39`). Snapping applies when the setting is on
  and the key is up, or when the setting is off, the key is down and grid mode
  is off (`SN:178-183`). It is read on every pointer move, so pressing it
  mid-drag switches at once. The same key also drops the grid for that move
  (`APP:11150`, `APP:13406`, `APP:13616`).
- **A press with Cmd/Ctrl never drags** a selection at all (`APP:10994-10998`), so
  the inversion only matters once a drag is under way.
- **Lasso** snaps only once the lassoed selection is being dragged (`SN:171-179`).
- **A lone selected arrow** is excluded only when no event is passed
  (`SN:187-190`); every drag call passes one, so this branch does not decide
  drags.

## 2. What snaps

### Reference elements (the things you snap to)

- Visible and not selected (`SN:315-326`, `element/src/selection.ts:101-121`).
  Visible means the element's bounds intersect the viewport rectangle, no
  margin (`element/src/sizeHelpers.ts:80-115`).
- Grouped by outermost group: a group is one unit (`element/src/groups.ts:332-352`,
  `SN:628-633`). A unit of several elements snaps as its common upright box:
  four corners and centre (`SN:293-310`).
- A container's bound text joins its container's unit (`groups.ts:345-348`);
  a bound text alone is dropped (`SN:629-632`, `SN:343-344`).
- Frames are ordinary references; elements inside frames are too (no filter
  anywhere in `SN:315-326`). A dragged frame's children are not selected, so
  they stay references at their pre-drag positions (cached at the first move,
  section 6): a quirk, not a feature.
- Lines and arrows count, by the corners of their box
  (`getElementAbsoluteCoords` in `SN:219-222`).

### Point snaps

- A single element: its four corners rotated by its angle, plus its centre
  (`SN:266-291`). A diamond or ellipse instead gives its four edge midpoints
  (rotated) plus centre, no corners (`SN:237-265`).
- Points are rounded to 6 decimals (`SN:312`, `SN:809-812`).
- The moving side offers the same kind of points: the dragged selection's
  corners and centre, as one box when several are selected (`SN:723-725`).
- Each moving point is compared with each reference point on X and Y
  separately (`SN:655-688`).

### Gap snaps (equal spacing)

- Built from the reference units' upright bounds (`SN:341-351`). A horizontal
  gap is any pair where one ends left of where the other starts and their
  vertical ranges overlap; its length is the space between, and its overlap
  is the shared vertical range (`SN:353-395`). Vertical gaps mirror this
  (`SN:397-438`). Every pair is considered, not only neighbours.
- A gap is used only if the moving box's perpendicular range overlaps the
  gap's overlap (`SN:476`, `SN:545`).
- Three kinds per gap, first match wins for that gap (`continue`):
  - **Centre**: if the gap is longer than the moving box, centre the box in
    the gap (`SN:480-500`, `SN:549-569`).
  - **Side right / bottom**: put the box after the gap's end element at the
    same spacing (`SN:502-521`, `SN:592-611`).
  - **Side left / top**: put the box before the gap's start element at the
    same spacing (`SN:523-542`, `SN:571-590`).
- Gap snaps are used for drags only, not resize or create (`SN:738-746`
  versus `SN:1195-1203`, `SN:1275-1283`).

## 3. Threshold, choice, offset

- **8 screen px**, divided by zoom: `SNAP_DISTANCE` (`SN:41`, `SN:48-50`). At
  zoom 2 it is 4 scene units; at zoom 0.5 it is 16.
- Inclusive: an offset equal to the threshold snaps (`SN:660`, `SN:674`).
- **Per axis, independently.** The running best starts at the threshold. A
  strictly nearer candidate empties that axis's list; an equal one is added
  (`SN:660-686`). Point snaps run first, gap snaps then compete against the
  same best (`SN:728-746`). The offset applied is the first entry's signed
  offset on each axis, else 0 (`SN:751-754`).
- **Guides come from a second pass.** After snapping, the candidates are
  recomputed at the snapped position with a threshold of 0, so only exact
  coincidences (after rounding) produce lines, and every one of them does,
  on both axes (`SN:762-801`). An axis that did not snap still shows lines if
  something happens to line up exactly.
- **Drag offset.** The pointer delta since the press (`APP:11000-11003`),
  rounded (`SN:713-714`). Shift zeroes the lesser axis first
  (`APP:11010-11025`); the snap offset is still computed on both axes, so a
  Shift drag can shift slightly off its axis to align. The move is
  box origin plus delta plus snap; an axis with no snap falls to the grid
  instead (`DE:164-191`).

## 4. Which interactions snap

| Interaction | Snaps? | Detail |
|---|---|---|
| Drag a selection | Yes: points and gaps | `APP:11125-11139`, `SN:692-807` |
| Alt-drag copy | Yes | caches rebuilt after the copy (`excalidraw/components/App.duplicate.ts:316-317`) |
| Resize | Points only; not a single rotated element | `SN:1118-1128`, `APP:13643-13673` |
| Crop an image | Points only | `APP:13534-13572` |
| Hover before drawing | Pointer snaps to reference points | rect, ellipse, diamond, frame, image, text tools (`SN:1402-1414`, `APP:7900-7931`) |
| Draw a shape | Points only, the dragged corner | `APP:13415-13441`, `SN:1246-1316` |
| Draw a line, arrow, freedraw | No | separate branches (`APP:11213-11294`); not in `SN:1402-1414` |
| Move line or arrow points | No | `element/src/linearElementEditor.ts` has only side-midpoint snapping (`:394-395`) |
| Rotate | No | the rotation handle has no case in `SN:1149-1182`, so no points |
| Arrow-key nudge | No | fixed 1, Shift 5 scene units, or the grid (`APP:5837-5872`, `common/src/constants.ts:28-29`) |

- **Resize detail.** The moving points are the corners the handle moves: an
  edge handle gives the two corners on that edge, a corner handle gives one
  (`SN:1146-1183`), from the press-time bounds plus the delta
  (`SN:1130-1144`). The offset is added to the pointer's resize coordinate
  before `transformElements`, which then applies Shift (aspect lock) and Alt
  (from centre) (`APP:13668-13702`). So with aspect lock the snapped axis
  leads and the other follows the ratio. Guides use the result's four
  corners, exact only (`SN:1210-1238`). Skipped while a drag is running
  (`APP:13643`).
- **Create detail.** Before the press, hovering a snappable tool snaps the
  pointer to the nearest reference point per axis (every visible element on
  its own, not grouped, selected ones included) and remembers that offset
  as `originSnapOffset` (`SN:1318-1400`, `APP:7916-7931`). The drawn element
  starts at the snapped origin; the moving corner is origin plus delta
  (`SN:1261-1263`, `APP:13420-13432`). Grid first, then snap
  (`APP:13402-13437`). Guides use the new box's four corners, no centre,
  exact only (`SN:1295-1310`).

## 5. Guides

Three kinds (`SN:101-118`):

- **Points line.** Moving and reference points that share an X (keyed by the
  moving point's X) make one vertical line from the topmost to the
  bottommost; likewise for Y (`SN:828-896`). Drawn as a line from first to
  last point with a cross at every point (`RS:67-82`).
- **Pointer line** (hover before drawing): a cross at the reference point and
  a line from it to the pointer along the snapped axis (`SN:1360-1380`,
  `RS:84-93`).
- **Gap line.** Two segments per gap snap, one for the existing gap and one
  for the matched gap, at the middle of the shared perpendicular range
  (`SN:915-1106`), de-duplicated (`SN:898-913`). Each is drawn as the segment,
  a perpendicular tick at each end reaching 8 screen px either side, and two
  parallel marks at its middle, each 4 screen px either side of the line,
  2 screen px either side of the midpoint (`RS:127-213`). **No distance
  label** is drawn.

Style (`RS:8-35`, `RS:95-125`):

| Property | Value |
|---|---|
| Colour, light | `#ff6b6b` |
| Colour, dark | `#ff9090` |
| Colour, dark zen | `#da5b5b` |
| Line width | 1 screen px (1.5 in zen) |
| Cross | arms reach 2 screen px from the point each way (3 in zen) |
| Dash | none, solid |
| Zen mode | crosses and gap middle marks only, no lines |

Drawn on the interactive canvas after the selection chrome
(`excalidraw/renderer/interactiveScene.ts:2054`).

**Cleared** on release (`APP:11479-11497`), on a press (`APP:8642-8644`), on a
tool change (`APP:6224-6227`), on hover when no snappable tool and nothing
in progress (`APP:7932-7943`), and when interaction is disabled
(`APP:3388-3393`).

## 6. Performance

- Reference points and gaps are computed once, at the first drag move, and
  reused until release (`APP:11125-11129`, `APP:10575-10621`), then cleared
  (`APP:11496-11497`). The comment says the cache must fill before the first
  move or the element jumps (`APP:11125-11127`). Resize, crop and create
  reuse the same cache (`APP:13657`, `APP:13539`, `APP:13415`).
- Visible-only filtering bounds the work to the viewport (`SN:315-326`).
- Gap pairs are capped at 99,999 checks per axis (`SN:43-45`, `SN:363`,
  `SN:407`), which in practice is no cap: the scan is quadratic.
- Hover snapping is not cached: every move walks every visible element
  (`SN:1332-1385`). State is only replaced when the lines change
  (`APP:7916-7931`).

## 7. Design for Bava

*Decided with the user after this study (2026-09-27): the box rule for every
element; equal spacing between neighbours only, not every pair (Excalidraw's
quadratic scan cost 152 ms to start a zoomed-out drag on 2,000 shapes). The
plan, `.claude/work/plans/07-snapping.md`, records what was built.*

### The module: `frontend/src/canvas/snapping.ts`

Pure, no Konva, no history, tested on plain data like `constrain.ts`.

- `snapReferences(scene, moving, visible)`: the reference points and gaps.
  `moving` is the carried set, `carriedWith(scene, ids)` in `containment.ts:122`,
  so a dragged frame's contents and a group's descendants never snap to
  themselves (fixing Excalidraw's quirk). A group counts as one unit: the
  upright box of its descendants. Points per unit: `cornersOf` (`rotate.ts:104`)
  plus centre; ellipse and diamond give edge midpoints plus centre. Gaps use
  `rotatedBounds` (`rotate.ts:120`). `visible` is the viewport in scene units.
- `snapMove(refs, box, points, delta, threshold)` returns `{ offset, guides }`
  with sections 2 and 3's rules: per axis, points then gaps, nearest wins,
  guides from an exact second pass.
- `snapCorners(refs, points, threshold)` for resize and create: points only.
- `snapPointer(refs, point, threshold)` for hover before drawing.
- `Guide = { kind: 'points'; points } | { kind: 'gap'; from; to; axis } | { kind: 'pointer'; from; to }`,
  all in scene units, rounded with `tidy`.

### Where it plugs into `pointer.ts`

- New options, as the others are passed (`pointer.ts:100-160`):
  `objectSnap?: () => boolean`, `snapDistance?: () => number` (8 screen px
  over the zoom, from a token), `visibleBox?: () => Box`.
- `Drag` gains `snap?: { refs; guides }`, filled at the first move past the
  drag threshold, as Excalidraw fills its cache (section 6).
- A `snapping()` helper: `objectSnap() !== mod`, the same shape as
  `attaching` (`pointer.ts:298`). `mod` is already read on every move
  (`pointer.ts:641-650`), so the inversion follows the key mid-drag. Bava has
  no grid, so Excalidraw's grid condition drops out.
- **Drag** (`pointer.ts:1479-1500`): after the Shift axis lock, add the snap
  offset to `dx, dy`. The Alt-copy branch (`pointer.ts:1503`) needs refs that
  include the originals, since they stay put: build a second set when Alt is
  held, as Excalidraw rebuilds after duplicating.
- **Resize** (`pointer.ts:1430-1450`): only when `angle === 0` (a single
  rotated element does not snap). Take the handle's moving corners from
  `resizeBox(bounds, handle, dx, dy)` without aspect lock, snap them, add the
  offset to `dx, dy`, then call `resizeBox` with `keepAspect: shift` as now.
- **Draw a shape** (`pointer.ts:1566-1580`): snap `point` (the moving corner)
  before `squareBox`/`boxBetween`. Snap the press origin in `down` from the
  hover snap, as `originSnapOffset` does.
- **Hover** with a shape tool: `move` without a drag computes pointer guides
  (uncached, as Excalidraw's).
- Nothing for lines, arrows, pen, points, bends, segments, labels, rotate or
  nudge, matching section 4.
- A getter `snapGuides: Guide[]`, like `snapSpots` (`pointer.ts:483`).

### Where it plugs into the stage and the app

- `CanvasStage.setSnapGuides(guides)` on the non-listening overlay
  (`stage.ts:116`, `:166`), rebuilt per call like `setMarquee`
  (`stage.ts:688-697`), lengths times `1 / zoom`, colour re-read by `restyle`.
- `App.svelte`: `drawDrag` and `drawHover` pass `pointer.snapGuides`
  (`App.svelte:1054-1068`); the release clears them beside `setMarquee(null)`
  (`App.svelte:1125-1127`); a tool change clears them.

### Tokens

In `styles/tokens/_space.scss`, beside `--size-snap-dot`:

- `--size-snap-distance: 8px` (the threshold).
- `--size-snap-guide: 1px` (line width).
- `--size-snap-cross: 4px` (the cross, end to end; Excalidraw's 2 px each way).
- `--size-snap-gap-tick: 16px` (end ticks, 8 px each way) and
  `--size-snap-gap-mark: 8px` (middle marks, 4 px each way, 4 px apart).

In `styles/tokens/_swatches.scss`, beside `--color-binding-highlight`:
`--color-snap-guide`, light `#ff6b6b`, dark `#ff9090` (Excalidraw's).

### Setting

- `internal/config/config.go`: `ObjectSnap bool json:"objectSnap"` with a
  default in `Defaults()`; an older file without the key takes the default,
  as `ArrowBinding` does (`config_test.go:186-208`).
- `settings/settings.svelte.ts`: `objectSnap` plus `setObjectSnap`; the
  defaults test compares Go and TS (`settings/settings.test.ts:90-91`).
- `settings/CanvasSection.svelte`: a third row, "Snap to objects", hint
  "Hold ⌘ or Ctrl while dragging to do the opposite."
- Update the `CanvasSection` row in `.ai/rules/design-system.md:194`.

### Shortcuts Excalidraw binds, for the user to choose from

- Alt+S: toggle snapping (`TOG:32-33`).
- Cmd/Ctrl held during a drag: invert it (`SN:178-183`).
- Cmd/Ctrl+': toggle grid, which turns snapping off (Bava has no grid).

Alt+S is free in Bava's menu spec (`internal/app/menu/spec.json`); taking it
means a menu item with a spec `shortcut` (`.ai/rules/wails.md:76`). The
Cmd/Ctrl inversion needs no binding: it is read from the move event.

### Failing tests to write first

`canvas/snapping.test.ts`:

1. A box dragged to within 8 scene units (zoom 1) of another's left edge
   snaps flush; at 9 it does not; at zoom 2 the reach is 4.
2. X and Y snap independently; the nearer candidate wins on each axis.
3. Centres align to centres; an ellipse offers edge midpoints, not corners.
4. A rotated reference offers its rotated corners.
5. A group snaps as one box; its children are not separate references.
6. The moving set, including a dragged frame's contents, is never a reference.
7. Elements outside the visible box are not references.
8. Equal spacing: with A and B 40 apart, C dragged near 40 past B snaps to 40;
   C dragged into a wider gap centres in it; guides are two gap lines.
9. Guides list every exact coincidence after the snap, and none that only
   came within the threshold.
10. Resize with the east handle snaps only X, from the two east corners;
    a corner handle snaps one corner.

`canvas/pointer.test.ts`:

11. With `objectSnap` on, a drag's preview lands flush; with `mod` held it
    does not; with the setting off and `mod` held it snaps.
12. A Shift-locked drag still snaps on the locked axis.
13. Resizing a single rotated element never snaps.
14. Drawing a rect snaps its dragged corner; its origin snaps on the press.
15. Drawing a line or arrow, dragging a point, rotating and nudging never snap.
16. `snapGuides` is empty after release.

`canvas/stage.test.ts`:

17. `setSnapGuides` draws on the overlay in `--color-snap-guide`, width
    `--size-snap-guide` over the zoom, and nothing after `setSnapGuides([])`.

`internal/config/config_test.go` and `settings/settings.test.ts`:

18. `objectSnap` has its default, survives a round trip, and an older file
    without it takes the default.

### Choices for the user

1. **Default on or off.** Excalidraw ships it off (`appState.ts:130`).
2. **Alt+S or no shortcut.** The setting and Cmd/Ctrl inversion work without one.
3. **Arrows attached to a moving shape.** Excalidraw leaves them as
   references at their old place; Bava could exclude them, since they re-aim.
4. **Which shapes use edge midpoints.** Excalidraw: ellipse and diamond.
   Bava also has hexagon, cloud, person and others.
   *Decided 2026-09-27:* the box rule. Every element offers its box's four
   corners, four side middles and centre, whatever it draws.
5. **Text tool.** Excalidraw snaps its hover origin; Bava places text on a
   click, so snapping that click is optional.
6. **Distance labels on gap guides.** Excalidraw draws none; adding them is new.
