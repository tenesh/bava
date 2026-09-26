# Excalidraw comparison

Read 2026-09-26 from Excalidraw (MIT) at commit `5db42c3` (2026-09-25),
shallow-cloned into a session scratchpad, never into this repo. Excalidraw
paths are relative to its repo (`packages/…`); Bava paths are relative to the
Bava repo, or to `frontend/src/` where a section says so. Copying code from
Excalidraw needs a `NOTICE` entry.

Sections 1 to 7 are a full read by area. The appendix is the first, narrower
pass (gestures, arrow binding, the text editor), kept because plan 06.8 was
drawn from it. No code came with this document. Verdicts are proposals, to be
weighed with the user's hand-test report, which sets priorities.

Verdicts: **Adopt** (take as is), **Adapt** (the idea, changed for Bava),
**Ignore** (with the reason), **Better in Bava**. Size: S under a day, M days,
L a milestone. "On disk?" is Yes when the item changes what Bava writes.

## Bugs in Bava found by this read

Checked against the code by the main session (✓), or found by a section reader
from the code and not yet checked (·). None was seen at a running window.

| | Bug | Where | Section |
|---|---|---|---|
| ✓ | Choosing font size 20 or stroke width Medium draws at 13 and 1.5: the toolbar's defaults (20, 2) clear the key, but the canvas draws a missing key from the tokens (13, 1.5) | `canvas/style.ts:202-219`, `canvas/paint.ts:81-95` | 1 |
| · | Label lines past the shape's height vanish on the canvas but not in the SVG export | `canvas/stage.ts:690`, `canvas/export/svg.ts:84-99` | 1 |
| · | Top- and bottom-aligned labels sit 6px apart between canvas and export | `canvas/stage.ts:688-690`, `canvas/export/svg.ts:88-92` | 1 |
| ✓ | Shift-click cannot remove an element from the selection, as `docs/shortcuts.md` promises | `canvas/pointer.ts:276` | 2 |
| ✓ | Tab selects locked elements | `canvas/selection.ts:69-80` | 2 |
| · | Resizing a frame stretches its contents; align, distribute and flip leave them behind; duplicating copies it empty | `canvas/pointer.ts:154,263,504`, `canvas/commands.ts:121`, `canvas/edit.ts:116,139` | 2 |
| · | Bring to Front / Send to Back on a group moves only its wrapper | `canvas/commands.ts:270-281` | 2 |
| ✓ | A dashed arrow exports with dashed heads; the canvas draws them solid | `canvas/export/svg.ts:58-63,175-180` | 3 |
| · | An arrow attached at both ends cannot be dragged: the move is undone with no feedback | `canvas/pointer.ts:334-340`, `canvas/binding.ts:199-215` | 3 |
| · | Round edges on a line are offered but do nothing | `canvas/curves.ts:23` | 3 |
| ✓ | No canvas cursor for any tool | no `cursor` rule outside the splitter | 4 |
| ✓ | Pen strokes are drawn as corners: the smoothed outline in `stroke.ts` has no caller outside tests | `canvas/stroke.ts:69-76`, `canvas/stage.ts:587-588` | 4 |
| · | Pressing a tool letter mid-drag probably drops what is being drawn | `canvas/keymap.ts:78-83`, `canvas/pointer.ts:355` | 4 |
| · | Enter on a selected rotated element or arrow probably opens no editor | `App.svelte:514-521` | 4 |
| ✓ | Two elements sharing an id (a hand edit) lose one silently on the next paste, group or align | `canvas/scene.ts:162`, `canvas/commands.ts:54-61` | 5 |
| ✓ | Repeated paste stacks copies in one place; the canvas clipboard goes stale after copying elsewhere | `canvas/edit.ts:61`, `canvas/commands.ts:48` | 5 |
| · | One bad value in the canvas block makes the whole file unopenable | `internal/format/read.go:61` | 5 |
| ✓ | The AI pane shows the canvas's empty-state text | `shell/Shell.svelte:149` | 6 |
| ✓ | No file resets or restores the view: a second file opens at the first file's pan and zoom | `App.svelte` (no zoom-to-fit) | 6 |
| · | The shortcuts dialog omits every canvas-only key and gesture | `shell/shortcuts.ts:58-79` | 6 |
| ✓ | Every render restacks every element (O(n²) per drag frame), the scene layer keeps a hit canvas it never uses, and each text measurement creates a canvas | `canvas/stage.ts:112,165`, `canvas/text-measure.ts:55` | 7 |

## Best value for effort, across sections

Small, runtime only, no file format change, unless marked:

1. **Performance quick wins** (7): scene layer not listening, one render per
   animation frame, skip unchanged elements, one shared measuring context.
   Likely part of "not smooth", and cheap.
2. **The default mismatches** (1): one decision (are the defaults 20 and 2, or
   13 and 1.5?) and a two-line fix.
3. **Plan 06.8** (appendix): select after a draw, zoom-true distances, the text
   editor matching its text.
4. **Selection feel** (2): Shift-click removes, click narrows on release, press
   inside a multi-selection drags it, Shift locks a move's axis, Shift+arrow
   nudges 5, Alt-drag duplicates.
5. **Cursors** (2, 4): per tool, and for resize and rotate handles.
6. **Frame and group expansion** (2): one helper, `carriedWith`, in every
   command.
7. **Zoom to fit and to selection, fit on open** (6).
8. **Arrow targeting by distance, highlight on endpoint drags** (appendix A2):
   the "resists rebinding" fix.
9. **Pen through the existing smoothing code** (4).
10. **Labels that fit their shape** (1): per-shape text area, grow on commit,
    adaptive corner radius.

Larger, later: object snapping and guides (Milestone 7), elbow routing that
leaves from the right side (3), system clipboard and paste from other apps
(5), a `none` fill and stroke (1, on disk), bend points on arrows (3, on disk),
images as sibling files (1, on disk), command palette (6).

Ignored as a class: collaboration, hand-drawn rendering and fill patterns,
embeds from the web, touch and mobile gestures.

## 1. Elements and how they draw

Excalidraw's element model is wider (image, sticky note, embeddable, font as a property), but Bava's gains are mostly in the small rules turning a style value into pixels. Its labels fit the shape they sit in: a diamond or ellipse wraps text to the inscribed rectangle, and a container grows when its text no longer fits. Its dash patterns and corner radii scale with the element, so a small rounded box stays a box and a bold dotted line stays dotted. A shape can have no fill at all, and a frame's opacity fades its contents. Reading Bava's side turned up two default mismatches that make the toolbar and the file disagree with what is drawn (see Bugs).

| Feature / behaviour | Excalidraw (value, file:line) | Bava (file:line or "none") | Verdict | Size | On disk? |
|---|---|---|---|---|---|
| No fill (transparent) | `transparent` is the default background and the first quick pick (`common/src/colors.ts:194,254-260`, `common/src/constants.ts:521`) | none: every shape fills with a swatch or `--color-shape-fill` (`canvas/paint.ts:86`, `canvas/palette.ts:82-89`) | **Adopt**: a `none` colour value for `fill` and `stroke` | S | Yes |
| Rounded rect radius | adaptive: 32 px, but 25% of the shorter side when that side is 128 or less (`element/src/utils.ts:528-549`, `common/src/constants.ts:440-442`) | fixed `--radius-shape-round` 32px (`canvas/paint.ts:125`, `styles/tokens/_radius.scss:12`); Konva and SVG clamp it to half the side | **Adopt** the cutoff | S | No |
| Label area in non-rect shapes | ellipse: w/2·√2 minus 2×5; diamond: w/2 minus 2×5 (`element/src/textElement.ts:511-540,542-569`), offsets at `:396-410` | same 6px inset for every shape (`canvas/stage.ts:659-690`) | **Adopt** per shape (add hexagon, parallelogram, cloud) | S | No |
| Container grows to fit its label | height (and width) grown via `computeContainerDimensionForBoundText` (`element/src/textElement.ts:114-134,492-509`); also on resize (`:155-230`); original height cached while editing (`element/src/containerCache.ts`) | none; lines past the shape's height are dropped (see Bugs) | **Adopt** on label commit | M | h changes; format unchanged |
| Word wider than the box | broken by character (`element/src/textWrapping.ts:578-608`) | left overflowing (`canvas/text-layout.ts:18-20`) | **Adopt** | S | No |
| Hyphen, CJK and emoji breaks | Unicode-aware tokeniser (`element/src/textWrapping.ts:145-170,382-390`) | spaces only (`canvas/text-layout.ts:28`) | **Adapt**: `Intl.Segmenter` rather than the regex (support in WebKitGTK and WebView2 not verified) | S | No |
| Tabs | replaced by 8 spaces before measuring (`element/src/textMeasurements.ts:64-70`) | not handled | **Adopt** | S | No |
| Arrow label width | max(0.7 × width, fontSize × 11) (`common/src/constants.ts:419-420`, `element/src/textElement.ts:515-520`) | path length (`canvas/stage.ts:676`); a short arrow wraps word per line | **Adopt** the minimum | S | No |
| Dash patterns | dashed `[8, 8+sw]`, dotted `[1.5, 6+sw]`, stroke +0.5 when not solid; heads stay solid (`element/src/shape.ts:168-170,202-216,332-338`) | fixed `[6,6]` and `[2,4]` (`canvas/paint.ts:64-74`, `styles/tokens/_space.scss:47-48`) | **Adopt** scaling with width, round caps for dotted | S | No |
| Stroke widths | 1/2/4; freedraw halved to 0.5/1/2 (`common/src/constants.ts:477-501`) | 1/2/4 options (`canvas/property-options.ts:51-58`) | Matches (default is a bug, below) | n/a | No |
| Opacity | 0 to 100, multiplied by the containing frame's (`element/src/renderElement.ts:175-188`) | 0 to 100 per element group (`canvas/stage.ts:788`); a frame's opacity does not reach its contents | **Adopt** the multiply | S | No |
| Roughness | 0/1/2 via roughjs (`common/src/constants.ts:463-467`, `element/src/shape.ts:172-193`) | none | **Ignore**: hand-drawn | n/a | n/a |
| Fill patterns | hachure, cross-hatch, zigzag, solid (`element/src/types.ts:19`) | solid only | **Ignore**: hand-drawn | n/a | n/a |
| Closed line fills | a looped line or freedraw takes the background (`element/src/shape.ts:243-253`, loop test `element/src/utils.ts:512-520`) | `line` never fills (`docs/file-format.md` "Lines, arrows and strokes") | **Adapt**: fill when first and last point meet | M | Yes |
| Palette | open-color, 12 hues × 5 shades plus black, white, transparent; stroke default shade 4, fill shade 1 (`common/src/colors.ts:190-212`); dark mode by invert 93% + hue-rotate 180 per colour (`:16-122`) | 8 named swatches, each a hand-tuned fill/stroke/text triple per theme (`styles/tokens/_swatches.scss`), literals adapted by luminance (`canvas/palette.ts:65-80`) | **Better in Bava** (theme-true, diffable names) | n/a | n/a |
| Picker extras | 5 most-used custom colours in the scene (`components/ColorPicker/colorPickerUtils.ts:55-89`), hotkeys q..b (`:38-42`), eyedropper | hex text field only (`components/StyleBar.svelte:98-112`) | **Adapt**: most-used literals row, plus a native colour input | S | No |
| Style carries to the next element | `currentItem*` in app state (`excalidraw/appState.ts:32-48`) | new elements always default | **Adapt** (per session, not in the file) | S | No |
| Font families | 9 ids incl. Excalifont, Nunito, Lilita One, Comic Shanns, Liberation Sans, Cascadia (`common/src/constants.ts:137-148`); CJK and emoji fallbacks (`:176-194`) | Geist for all canvas text, Geist Mono for code (`canvas/paint.ts:94,113`) | **Adapt**: a `fontFamily` of `sans`/`mono` on text and labels; a CJK fallback is a separate question | M | Yes |
| Line height per font, stored | `lineHeight` on each text element, 1.15 to 1.25 by font (`element/src/types.ts` text type, `common/src/font-metadata.ts:41-129`) | token `--leading-tight` 1.2, not stored (`canvas/paint.ts:96`) | **Adapt**: store it, or freeze the token; changing it today reflows every stored `measuredHeight` | S | Yes |
| Baseline from font metrics | ascender/descender offset (`common/src/font-metadata.ts:155-170`) | SVG baseline at top + fontSize (`canvas/export/svg.ts:80`), Konva places lines its own way | **Adopt** so export and canvas share one offset | S | No |
| Font subsetting on export | harfbuzz woff2 subset in a worker (`excalidraw/subset/subset-main.ts`) | whole Geist embedded, about 93KB (`canvas/export/fonts.ts:9-10`) | **Adapt** later; tooling not chosen | M | No |
| Image element + crop | `fileId`, `scale` flip, `crop` in natural px (`element/src/types.ts:152-171`); resized to 1440 px, 4MB cap (`common/src/constants.ts:401-404`); `MINIMAL_CROP_SIZE = 10` (`element/src/cropElement.ts:31`) | none | **Adapt**: image as a sibling file referenced by relative path, never base64 in the Markdown | L | Yes |
| Sticky note | own type; 250 default, padding 16, font shrinks from the user's size to 16 in steps of 2, grows above `baseHeight`, date footer (`common/src/constants.ts:219-262`, `element/src/stickyNote.ts:598-611`) | none | **Adapt** only the auto-fit idea for labels; the type itself is a whiteboard feature | M | Yes if added |
| Convert stroke to shape | moment-based recogniser, 64-point resample, 25 px on-screen minimum, closed if gap ≤ 15% of length (`element/src/convertToShape.ts:62-106,502,535`) | none | **Adapt** later: pen stroke to rect/ellipse/diamond/arrow | M | No |
| Bucket fill | enclosed polygon under the click (`element/src/bucketFill.ts`) | none | **Ignore**: needs closed-line fills first; sketch feature | M | Yes |
| Embeddable / iframe | YouTube, generic links (`element/src/embeddable.ts`) | none | **Ignore**: network | n/a | n/a |

### Top picks
1. Fix the `fontSize` and `strokeWidth` default mismatches (Bugs 1, 2): the toolbar, the file spec and the drawing should agree.
2. Stop dropping label lines, and grow the shape to fit its label on commit (Bug 3; Excalidraw `textElement.ts:114-134`).
3. Per-shape label area for diamond, ellipse and the outline shapes.
4. Adaptive corner radius: 25% of the shorter side up to 128, then 32.
5. A `none` fill and stroke.
6. Dash patterns that scale with stroke width.

### Bugs or weaknesses spotted in Bava
1. **Font size default disagrees.** `canvas/paint.ts:95` falls back to `--text-body`, 13px (`styles/tokens/_type.scss:44`), but `canvas/style.ts:206` and `docs/file-format.md:189` say absent means 20. `setProperty` clears the key when the user picks Medium (20) (`canvas/style.ts:218-219`), so choosing 20 draws at 13. `App.svelte:467-472` also measures new text at 13.
2. **Stroke width default disagrees.** Absent draws 1.5 on shapes and 2.25 on pen strokes (`canvas/paint.ts:81-83`, `styles/tokens/_space.scss:29-30`); the spec and `PROPERTY_DEFAULTS` say 2 (`docs/file-format.md:185`, `canvas/style.ts:202`). Picking Medium clears the key and draws 1.5.
3. **Overflowing labels vanish on the canvas only.** The label node gets the shape's height (`canvas/stage.ts:690`), and Konva stops adding lines past a fixed height (`node_modules/konva/lib/shapes/Text.js:556`). The SVG exporter draws every line (`canvas/export/svg.ts:84-99`), so canvas and export disagree.
4. **Label vertical inset differs between canvas and export.** The stage places shape labels at y 0 with the full height (`canvas/stage.ts:688-690`); the exporter insets top and bottom by `--size-label-inset` (`canvas/export/svg.ts:88-92`). Top and bottom aligned labels sit 6px apart.
5. **Small rounded rectangles become pills.** A fixed 32px radius (`canvas/paint.ts:125`) clamped to half the shorter side turns any box under 64px tall into a stadium.
6. **Dotted at width 4 reads as dashes.** A 2px dot with a 4px gap is fixed (`canvas/paint.ts:69-71`) whatever the stroke width.

## 2. Selecting and transforming

Excalidraw's selection is forgiving where Bava's is flat: a press inside a multi-selection drags it, a click on one member narrows to it on release, Shift-click removes, Shift-marquee adds, and the marquee updates live. Groups can be entered (double-click, or Cmd/Ctrl-click); in Bava a group's child is reachable only by Tab. Moves and resizes carry modifiers Bava lacks: Shift axis lock, Alt duplicate-drag, Alt from-centre, flip past an edge, Shift+arrow 5. Frames clip, adopt what they are drawn around, and are neither rotated nor scaled with their contents. Bava has bugs where frames and groups are expanded by different helpers in different commands. Bava's nested frames are better (Excalidraw refuses them, `element/src/frame.ts:469`).

| Feature / behaviour | Excalidraw (value, file:line) | Bava (file:line or "none") | Verdict | Size | On disk? |
|---|---|---|---|---|---|
| Shift-click a selected element removes it | on release, not press (`excalidraw/components/App.tsx:12237-12296`) | `canvas/pointer.ts:276` skips an already selected hit | **Adopt** (bug) | S | No |
| Click one of several selected, no drag, narrows to it | on release (`App.tsx:12365-12371`) | selection stays whole (`canvas/pointer.ts:276`, `:533-537`) | **Adopt** | S | No |
| Press inside the multi-selection box (empty space) drags it | `hasHitCommonBoundingBoxOfSelectedElements` (`App.tsx:9611-9618`) | clears and starts a marquee (`canvas/pointer.ts:277-279`) | **Adopt** | S | No |
| Marquee rule | "contain" by default, "overlap" a preference (`excalidraw/appState.ts:137`, `components/main-menu/DefaultItems.tsx:447-475`) | any graze selects (`canvas/selection.ts:18-21`) | **Adapt**: contain by default | S | No |
| Marquee updates while dragging; Shift adds to the existing selection | `App.tsx:11302-11360` | applied on release only and replaces (`canvas/pointer.ts:375-378`, `canvas/selection.ts:50-52`) | **Adopt** both | S | No |
| Frame and its children never selected together | `element/src/selection.ts:48-68` | no rule; Select All and marquee pick both (`canvas/selection.ts:50-56`) | **Adopt** | S | No |
| Lasso | tool, or Alt mid-marquee, or Cmd+Alt drag (`App.tsx:9650-9662`, `:11173-11177`; `lasso/utils.ts:322-330` contain/overlap) | none | **Ignore** for now | M | No |
| Enter a group: double-click selects the member, click outside exits | `editingGroupId` (`App.tsx:7347-7369`, `:9676-9689`) | none; the wrapper sits above its children and wins every hit (`canvas/edit.ts:195-200`, `canvas/pointer.ts:137`) | **Adapt** as "editing group" UI state | M | No |
| Cmd/Ctrl-click deep-selects through groups | `App.tsx:9646-9672` | none | **Adopt** | S | No |
| Shift while moving locks to the dominant axis | `App.tsx:11010-11025` | none (`canvas/pointer.ts:533-545` ignores Shift) | **Adopt** | S | No |
| Alt-drag duplicates, originals stay put | `App.tsx:11162-11164`, `components/App.duplicate.ts:167-297` | none | **Adopt** | S | No |
| Arrow-key nudge | 1, Shift 5 (`common/src/constants.ts:28-29`); grid size when the grid is on (`App.tsx:5838-5844`) | 1 always, Shift ignored (`canvas/keymap.ts:60-71`) | **Adopt** Shift = 5 | S | No |
| Duplicate offset and z | +10 each axis (`actions/actionDuplicateSelection.tsx:78-79`), copy placed just above its original (`element/src/duplicate.ts:294-309`) | +16, copy to the top (`canvas/edit.ts:14`, `canvas/scene.ts:170-177`) | **Ignore** offset (feel); **Adapt** z | S | No |
| Duplicating a frame copies its contents | `element/src/duplicate.ts:351-385` | `canvas/edit.ts:116` expands groups only: an empty frame is copied | **Adopt** (bug) | S | No |
| Resize from centre with Alt | `common/src/keys.ts:145-146`, `element/src/resizeElements.ts:585-587` | none | **Adopt** | S | No |
| Flip by dragging a handle past the opposite edge | sign kept (`resizeElements.ts:757-762`) | clamps at `MIN_SIZE` 4 (`canvas/resize.ts:24,62-65`) | **Adapt** | M | No |
| Shift from a side handle anchors the opposite side's middle | `resizeElements.ts:589-597` | anchors top-left, "width grows rightward" (`canvas/resize.ts:79-84`) | **Adopt** | S | No |
| Multi-resize goes uniform when any member is rotated, text or grouped | `resizeElements.ts:1370-1377` | non-uniform, rotated members approximated (`canvas/rotate.ts:186-218`) | **Adopt** for rotated members | S | No |
| Text resize: corner scales font, side changes wrap width | `resizeElements.ts:317-410` | handles only slide a lone text (`canvas/resize.ts:98-101`) | **Adapt**: corner scales `fontSize` | M | Yes (`fontSize`, measurement) |
| Minimum size of a labelled shape is one line of its label | `resizeElements.ts:778-790` | 4 units (`canvas/resize.ts:24`) | **Adapt** | S | No |
| Two-point line: no box, end handles only | `transformHandles.ts:336-353` | box handles; lines have no end handles (`canvas/pointer.ts:588`) | **Adapt**: end handles for lines | S | No |
| Resize/rotate cursors, turned with the element | `element/src/resizeTest.ts:232-275` | no canvas cursors at all | **Adopt** | S | No |
| Handles hidden when there is nothing to do | locked or elbow: none (`transformHandles.ts:281-288`) | code-only selection draws 8 dead handles (`canvas/stage.ts:342-357` vs `canvas/pointer.ts:252`) | **Adopt** (bug) | S | No |
| Frames cannot rotate | no rotation handle (`transformHandles.ts:71-77,302-306`); skipped in multi-rotate (`resizeElements.ts:434`) | frames rotate (`canvas/rotate.ts:71-73`) | **Adopt** | S | No |
| Resizing a frame does not scale its contents | membership re-evaluated (`App.tsx:12145`, `frame.ts:283`) | `dragTargets` expands to members (`canvas/pointer.ts:146-155,263,504`): the contents stretch | **Adopt** (bug) | S | No |
| Frame clipping | on by default (`appState.ts:112`, `frame.ts:911-945`) | none | **Adapt**, as a frame option | M | Yes if optional |
| Frame hit by outline and name, not interior | `element/src/collision.ts:85-105,165-173` | whole box (`canvas/pointer.ts:137`): no marquee can start inside a frame | **Adopt** | S | No |
| Drawing a frame adopts what lies wholly inside | `App.tsx:11954-11967`, `frame.ts:380-393` | frames skipped by `membershipFor` (`canvas/containment.ts:52`), so no | **Adopt** | S | Yes (`frame` keys) |
| Join a frame by where the pointer is, highlighted while dragging | `App.tsx:10949-10959` | wholly inside, no highlight (`canvas/containment.ts:27-32`) | **Adapt**: add the highlight, keep the rule | S | No |
| Z-order moves a group as one | group members contiguous (`element/src/zindex.ts:289-300`) | forward/backward do (`canvas/edit.ts:201-236`); front/back move only the wrapper (`canvas/commands.ts:270-281`) | **Adopt** (bug) | S | No |
| Align/distribute with frames | disabled when a frame is selected (`actions/actionAlign.tsx:50`) | moves the frame and leaves its contents (`canvas/commands.ts:121`) | **Adopt** a fix | S | No |
| Distribute with overlap | falls back to centres when the gap is negative (`element/src/distribute.ts:48-72`) | negative gap kept (`canvas/align.ts:71`) | **Adopt** | S | No |
| Flip | includes frame children (`actions/actionFlip.ts:92`) | groups only (`canvas/edit.ts:139`): a frame flips empty | **Adopt** (bug) | S | No |
| Lock | toggles (`actions/actionElementLock.ts:147-151`); clicking a locked element offers Unlock for it (`App.tsx:11530-11535`, `components/UnlockPopup.tsx`) | lock, and Unlock All only (`canvas/commands.ts:212-231`) | **Adapt**: per-element Unlock on right-click | S | No |
| Link to an element | `?element=<id>` URL, click scrolls to it (`element/src/elementLink.ts:13-24,94-104`) | none | **Adapt** later: a doc-to-canvas link by id | M | Yes |
| Flowchart by keyboard | Cmd+Arrow adds a linked clone 100 units away; Alt+Arrow walks links (`element/src/flowchart.ts:57-58`, `components/App.flowchart.ts:103-163`) | none | **Adapt** | M | No |

### Top picks
- Fix the frame and group expansion bugs (align, flip, duplicate, resize, bring to front/back): one helper, `carriedWith`, everywhere.
- Selection feel: Shift-click removes, click narrows on release, press inside a multi-selection drags, Shift-marquee adds, live marquee.
- Shift axis lock on move, Alt-drag duplicate, Shift+arrow nudge of 5.
- Resize and rotate cursors, and Alt from-centre resize.
- Frames: hit by outline, adopt on draw, not rotatable, not scaled on resize.

### Bugs or weaknesses spotted in Bava
- Shift-click cannot remove a selected element, contrary to `docs/shortcuts.md:150`: `canvas/pointer.ts:276`.
- Resizing a frame scales everything inside it: `canvas/pointer.ts:154,263,504` via `carriedWith`.
- Align, distribute and flip use `withDescendants`, which ignores frame members: `canvas/commands.ts:121`, `canvas/edit.ts:139`. The frame moves, its contents stay, and they keep a `frame` key while lying outside it. Nudge and drag use `carriedWith` (`App.svelte:965-978`).
- Duplicate of a frame copies an empty frame: `canvas/edit.ts:116`.
- Bring to Front / Send to Back on a group moves only the wrapper, which draws nothing: `canvas/commands.ts:270-281`.
- Tab traversal selects locked elements: `canvas/selection.ts:69-80` does not filter `isLocked`, against `.ai/rules/canvas.md`.
- A lone text element has live-looking handles that only slide it: `canvas/resize.ts:98-101`. A code-only selection draws handles the pointer ignores: `canvas/stage.ts:342-357` vs `canvas/pointer.ts:252`.
- The group wrapper's box ignores child rotation (`canvas/edit.ts:37` uses `boundsOf`, not `drawnBoundsOf`).
- A step in paint order renumbers z to 1..n (`canvas/commands.ts:94`); after Send to Back (`canvas/scene.ts:206`) or deletions one step can rewrite most z values: diff noise. (Unverified in a real file.)

## 3. Arrows and lines (beyond binding)

Excalidraw treats a line or arrow as an editable polyline: click-by-click drawing, a midpoint handle that bends a straight arrow, a point editor, and a label the user can slide along the path. Its elbows are real routes: the heading comes from the side the end is on, both bound shapes are padded obstacles, an A* search penalises bends, and a dragged middle segment stays put. Its heads shrink on short arrows, outline heads hide the line under them, and heads stay solid on dashed lines. Bava stores two-point arrows with a derived route, which diffs well and should stay, but its elbow is a fixed Z that ignores sides, its arc always bows left, and nothing on an arrow but its ends can be moved.

| Feature / behaviour | Excalidraw (value, file:line) | Bava (file:line or "none") | Verdict | Size | On disk? |
|---|---|---|---|---|---|
| Click-by-click drawing | a press that moves under `MINIMUM_ARROW_SIZE` = 20 screen px enters multi-point mode (`excalidraw/components/App.tsx:11745-11781`, `common/src/constants.ts:26`); each click adds a point; a click within `LINE_CONFIRM_THRESHOLD` = 8 of the last point, Enter or Escape finishes (`App.tsx:10236-10256`) | a click is not a shape (`canvas/pointer.ts:549`); drag only | **Adapt**: for lines and straight arrows; needs multi-point first | M | Yes (more points) |
| Minimum arrow length | drag under 20 screen px is not a finished arrow (`App.tsx:11750`) | `DRAG_THRESHOLD` = 3 scene units (`canvas/pointer.ts:45`, via `farEnough`, `:549`) | **Adapt**: a larger floor for linear tools, in screen px | S | No |
| Multi-point lines and arrows | any number of points (`element/src/types.ts:369-377`) | two points when drawn (`docs/file-format.md:214-218`); imported D2 arrows carry many (`canvas/import/convert.ts:141-155`) but only the ends are handles (`canvas/pointer.ts:592`) | **Adapt** | L | Yes |
| Midpoint handle bends a straight line | a two-point line shows a segment midpoint; dragging it past `DRAGGING_THRESHOLD`/zoom inserts a point (`element/src/linearElementEditor.ts:811-860,1736-1780`); hidden when the segment is under 4 × `POINT_HANDLE_SIZE` = 40 screen px (`:935-974`) | none | **Adapt**: the cheapest route to bent arrows | M | Yes |
| Point editor | double-click a line, or Cmd+double-click an arrow, toggles it (`App.tsx:7258-7267`, `actions/actionLinearEditor.tsx:27-80`); Alt+click appends a point (`linearElementEditor.ts:1099-1113`); Delete removes selected points (`actions/actionDeleteSelected.tsx:253`); point handle 10 screen px, hit at 11 (`linearElementEditor.ts:231,1433-1459`) | none | **Adapt** after multi-point | M | Yes |
| Curve vs sharp | `round` arrow type = `roundness` on the path, curving through its points (`actions/actionProperties.tsx:2080-2086`); a two-point round arrow is straight (inferred, not verified) | `arc`: one quadratic bow, `ARC_BOW` = 0.2 of the length, always to the left, 12 samples (`canvas/arrows.ts:10-14,34-53`); `edges: round` on a line smooths through its points (`canvas/curves.ts:22-45`), which has no effect on a two-point line | **Adapt**: let the bow be flipped or dragged (a stored bend); keep `arc` for a one-drag curve | M | Yes |
| Elbow heading | side taken from four cones around the shape's box, scaled ×2 (`element/src/heading.ts:228-281`); diamonds handled apart (`:69`) | the longer axis of the end-to-end delta decides (`canvas/arrows.ts:27-31`); the side is never considered | **Adopt** the side-based heading | S | No |
| Elbow obstacle avoidance | A* over a grid built from the padded start and end boxes (`BASE_PADDING` = 40, `element/src/elbowArrow.ts:111,1437-1505,1851-1906`); bends cost (Manhattan distance)³, no reversing (`:1535-1644`); only the two bound shapes are obstacles, not the rest of the scene (`:1605-1610`) | none: a fixed Z through the midpoint (`canvas/arrows.ts:27-31`) | **Adapt**: heading plus padded boxes gives most of the gain; full A* only if needed | M | No |
| Draggable elbow segments | each middle segment has a midpoint handle (hidden under 5 screen px, `linearElementEditor.ts:944-950`); a drag stores `fixedSegments` (`types.ts:385-401`, `linearElementEditor.ts:2269`); double-click the handle releases it (`App.tsx:7271-7293`) | none; elbow cannot rotate (`canvas/rotate.ts:71-72`) | **Adapt**: one stored offset for the middle segment covers the Z case | M | Yes |
| End snaps to a side's midpoint | within the binding distance, 5% tolerance (`element/utils.ts:769-808`), on by default (`excalidraw/appState.ts:79`) | none | **Adapt** with the stored attach point from section 2 | S | Yes |
| Multi-point bound end aims at its neighbour | a bound end of a 3+ point arrow aims at the adjacent point (`element/src/binding.ts:1991-1999`) | always aims at the other shape's centre (`canvas/binding.ts:143-147`) | **Adopt** | S | No |
| Arrowhead catalogue | arrow, bar, circle, triangle, diamond, their outlines, six cardinality heads (`types.ts:342-365`); legacy names mapped (`element/src/arrowheads.ts:3-21`) | the same eight plus none (`canvas/arrows.ts:75-111`); cardinality deferred (`docs/file-format.md:202-204`) | Adopt the cardinality set when ER diagrams need it | S | Yes (new names) |
| Arrowhead size | arrow 25, diamond 12, crowfoot 15, cardinality 20, others 15, scene units; half-angle 20° for arrow, 25° else (`element/src/bounds.ts:711-744`) | one `--size-arrowhead` = 10px for every kind and every stroke width (`styles/tokens/_space.scss:31`, `canvas/stage.ts:750`) | **Adapt**: per-kind ratios, and grow with stroke width | S | No |
| Head shrinks on a short arrow | capped at half the last segment, a quarter for diamonds (`bounds.ts:832-837`) | none: a 12-unit arrow gets a 10-unit head | **Adopt** | S | No |
| Outline heads hide the line | filled with the canvas background (`element/src/shape.ts:386,401,421,458`) | `fill ''`, the line shows inside a hollow head (`canvas/stage.ts:771-772`, `canvas/export/svg.ts:175-180`) | **Adopt** | S | No |
| Label position | a 0 to 1 `labelPosition` along the path (`linearElementEditor.ts:2037-2067,2112-2120`); dragged to the closest path point (`:1963-2035`); default is the middle point or middle segment's centre (`:1942-1960`) | half the path length (`canvas/arrows.ts:141-167`), not movable | **Better in Bava** for the default; **Adapt** a stored, draggable position | M | Yes |
| Line hidden behind the label | even-odd clip hole, `BOUND_TEXT_PADDING` = 5 (`element/src/renderElement.ts:1140-1175`, `common/src/constants.ts:418`) | none: the line runs through the text (`canvas/stage.ts:668-684`) | **Adopt** (a clip on stage and a mask in SVG) | S | No |
| Label wrap width | max(0.7 × arrow width, fontSize × 11) (`element/src/textElement.ts:510-520`, `common/src/constants.ts:419-420`) | the path's length (`canvas/stage.ts:676`, `canvas/export/svg.ts:154`) | **Adopt** the minimum | S | No |
| Arrow type switch | sharp, round, elbow; to elbow resets to two points, clears the angle and fixed segments (`actions/actionProperties.tsx:2057-2131`) | straight, elbow, arc, a derived route over the stored ends (`canvas/property-options.ts:106`, `canvas/arrows.ts:23`) | **Better in Bava**: switching loses nothing | n/a | No |
| Dragging a bound arrow's body | unbinds the ends whose shapes are not also moving, after `DRAGGING_THRESHOLD` (`element/src/dragElements.ts:130-158`); a bound elbow does not move (`:46-52`) | moves x, y (`canvas/pointer.ts:533-545`) then `reroute` puts attached ends back (`canvas/binding.ts:199-215`) | **Adopt** unbind on body drag | S | Yes (drops keys) |

### Top picks
1. Side-aware elbow heading plus padded start and end boxes: fixes elbows that hug or cross their shapes (S to M).
2. Hide the line behind an arrow label, and give the wrap a minimum width (S).
3. Arrowhead fixes: shrink on short arrows, background fill for outline heads, size by kind and stroke width (S).
4. Unbind an arrow when its body is dragged, so the drag does something (S).
5. Midpoint handle that inserts a bend point, the entry to multi-point arrows (M, changes the file).
6. A stored label position the user can slide along the path (M, changes the file).

### Bugs or weaknesses spotted in Bava
- **Dashed arrows export dashed heads** (Excalidraw keeps heads solid, `element/src/shape.ts:326-343`). `heads()` passes `paintAttributes(paint, …)`, which adds `stroke-dasharray` (`canvas/export/svg.ts:58-63,175-180`); the stage's head nodes set no dash (`canvas/stage.ts:760-775`). Canvas and export disagree.
- **Elbow ignores the side it leaves from** (from the code, not checked at the window). The anchor comes from the centre ray (`canvas/binding.ts:143-166`), the first leg's axis from the end-to-end delta (`canvas/arrows.ts:29`). A wide shape whose anchor lands on its bottom edge can still start horizontally, running along that edge 4 units clear.
- **A doubly attached arrow cannot be dragged**: the move is undone by `reroute` in the preview and on release (`canvas/pointer.ts:334-340`, `canvas/binding.ts:199-215`), with no feedback.
- **Imported multi-point arrows re-aim badly**: only the first and last points move, each aimed at the far shape's centre rather than its neighbour (`canvas/binding.ts:143-166`), so the end legs go diagonal and can cross their own shape after a move; their `arrowType` is ignored (`canvas/arrows.ts:24`).
- **`edges: round` on a line does nothing** for a two-point line, the only kind the canvas draws (`canvas/curves.ts:23`, `canvas/style.ts:112`), yet the control is offered.
- **Head size ignores stroke width**: at `strokeWidth` 4 a 10-unit head reads as a stub (`canvas/stage.ts:750-752`).

## 4. Tools other than select and arrows

Excalidraw's tools are finished around the gesture: per-tool cursors, smoothed pressure-aware pen strokes, a fading eraser trail, tool keys ignored mid-gesture, selection cleared on tool switch, and a tool lock (Q). Bava sets no canvas cursor at all, draws the pen as an unsmoothed constant-width polyline (the `perfect-freehand` code in `stroke.ts` is dead), shows a static eraser trail, and erases area shapes by their box. Excalidraw also has more ways into text: double-click on empty canvas, the text tool on a shape, pasted plain text, and fixed-width wrapping text. Font size presets already match.

| Feature / behaviour | Excalidraw (value, file:line) | Bava (file:line or "none") | Verdict | Size | On disk? |
|---|---|---|---|---|---|
| Tool cursors | crosshair for drawing tools, grab for hand, `""` for select, custom laser and eraser images; memoized per tool/theme (`components/App.cursor.ts:98-158`) | none: no `cursor` rule in `canvas/`, `App.svelte` or `styles/` | **Adopt** (crosshair, text, grab/grabbing, eraser ring) | S | No |
| Eraser cursor | 20 px canvas-drawn circle, radius 5, colours follow the theme, hotspot at the centre (`App.cursor.ts:210-237`) | none | **Adapt**: an SVG ring drawn from tokens, sized to `--size-eraser-trail` | S | No |
| Grabbing while panning | `GRABBING` during a pan, `GRAB` while Space is held (`components/App.pan.ts:131,145`; `App.tsx` Space handler) | Space and the middle button pan with no cursor change (`App.svelte:792-806`) | **Adopt** | S | No |
| Pen outline | `perfect-freehand`, size = strokeWidth × 4.25, thinning 0.6, smoothing 0.5, easeOutSine, `last: true` (`element/src/shape.ts:1200-1244`) | `Konva.Line` polyline with round caps (`canvas/stage.ts:587-588`), width `--size-pen-stroke` 2.25px (`styles/tokens/_space.scss:30`); `strokeOutline` (`canvas/stroke.ts:69-76`) is called only by tests | **Adapt**: draw through `strokeOutline`, with size taken from strokeWidth, in both the stage and the SVG exporter | M | No |
| Stroke smoothing | streamline 0.5 for a mouse, 0.2 for a pen or touch (`common/src/constants.ts:619-620`, `App.tsx:9962-9966`) | tension 0 for strokes (`canvas/paint.ts:92`; only `line` gets tension at `:124`), so the simplified points draw as visible corners | **Adopt** (the outline above brings it, or apply `smoothPoints` to strokes) | S | No |
| Real pressure | `event.pressure === 0.5` means simulated (`App.tsx:9944`); real pressures are stored per point (`:9973`, `:11223-11225`) | none | **Adapt** later, for tablet users: an optional `pressures` array | M | Yes |
| Point simplification | none: every raw point is kept; exact duplicates are dropped (`App.tsx:11213-11222`) | RDP at 2 **scene** units (`canvas/pointer.ts:512`), not divided by zoom | **Better in Bava** (smaller files), but **Adapt** the tolerance to `2 / zoom` so strokes drawn zoomed in keep their detail | S | Yes (point counts) |
| Pen's eraser end | `POINTER_BUTTON.ERASER` (5) switches to the eraser for one gesture, then restores the last tool (`App.tsx:8742-8790`) | none | **Adopt** | S | No |
| Eraser trail | decays over 200 ms and 10 points, 5 px / zoom, 20% black or white, streamline 0.2 (`eraser/index.ts:44-67`, `animatedTrail.ts:204-221`) | static 6 px line held for the whole drag (`canvas/stage.ts:437-462`, `_space.scss:45`) | **Adopt** the decay; the `@excalidraw/laser-pointer` package is MIT, or fade it in plain code | S | No |
| Eraser hit on areas | outline intersection, plus "inside" only if filled or text (`eraser/index.ts:227-232,289-303`; `element/src/collision.ts:85-105`) | any trail crossing the **box** (`canvas/eraser.ts:62-71`): an ellipse's or diamond's empty corners erase it, and so does a swipe through an unfilled rectangle's middle | **Adapt**: test the drawn outline, and the inside only when filled | M | No |
| Eraser click | erases **every** element at the point (`App.tsx:12195-12218`) | topmost only (`canvas/eraser.ts:89-92`) | **Better in Bava** | n/a | No |
| Toggle tools | E and H toggle back to the previous tool, and so does Esc (`components/Tools.tsx:70-73,129-133`, `App.tsx:6183-6203`) | E only activates; Esc goes to Select (`tools.svelte.ts:77-80`) | **Adapt**: pressing E again returns to the previous tool | S | No |
| Tool lock | Q, or the toolbar lock; unlocking returns to select (`App.tsx:5165-5192,5776-5777`) | none | **Adopt** (key free: Q is unused) | S | No |
| Tool keys mid-gesture | ignored while drawing, marqueeing or dragging (`App.tsx:5716-5721`) | no guard (`canvas/keymap.ts:78-83`); `pointer.up` reads `tools.active` at release (`pointer.ts:355`) | **Adopt** | S | No |
| Tool switch clears selection | any non-select tool clears selection and group editing (`App.tsx:6256-6265`) | selection stays (`tools.svelte.ts:73-75`) | **Adopt** | S | No |
| Re-press A cycles arrow type | sharp → round → elbow (`App.tsx:5741-5750`) | none | **Adapt** (Bava has arrow types) | S | No |
| Nudge step | 1, Shift 5 (`common/src/constants.ts:28-29`, `App.tsx:5838-5845`) | 1 always (`keymap.ts:60-71`) | **Adopt** Shift+arrow = 5 (not a menu shortcut, so no clash) | S | No |
| Double-click empty canvas | creates text there (`App.tsx:7385-7418`) | nothing: `editableAt` finds no element (`App.svelte:880-885`) | **Adopt** | S | Yes (new element) |
| Text tool on a shape | types the shape's label if the click is within 30 units of its centre (`TEXT_TO_CENTER_SNAP_THRESHOLD`, `constants.ts:30`; `App.tsx:9889-9909`, `:13834-13866`); Alt forces free text | always free text over the shape (`App.svelte:500-512`) | **Adapt**: a click inside a shape edits its label; Alt for free text | S | No |
| Where free text lands | the first line is centred vertically on the click (`App.tsx:7056-7060`) | the click is the top-left corner (`label-editor.ts:97-102`) | **Adopt** | S | Yes (y) |
| Fixed-width, wrapping text | `autoResize: false` after a horizontal resize; the handle 12 px gap, 16 px long, hitbox 10×18, all / zoom, hidden below 80% of the box height, restores auto width (`textAutoResizeHandle.ts:13-65`) | text is auto-width only: resizing moves it without resizing (`canvas/resize.ts:98-101`); `commitText` resets `w` to the measured width (`label-editor.ts:58-63`) | **Adapt** when wanted: a stored wrap width, then this handle | M | Yes |
| Font size presets | 16/20/28/36 (`constants.ts:119-124`) | 16/20/28/36 (`canvas/property-options.ts:78-85`) | Already equal | n/a | No |
| Paste plain text | one text element per line, 10 unit gap, wrapped above max(min(½ view, 800), 200), centred at the pointer; Cmd+Shift+V pastes as one element (`App.tsx:5013-5129`) | the canvas pastes only its internal clipboard (`canvas/commands.ts:177-182`); system text is ignored | **Adapt**: one text element at the pointer; splitting lines is optional | S | Yes |
| Laser pointer | K; red trail (`DEFAULT_LASER_COLOR`, `constants.ts:32`), decays over 1000 ms and 50 points, streamline 0.4, SVG overlay redrawn per frame (`laserTrails.ts:17-43`, `animatedTrail.ts:157-202`) | none | **Adapt** for presenting on a screen share; collaborator trails Ignore | S-M | No |
| Frame tool adopts contents | a new frame takes elements wholly inside it, and partial groups are left out (`App.tsx:11954-11967`, `element/src/frame.ts:380-393`) | membership is recomputed only for elements that moved (`containment.ts:48-58`, `history.ts:76`), so a new frame drawn around shapes probably adopts none (read from code, not run) | **Adopt** | S | Yes (`frame` keys) |
| Image tool | file picker, then placed at the view centre, height ≤ half the view (`App.tsx:12795-12850`); double-click crops (`:7340-7342`) | no `image` element (`canvas/scene.ts`) | **Adapt** later: an image file beside the Markdown, referenced by path, never a data URL | L | Yes |

### Top picks
1. Tool cursors: crosshair, text, grab/grabbing, eraser ring (S). Right now every tool shows the plain arrow.
2. Draw the pen through `perfect-freehand` with smoothing (S-M). The code is already there in `stroke.ts:69-76` and never called.
3. Guard tool keys during a gesture, and clear the selection on tool switch (S).
4. Eraser: a fading trail, and hits by outline rather than by box (S + M).
5. Text entry points: double-click empty canvas, the text tool on a shape edits its label, pasted text becomes a text element (S each).
6. Tool lock on Q, with E pressed again returning to the previous tool (S).

### Bugs or weaknesses spotted in Bava
- `canvas/stroke.ts:4-7` says the freehand outline is what gets drawn; `strokeOutline` has no non-test caller, and strokes are drawn as `Konva.Line` with tension 0 (`canvas/stage.ts:587-588`, `canvas/paint.ts:92`), so the simplified points show as corners.
- `editSelection` (`App.svelte:514-521`) tests `editableAt` at the element's stored top-left corner: a rotated element rotates that point out of its box, and an arrow's path rarely passes it, so Enter probably does nothing for either (read, not run).
- Tool letters switch tools mid-drag (`canvas/keymap.ts:78-83`) and the release runs under the new tool (`canvas/pointer.ts:355`): pressing E while drawing a rectangle probably drops it (read, not run).
- The eraser erases unfilled and non-rectangular shapes from empty space inside their box (`canvas/eraser.ts:62-71`).
- A frame drawn around existing shapes does not claim them (`canvas/containment.ts:48-58`).

## 5. Data and history

Excalidraw's strength here is that everything leaving or entering the canvas goes through the system clipboard or a file as scene JSON, so its data can go between apps and back into the editor: copied shapes are JSON on the clipboard as plain text too, pasted text becomes text, pasted SVG or images become images, pasted Mermaid becomes shapes, pasted spreadsheet data becomes a chart, and an exported PNG or SVG can carry the whole scene and be reopened. Bava's clipboard is in-memory only, so nothing reaches another app and nothing from another app reaches the canvas. Excalidraw's history also records selection, so undo puts back what was selected and redo survives a click. Its restore path works per element: one bad element is dropped, duplicate ids are renumbered, and the rest opens. Bava is ahead on format durability (unknown types and keys kept, dangling bindings kept, theme-true dark export), but one malformed element refuses the whole canvas, and duplicate ids are not guarded against.

| Feature / behaviour | Excalidraw (value, file:line) | Bava (file:line or "none") | Verdict | Size | On disk? |
|---|---|---|---|---|---|
| Selection is part of history | `selectedElementIds`, `editingGroupId`, `selectedLinearElement` and more are observed state (`packages/element/src/store.ts:1006-1022`), so undo restores the selection | not recorded; undo only prunes gone ids (`frontend/src/App.svelte:355-356`), so undoing a delete brings shapes back unselected | **Adapt**: store selection before and after on each `Step` | S | No |
| Selection-only steps do not clear redo | redo cleared only when elements changed (`packages/excalidraw/history.ts:127-132`); undo loops past entries with no visible change (`:178-219`) | selection never enters history, so redo already survives a click | Better in Bava (simpler); keep it so if selection is added above | n/a | No |
| Drag coalescing | ephemeral updates, one capture on pointer up (`packages/element/src/store.ts:40-68`) | preview outside history, one `mutate` on release (`frontend/src/canvas/pointer.ts:329-341,408-410`) | Ignore: already equal | n/a | No |
| Arrow-key nudge | keydown mutates without `scheduleCapture` (`packages/excalidraw/components/App.tsx:5859-5874`), so a run of nudges folds into the next captured step (read from code, not tested); 1 unit, 5 with Shift (`packages/common/src/constants.ts:28-29`) | one undo step per keydown including key repeat (`frontend/src/App.svelte:965-977`); 1 unit, Shift ignored (`frontend/src/canvas/keymap.ts:60-71`) | **Adapt**: coalesce a held key into one step; Shift steps 5 | S | No |
| Unknown element types | dropped on restore (`packages/excalidraw/data/restore.ts:747-751`) | kept verbatim (`internal/format/file.go:15-32`) | Better in Bava | n/a | n/a |
| One bad element | caught per element, dropped, rest restored (`packages/excalidraw/data/restore.ts:973-985`) | a type error anywhere (for example `"x": "10"` or `"z": 1.5`) fails the whole block (`internal/format/read.go:59-63`, `Z int` at `internal/format/file.go:29`), and the file refuses to open (`frontend/src/files/document.svelte.ts:110-114`) | **Adapt**: keep an element that will not parse as an unknown, verbatim, and open the rest | S | No |
| Duplicate ids | renumbered on restore (`packages/excalidraw/data/restore.ts:1000-1003`) | none; see Bugs | **Adapt**: renumber on load, and say so | S | Yes (ids change on next save) |
| Dangling references | bindings and `frameId` to missing elements nulled (`packages/excalidraw/data/restore.ts:876-887,1044-1060`) | kept, marked detached (`docs/file-format.md`, "A binding whose target is gone") | Better in Bava, deliberately | n/a | n/a |
| Oversized lines | lines or arrows over 75,000 px wide or high deleted on load, since a dashed one freezes rendering (`packages/excalidraw/data/restore.ts:126-157`) | none; whether a huge dashed Konva line freezes is not verified | **Adapt** only if a test shows the freeze | S | No |
| Scene embedded in PNG/SVG export | PNG `tEXt` chunk keyed `application/vnd.excalidraw+json`, compressed (`packages/excalidraw/data/image.ts:25-47`); SVG `<metadata>` with base64 payload between comments (`packages/excalidraw/scene/export.ts:510-529`); off by default (`packages/excalidraw/appState.ts:71`); dropping the image reopens it (`packages/excalidraw/data/blob.ts:32-70`) | none | **Adapt**: embed the `bava-canvas` JSON, opt-in; "open" or drop reads it back | M | No (export files only) |
| Dark export | CSS-filter colour inversion, `invert(93%) hue-rotate(180deg)` (`packages/common/src/constants.ts:201`) | real theme tokens swapped for the draw (`frontend/src/canvas/export/theme.ts:24-39`) | Better in Bava | n/a | No |
| Export one frame | frame exported cropped, padding 0 (`packages/excalidraw/scene/export.ts:228-235`) | none | **Adapt**: "export this frame" in the frame's menu | S | No |
| SVG font embedding | subset to the glyphs used, harfbuzz in a worker (`packages/excalidraw/subset/`) | full Geist, about 93 KB base64, only when there is text (`frontend/src/canvas/export/fonts.ts:9-10`) | **Adapt** later: subsetting cuts size, but adds a wasm dependency | M | No |
| Copy shapes | JSON written as both a custom type and `text/plain` (`packages/excalidraw/clipboard.ts:195-210`); a child whose frame is not copied loses `frameId` (`:172-190`) | in-memory array (`frontend/src/canvas/commands.ts:47-49,78-83`); system clipboard untouched | **Adapt**: write `{type:"bava/clipboard", elements}` as text through Wails; paste reads it | S | No |
| Paste position | at the cursor on desktop (`packages/excalidraw/components/App.tsx:4704-4708,4861-4878`) | originals plus 16, not cumulative (`frontend/src/canvas/edit.ts:14,61`) | **Adapt**: paste at the cursor; keep +16 only when the cursor is off canvas | S | No |
| Paste text | one text element per line, wrapped at `max(min(half the visible width, 800), 200)` (`packages/excalidraw/components/App.tsx:5046-5048`); Cmd+Shift+V pastes as one element (`:5051`) | none on the canvas (`frontend/src/App.svelte:590-596`) | **Adopt**: text as one text element (simpler than per line) | S | No |
| Paste SVG or image | `<svg…</svg>` text or image files become image elements (`packages/excalidraw/components/App.tsx:4675-4690`) | none; no image element; Wails clipboard is text only (`frontend/src/canvas/export/clipboard.ts:8-14`) | **Adapt** with the image element: files beside the `.md`, referenced by relative path | L | Yes |
| Paste diagram code | Mermaid detected by a first-word regex (`packages/excalidraw/mermaid.ts:1-33`), converted to shapes (`packages/excalidraw/components/App.tsx:4720-4743`) | Insert Diagram dialog only (`frontend/src/canvas/commands.ts:165-174`) | **Adapt**: detect pasted D2 and route it through the same converter; Mermaid itself Ignore (a second diagram language) | S | No |
| Charts from pasted data | TSV, CSV or semicolon; delimiter chosen by consistent column count (`packages/excalidraw/charts/charts.parse.ts:131-151`); bar, line, radar (`packages/excalidraw/charts/index.ts:25-37`) | none | Ignore for now: it produces ordinary shapes, so it can wait | M | No |
| Libraries | `.excalidrawlib` JSON (`packages/excalidraw/data/json.ts:137-159`), deduped by element id and version (`packages/excalidraw/data/library.ts:122-160`), installed from an allowlist of web hosts (`:54`) | none | **Adapt**: a plain JSON library file in a documented place, no web install | M | No (separate file) |
| Copy text of the selection | `copyText` (`packages/excalidraw/actions/actionClipboard.tsx:254-265`) | none | **Adopt** | S | No |

### Top picks
- Put copied shapes on the system clipboard as tagged JSON text and read it back on paste: survives between windows, and fixes the stale in-memory clipboard.
- Paste plain text as a text element, and paste D2 source through the existing converter.
- Paste at the cursor rather than 16 units off the originals.
- Load-time repair: renumber duplicate ids, keep an unparseable element verbatim rather than refusing the file.
- Record selection with each history step, and coalesce a held arrow key into one step.
- Opt-in scene embedding in exported PNG and SVG, so an image can be reopened for editing.

### Bugs or weaknesses spotted in Bava
- **Duplicate ids silently lose an element.** `createScene` keys a `Map` by id (`frontend/src/canvas/scene.ts:162`), and `commands.edit` rebuilds the whole element list from it (`frontend/src/canvas/commands.ts:54-61`). A hand-edited or merged file with two elements sharing an id loses one on the next paste, group, align or distribute, with no message. Load does no check (`frontend/src/App.svelte:391-392`).
- **One bad value blocks the whole canvas.** A string `x` or a fractional `z` fails `json.Unmarshal` (`internal/format/read.go:61`, `internal/format/file.go:29`) and the document does not open. That is safe, but a hand edit, which the format invites, turns into an unopenable file.
- **Repeated paste stacks.** Each paste offsets from the originals, not from the last paste (`frontend/src/canvas/edit.ts:61`), so pressing Cmd+V three times puts three copies in the same place.
- **The canvas clipboard goes stale.** Copying text in another app after copying shapes leaves Cmd+V on the canvas pasting the old shapes (`frontend/src/canvas/commands.ts:49,177-181`).
- **The one-history rule is not met.** The prose pane and the code editor keep their own undo stacks (`frontend/src/App.svelte:636-648`), not the single history that CLAUDE.md describes. This may be intended scoping, but it disagrees with the written rule.

## 6. Interface and navigation

Excalidraw's biggest lead here is getting the user back to their work: zoom to fit, zoom to selection and a "scroll back to content" button that appears only when nothing is visible. Bava has none of these, and never resets the view when a file opens, so a drawing can sit off screen with no way back but manual panning. Second is object snapping with guides, gap (equal spacing) snaps and a grid, all zoom-compensated and switchable from the canvas context menu. Third is discoverability: a fuzzy command palette over every action, a context-aware hint line, and a help dialog that includes canvas gestures. Bava is ahead on dark mode (real per-theme swatch values, not inversion) and on showing mixed values.

| Feature / behaviour | Excalidraw (value, file:line) | Bava (file:line or "none") | Verdict | Size | On disk? |
|---|---|---|---|---|---|
| Zoom to fit all | Shift+1, zoom `min(fitW, fitH, 1)` so small drawings are never enlarged, centred (`excalidraw/actions/actionCanvas.tsx:392-425`, `excalidraw/viewport.ts:267-279`) | none (`canvas/viewport.ts` has zoomAt, panBy only) | **Adopt** | S | No |
| Zoom to selection | Shift+3 "contain", may zoom past 100% (`actionCanvas.tsx:350-390`); Shift+2 capped at 100% (`:307-348`); empty selection falls back to all elements | none | **Adopt** (one command, falls back to all) | S | No |
| Fit respects UI overlays | `canvasOffsets` subtracted from viewport (`viewport.ts:302-313`) | n/a | **Adopt**: subtract rail and toolbar insets | S | No |
| Scroll back to content | button shown when content exists but none is visible, hidden while editing text or animating (`components/App.tsx:4465-4471`, `components/LayerUI.tsx:676-690`) | none | **Adopt** | S | No |
| View on file open | new scene scrolls to content (not verified in detail) | view never reset: `setPan`/`setZoom` never called outside `canvas/viewport.ts` (grep) | **Adopt** fit-on-open | S | No |
| PageUp/PageDown paging | page scroll, Shift for sideways (`components/App.tsx:3275-3282`) | none | **Adopt** | S | No |
| Object snapping | `SNAP_DISTANCE = 8` screen px / zoom (`excalidraw/snapping.ts:41-50`); corners plus centre, ellipse and diamond use edge midpoints (`snapping.ts:198-300`); only visible, unselected elements are candidates (`:315-326`) | none | **Adapt** (Milestone 7): point and centre snaps first | M | No |
| Gap snaps (equal spacing) | `getVisibleGaps`, `getGapSnaps` (`snapping.ts:328,446`) | none | **Adapt** after point snaps | M | No |
| Snap toggle and modifier | off by default (`appState.ts:130`), Alt+S toggles (`actions/actionToggleObjectsSnapMode.tsx:32-33`), Ctrl/Cmd inverts while dragging (`snapping.ts:180-183`); no snapping for a lone arrow, to leave room for binding (`:185-188`) | none; Alt already binds free arrows (`docs/shortcuts.md`) | **Adapt**: on by default, Cmd suspends | S | No |
| Snap guide rendering | 1 px / zoom lines, 2 px crosses, red `#ff6b6b` light, `#ff9090` dark (`renderer/renderSnaps.ts:8-14,34`) | none | **Adapt** with a token | S | No |
| Grid | 20 unit cells, bold line every 5 (`common/src/constants.ts:290-291`), minor lines skipped below 10 screen px (`renderer/staticScene.ts:120-125`), Ctrl+' toggles (`actions/actionToggleGridMode.tsx:33`) | none drawn; `--color-canvas-dot` defined but unused (`styles/tokens/_color.scss:153,211`) | **Adapt**: a dot grid from that token, same fade rule | S | No |
| Grid snapping | round to cell (`common/src/points.ts:69-81`); size saved in the file (`appState.ts:221-223`) | none | **Adapt**; keep on/off per viewer | M | Only if size is per file |
| Arrow-key nudge | 1 unit, Shift 5, or one grid cell with grid on (`components/App.tsx:5838-5844`, `common/src/constants.ts:28-29`) | 1 unit, Shift ignored (`canvas/keymap.ts` ArrowLeft etc.) | **Adopt** Shift = 10 (or 5) | S | No |
| Properties panel scope | shows controls for the active tool too, so style is set before drawing (`components/shapeActionPredicates.ts`, "forToolOrSelection") | only for a selection (`canvas/toolbar.ts:52-69`, `App.svelte:1167`) | **Adapt**: remember last-used style per tool | M | No |
| Mixed values | common value, else the default (`actions/actionProperties.tsx:259-263`) | explicit "mixed" (`canvas/style.ts:54`, `components/StyleBar.svelte:17,69`) | **Better in Bava** | n/a | No |
| Canvas context menu | paste, copy as PNG/SVG, select all, unlock all, then toggles: grid, snap, arrow binding, zen, view, stats (`components/App.tsx:13752-13769`) | paste, select all, unlock all (`canvas/context-menu.ts:71-73`) | **Adapt**: add grid and snap toggles once they exist | S | No |
| Frame actions in menu | select all in frame, remove from frame, wrap selection in frame (`App.tsx:13798-13800`) | none | **Adopt** "wrap in frame" | S | No |
| Command palette | Cmd+Shift+P or Cmd+/ (`components/CommandPalette/CommandPalette.tsx:141-146`), fuzzy match with accent folding (`:2,31`), keywords per action, last used first (`:85,708-718`), unavailable commands filtered by predicate (`:680-687`) | none; `/` insert panel searches tools only | **Adapt**: build from `internal/app/menu/spec.json`, bind Cmd+Shift+P | M | No |
| Help dialog | hand-written, includes gestures and canvas keys (`components/HelpDialog.tsx:147-342`) | generated from the menu spec (`shell/shortcuts.ts:58-79`), so Tab, arrows, Enter, Space, `/` and all gestures in `docs/shortcuts.md` are missing | **Adapt**: add a canvas-keys group from data | S | No |
| Hint line | one context hint: per tool, while resizing, rotating, editing text, dragging with grid (`components/HintViewer.tsx:48-260`) | none on canvas; only no-file hints (`App.svelte:276-279`) | **Adapt**: short hints for Arrow, Line, Draw, Text, and during resize/rotate modifiers | S | No |
| Stats panel | Alt+/ (`actions/actionToggleStats.tsx:26-27`); scene size and count; editable x, y, w, h, angle, font size, multi-select variants; drag to scrub, Shift steps by 10 (`components/Stats/utils.ts:43-44`, `DragInput.tsx:294`) | status bar shows engine and D2 node count only (`components/StatusBar.svelte:22-33`) | **Adapt**: numeric x/y/w/h/angle for the selection | M | No |
| Zen and view (read-only) modes | Alt+Z, Alt+R (`actions/actionToggleZenMode.tsx:34-35`, `actions/actionToggleViewMode.tsx:34-35`); no minimap anywhere (grep) | Canvas view mode and pane toggles; no minimap | Ignore: already close, or a sharing use | n/a | No |
| Search in canvas | Cmd+F, 350 ms debounce, text and frame names, n/total, zoom to match if off screen or under 14 px on screen (`components/SearchMenu.tsx:60,195-252,388-390`) | none; Find is Milestone 15 (`docs/shortcuts.md`) | **Adapt** at Milestone 15; the legibility zoom rule is worth keeping | M | No |
| Welcome screen | shown while the scene is empty (`components/App.tsx:4322-4323`), hints to menu, toolbar, help | no-file hints only; an open but empty canvas shows nothing | **Adapt**: a faint empty-canvas hint (`/` to insert, `⌘/` for keys) | S | No |
| Dark mode | per-colour `invert(93%) hue-rotate(180deg)` (`common/src/constants.ts:201`, `common/src/colors.ts:86`) | named swatches with light and dark tokens; literal colours lifted for contrast (`canvas/palette.ts:1-31,84`); restyle on theme change (`App.svelte:1102-1105`) | **Better in Bava** | n/a | No |
| i18n | 59 locale JSON files, lazy import, English fallback, `{{var}}` interpolation, RTL `dir`, locales under 85% hidden (`excalidraw/i18n.ts:9,71,94-104,127-142`) | one typed English map, key type is the guard (`i18n/t.ts:9-11`); but menu labels come from `spec.json` (`canvas/context-menu.ts:59`, `shell/shortcuts.ts:68`) | **Adapt** only the gap: route menu labels through `t()` keys; no interpolation until needed | S | No |

### Top picks

1. Zoom to fit and zoom to selection (Shift+1, Shift+2), fitting inside the rail and toolbar, and fit on file open: S, fixes "where did my drawing go".
2. Scroll-back-to-content button when nothing is visible: S.
3. Object snapping with guides (8 screen px / zoom, corners and centres, visible unselected candidates, Cmd suspends): M, the Milestone 7 core.
4. Dot grid from the existing unused `--color-canvas-dot` token, minor dots faded below 10 screen px: S.
5. Canvas keys and gestures in the shortcuts dialog, generated from data: S.
6. Command palette built from the menu spec: M, near-free given every command already has an id, label and key.

### Bugs or weaknesses spotted in Bava

- The AI pane's placeholder reads "Nothing on the canvas" (`shell/Shell.svelte:149` uses `empty.canvas.title`).
- `empty.canvas.body` still says "Drawing tools arrive in a later milestone." (`i18n/messages.ts:24`); stale if ever shown.
- Pan and zoom are never reset or restored per file (`App.svelte:88`; no caller of `viewport.setPan`/`setZoom`), so opening a second file inherits the first file's view.
- Help ▸ Keyboard Shortcuts omits every canvas-only key because `shortcutGroups` walks only the menu spec (`shell/shortcuts.ts:58-79`), contradicting the promise in `docs/shortcuts.md` that the dialog lists everything.
- Menu and context-menu labels bypass `t()` (they come straight from `spec.json`), so the "no inline user-facing string" rule in `i18n/messages.ts:1-8` has a hole.
- Shift+arrow nudges one unit, same as plain arrow (`canvas/keymap.ts`), so moving far by keyboard is tedious.

## 7. Performance and architecture

Excalidraw spreads the work over three canvases: a static one that repaints only when the scene nonce or the viewport changes, one for the element being drawn, and an interactive one for selection and handles. It draws only elements whose cached bounds meet the viewport, blits a cached bitmap per element, throttles drag handlers to one call per animation frame, and filters every hit test by bounding box first. Bava's stage patches Konva nodes in place, which is the right start, and Konva already waits for the next frame before painting (`batchDraw`). The JavaScript work runs on every pointer event, though, and all of it grows with the scene size. One pointermove during a drag runs an immer `produce` over the whole scene, re-routes every arrow, re-applies every element (re-wrapping text, and creating a new `<canvas>` for each text measurement), recreates arrowhead nodes, and calls `zIndex` once per element, which is O(n²). The scene layer also keeps Konva's hit canvas live, although Bava never uses Konva events. None of this shows at 50 elements. At a few thousand it will feel janky.

| Feature / behaviour | Excalidraw (value, file:line) | Bava (file:line or "none") | Verdict | Size | On disk? |
|---|---|---|---|---|---|
| Split canvases: static scene, the element being drawn, and the interactive layer | Static canvas memoised on `canvasNonce`, scale, elementsMap and visibleElements (`excalidraw/components/canvases/StaticCanvas.tsx:108-134`). The element being drawn is left out of the static map (`excalidraw/scene/Renderer.ts:252-257`) and gets its own canvas (`excalidraw/components/canvases/NewElementCanvas.tsx:27-46`). Selection is drawn by a rAF animation loop (`excalidraw/components/canvases/InteractiveCanvas.tsx:170-174`) | Two Konva layers, scene and overlay (`frontend/src/canvas/stage.ts:112-115`). Every drag preview re-applies every element (`stage.ts:141-154`) | **Adapt**: during a drag, put the moving elements on a third "drag" layer and freeze the rest (Konva `listening(false)` and no re-apply) | M | No |
| One call per frame for pointer-driven work | `throttleRAF` keeps the last arguments and runs once per frame (`common/src/utils.ts:184-224`). Drag handler throttled (`excalidraw/components/App.tsx:10650`, `excalidraw/reactUtils.ts:22-31`). Static render throttling is opt-in only (`reactUtils.ts:34-50`) | None. `onMove` runs preview, render, marquee and candidates synchronously per event (`frontend/src/App.svelte:814-837`). No `requestAnimationFrame` anywhere in `frontend/src`. Only the paint is coalesced, by Konva (`node_modules/konva/lib/Layer.js:274-285`) | **Adopt**: wrap the body of `onMove` (and pan) in a rAF throttle that keeps the latest point | S | No |
| Viewport culling | Only elements whose bounds meet the viewport are drawn (`excalidraw/scene/Renderer.ts:200-240`, `element/src/sizeHelpers.ts:80-115`), memoised on nonce plus viewport (`Renderer.ts:312-364`) | None. Konva has no culling (no viewport test in `konva/lib/Container.js`, `Shape.js` or `Layer.js`), so every node is painted on every pan frame | **Adapt**: on `setViewport` and render, set `visible(false)` on groups whose box is off-screen (cheap with the boxes Bava already stores) | S-M | No |
| Per-element bitmap cache | `elementWithCanvasCache` WeakMap, regenerated on zoom, theme, crop or frame opacity (`element/src/renderElement.ts:682-727`), capped at area 16777216 px and 32767 px per side (`:231-262`). Old bitmaps are kept during a zoom gesture (`shouldCacheIgnoreZoom`, `excalidraw/components/App.wheel.ts:166`, `renderElement.ts:730-752`) | None (no `.cache()` calls) | **Ignore for now**: Konva's `node.cache()` does the same, but Bava's shapes are cheap vector paths, not roughjs. Revisit for freehand strokes and code blocks once a profile shows the need | M | No |
| Scene version and nonce | `triggerUpdate` sets a random `sceneNonce` (`element/src/Scene.ts:303-304`). `mutateElement` changes elements in place and bumps `version` and `versionNonce` (`element/src/mutateElement.ts:142-144`), and clears `ShapeCache` on a size or points change (`:132-140`) | Immutable snapshots from immer. Identity is the version, but `render` never compares it: every element is re-applied (`stage.ts:141-154`) | **Adapt**: skip `#apply` when the element object is identical to the one last drawn (immer preserves identity for untouched elements). Keep a `Map<id, SceneElement>` | S | No |
| Cached bounds | Versioned WeakMap bounds cache (`element/src/bounds.ts:85-145`) | Recomputed on every call, e.g. `drawnPathOf` re-runs routing and smoothing per hit test (`frontend/src/canvas/hit.ts:29-47`) | **Adapt**: WeakMap keyed on the immutable element object, no version needed | S | No |
| Hit-test cost | A linear scan (`excalidraw/components/App.tsx:6748-6772`), but the rotated-bounds prefilter "saves 99%" (`element/src/collision.ts:177-193`), plus a last-result cache (`collision.ts:116-161`). No spatial index: grep found no rbush or quadtree | A linear scan with no bounds prefilter: `elementsAt` (`frontend/src/canvas/pointer.ts:131-139`), `nearElement` (`hit.ts:64-72`), `targetAt` (`binding.ts:178-187`), eraser `touches` for every element on every move (`eraser.ts:62-79,86-88`) | **Adopt** the bounds prefilter. Ignore a spatial index (Excalidraw manages without one; `rbush` is in CLAUDE.md's stack but not in `package.json`) | S | No |
| Drag preview model | Mutates in place and repaints | `produce` plus `reroute` per move (`pointer.ts:336-339`). `reroute` visits every arrow and finds each binding by linear search (`binding.ts:138,199-215`) | **Adapt**: keep immer for commits; for the preview, re-route only arrows bound to moving ids (an id to element Map) | S-M | No |
| Konva hit graph | n/a (own hit tests) | Scene layer listening by default (`stage.ts:112`), so every draw also redraws the hit canvas (`konva/lib/Node.js:2150-2152`), and every pointermove reads a pixel back with `getImageData` (`konva/lib/Stage.js:550-553`, `Layer.js:361`). Bava registers no Konva events | **Adopt**: `new Konva.Layer({ listening: false })` | S | No |
| Text measurement | One shared measuring canvas (`element/src/textMeasurements.ts:121-126`), per-font char-width cache (`:179-192`), wrapped text stored beside `originalText` (`element/src/types.ts:271`), so a render never re-wraps | `canvasLineWidth` creates a new `<canvas>` per call (`frontend/src/canvas/text-measure.ts:54-58`), called per text or label per render (`stage.ts:566,647,664,675`). `wrapLines` measures each word again (`text-layout.ts:22-42`) | **Adopt**: one module-level context, plus a `(font, line) → width` memo | S | No (measured size is already stored) |
| Device pixel ratio | `scale = ownerWindow.devicePixelRatio` on every React render (`excalidraw/components/App.tsx:2668`), applied by `setTransform` then `scale` (`excalidraw/renderer/helpers.ts:92-93`). Grid lines snapped to device pixels (`excalidraw/renderer/staticScene.ts:88-115`) | Konva reads `devicePixelRatio` once at module load (`konva/lib/Global.js:103`, `Canvas.js:31-34`). Bava has no `matchMedia` resolution listener | **Adapt**: on a resolution change, set `Konva.pixelRatio` and resize the layers (moving a window between a Retina and a 1x monitor otherwise likely leaves it blurry; not tested at the window) | S | No |
| Web workers | Font subsetting on export only (`excalidraw/workers.ts:9`, `excalidraw/subset/subset-main.ts:21-34`) | None | **Ignore**: nothing in Bava's hot path belongs in a worker. D2 already runs in Go | n/a | No |
| Large scenes | Culling, caches and throttling together. Not benchmarked here | Unmeasured. `zIndex(index)` per element per render (`stage.ts:165`) splices and re-indexes all children each time (`konva/lib/Node.js:1262-1265`), so O(n²) | **Adopt**: call `zIndex` only when the order changed (compare the id sequence), or re-order `children` once | S | No |

### Top picks
1. Scene layer `listening: false` (`stage.ts:112`): one line, removes a hit-canvas redraw per frame and a `getImageData` per mouse move.
2. rAF-throttle `onMove` and the pan (`App.svelte:814-837`): caps preview, render and reroute at one run per frame.
3. Skip unchanged elements in `render` by object identity, and call `zIndex` only when the order changed (`stage.ts:141-165`): removes the O(n²) pass and most per-frame work.
4. One shared measuring context with a width memo (`text-measure.ts:54-58`): stops creating a canvas per label per frame.
5. Bounds prefilter in `elementsAt`, `targetAt` and eraser `touches`, with a WeakMap cache of `drawnPathOf`.
6. Cull off-screen groups with `visible(false)` on viewport change.

### Bugs or weaknesses spotted in Bava
- `stage.ts:165`: `zIndex(index)` for every element on every render, including every drag frame. In Konva 10.5.0 each call does two `splice`s and `_setChildrenIndices` (`konva/lib/Node.js:1262-1265`), so O(n²) per frame.
- `stage.ts:744-777` and `:711-736`: arrowhead and detached-marker nodes are destroyed and rebuilt for every arrow on every render. `isDetached` (`binding.ts:36-39`) and `missing` (`stage.ts:718`) each scan all elements per arrow: O(arrows × n) per frame.
- `text-measure.ts:55`: `document.createElement('canvas')` on every `canvasLineWidth` call, which `#apply` reaches for every text and label element on every render.
- `stage.ts:168` and `:313`: the selection overlay is torn down and rebuilt on every render and on every viewport change (`:487`), and it filters with `includes` (O(n·k)).
- `pointer.ts:162-164`: the `erasing` getter recomputes `eraseSet` over the whole scene on each access. It is read on every eraser move (`App.svelte:828`).
- `pointer.ts:511-512`: the pen preview re-simplifies the whole stroke on every move, then re-renders the whole scene.
- `history.ts:26-28,85`: two `JSON.stringify` calls on the whole scene per mutation. Fine per gesture, but costly with key-repeat nudges on a large scene.
- Pan (`App.svelte:815-819`) calls `setViewport`, which repaints both layers and rebuilds the selection, once per event and without culling.

## Appendix: first pass

### A1. Gestures and interaction constants

| Topic | Excalidraw | Bava | Verdict |
|---|---|---|---|
| Click vs drag | `DRAGGING_THRESHOLD = 10` screen px, `common/src/constants.ts:25`; divided by zoom in most paths (`element/src/linearElementEditor.ts:1774`) | `DRAG_THRESHOLD = 3` scene units, `canvas/pointer.ts:45`, not divided by zoom | **Adapt**: make it screen px (06.8). Whether 3 should grow toward 10 is a feel question for the window |
| Hit on lines and arrows | about 6.8 screen px (0.85 × `DEFAULT_COLLISION_THRESHOLD` / zoom), `components/App.tsx:6808-6815`, `common/src/constants.ts:274-281` | `--size-hit-tolerance` 4px / zoom (`App.svelte:98`); `LINE_TOLERANCE = 4` in `canvas/label-editor.ts:21` ignores zoom | **Adopt** the zoom fix (06.8); consider raising the token to 7px |
| Hit on filled shapes | same threshold around the outline | `containsPoint`, no slop at the edge (`canvas/pointer.ts:137`) | **Adapt**: some slop outside the outline |
| Resize handle | 8 px mouse, 16 pen, 28 touch, / zoom (`element/src/transformHandles.ts:49-53`); a 4 px / zoom edge band also resizes (`element/src/resizeTest.ts:102-104`) | 8 px handle, hit zone equals the drawn handle (`App.svelte:94`) | **Adapt**: add the edge band |
| Rotate handle gap | 16 / zoom (`element/src/transformHandles.ts:55`) | 16 px / zoom (`App.svelte:100`) | Matches |
| Angle snap | 15° (`common/src/constants.ts:31`) | 15° (`canvas/constrain.ts:12`) | Matches |
| Object snap | `SNAP_DISTANCE = 8` px / zoom (`excalidraw/snapping.ts:41`) | none | Milestone 7 |
| Eraser | scene-unit prefilter, not zoom-compensated (`excalidraw/eraser/index.ts:205`) | 3 screen px each side (`App.svelte:96`) | **Adapt**: 3 px may feel thin; check at the window |
| Zoom range | 0.1 to 30, buttons ±0.1 (`common/src/constants.ts:359-361`) | 0.1 to 8, buttons ×1.2 (`canvas/viewport.ts:11-12`) | Ignore |
| Wheel | zooms on Ctrl/Cmd or a mouse wheel; log acceleration above 100% (`components/App.wheel.ts:80-152`); Shift+wheel pans sideways (`:94-107`) | Ctrl/Cmd zooms, capped ×1.28 per event (`canvas/navigation.ts`); plain wheel pans; no Shift+wheel | **Adopt** Shift+wheel sideways pan |
| Pan | middle button, right button, space+drag, hand tool (`components/App.pan.ts:96-99`) | middle button, space+drag (`App.svelte:805`); right button opens the menu | Ignore: the menu owns the right button |
| Tool after a draw | back to select with the new element selected, unless the tool is locked (`components/App.tsx:11791-11796`); the pen stays on and selects nothing (`actions/actionFinalize.tsx:365`); lock toggled with Q (`components/App.tsx:5165`) | shape tools stay on, nothing selected (`canvas/pointer.ts:408-411`); only text and code return to select (`App.svelte:849,856`) | **Adopt** (06.8); tool lock is a later feature |
| Touch double tap | 300 ms, 35 px (`common/src/constants.ts:353,610`) | native `dblclick` | Ignore: desktop only |

### A2. Arrow binding

**Excalidraw** stores `{elementId, fixedPoint: [rx, ry], mode}` per end
(`element/src/types.ts:320-333`), where `fixedPoint` is a 0 to 1 position in
the shape's upright box, and `mode` is `inside` (end sits on that point) or
`orbit` (end sits on the outline, on the line from that point toward the other
end). A target is chosen by distance to its **outline**, within
`clamp(15 / (1.5 · zoom), 15, 30)` scene units (`element/src/binding.ts:133-143`),
nearest wins, with a rule preferring a small shape nested in a larger one
(`element/src/collision.ts:430-477`). The gap is `5 + strokeWidth / 2`
(`element/src/binding.ts:125-131`). Any endpoint drag highlights its candidate.

**Bava** stores an id per end (`canvas/scene.ts:62-63`). Each end sits where
the ray from the shape's centre toward the other end crosses the outline, plus
a 4 unit gap (`canvas/binding.ts:51-65,143-166`), recomputed on every change
(`canvas/binding.ts:199-215`). A target is the topmost shape whose box strictly
contains the point (`canvas/binding.ts:178-187`): no grab distance, no zoom.

| Aspect | Verdict | On disk? |
|---|---|---|
| Target by outline distance with a zoom-aware radius, nearest wins | **Adopt**: the main "resists rebinding" fix | No |
| Highlight candidates while dragging an existing end, not only while drawing (`canvas/pointer.ts:186`) | **Adopt** | No |
| Gap grows with stroke width | **Adopt** | No |
| A stored attach point per end, so the user chooses where it lands | **Adapt**, if the report asks for it | **Yes**: an optional key beside the id, specified in `docs/file-format.md` first |
| Inside vs orbit mode | Ignore for now | Yes |
| Back-reference list on the shape | Ignore: derived lookup is enough | Yes |
| Deleting a target unbinds the arrow | Ignore: Bava keeps the id and marks it detached, deliberately | n/a |

**Why arrows "anchor to sides and resist rebinding"** (hypothesis, from the
code): where the end is dropped is never kept, since `reroute` replaces it with
the centre-ray crossing at once, so every end snaps to the side facing the
other end. Rebinding needs the pointer strictly inside a box, the grabbed
handle sits 4 units outside the outline, the preview jumps the end to the
anchor while hovering, and dragging an existing end shows no highlight.

### A3. Text editing overlay

Excalidraw rebuilds the textarea's style from the element on every change
(`excalidraw/wysiwyg/textWysiwyg.tsx`): font and line height from the element
(`:405-412`), colour (`:421-424`), alignment (`:419-420`), opacity (`:425`),
no padding, border or background (`:474-478`), `overflow: hidden` (`:479`),
`pre-wrap` inside a container (`:461-485`), a position computed from vertical
alignment (`:361-382`), and the rendered text hidden while editing
(`excalidraw/renderer/Renderer.ts:261-266`). Ctrl/Cmd+Enter is ignored during
IME composition (`:687-693`).

Bava's textarea (`canvas/label-editor.ts:148-166`,
`styles/canvas-overlays.scss:6-34`) takes the UI font, size, line height,
colour, padding, border and background from the stylesheet, never from the
element, and does not scale its font with zoom. The rendered label stays drawn
under it. `App.svelte:467-472` also measures free text at the default size
whatever its `fontSize`.

Verdict: **adopt** all of the above except live restyling on pan and zoom
(Bava commits on any view change, which is simpler). The styles come from
`paintFor(element).font` and `.opacity`, the one source the stage and exporter
already draw from. Planned as 06.8.
