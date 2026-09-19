# File format

What Bava writes to disk, and the rules that keep it readable for longer than
Bava exists.

**Status:** specified 2026-09-17, ahead of the code that writes it. Milestone 5
implements the canvas half; the `diagram` element and the document half are
specified here so that a file written today survives being opened by the
version that adds them.

## The shape

A Bava file is **Markdown**. One file holds a document and a canvas.

```markdown
# Ingest pipeline

Events arrive over HTTP and are written to the queue.

```d2 id=write-path
writer -> queue -> postgres
```

More prose.

```bava-canvas
{
  "version": 1,
  "elements": [
    { "id": "e1", "type": "rect", "x": 40, "y": 24, "w": 160, "h": 90, "z": 1 }
  ]
}
```
```

Three parts, in this order:

1. **Prose**: ordinary Markdown. What every other editor sees first.
2. **Diagram blocks**: fenced `d2`, with an `id` in the info string. Readable
   and reviewable anywhere, and valid D2 that other tools can compile.
3. **The canvas block**: one fenced `bava-canvas` block, last in the file.

### Why one file rather than a sidecar

The alternative (`notes.md` plus `notes.canvas`, or a `.bava/` directory)
keeps the Markdown pristine, and loses the user's work silently. Rename the
file in Finder, copy one file to a USB stick, `git add notes.md`: the canvas is
gone and nothing says so. For an app whose premise is that these are the user's
files, to be used with any tool, that is not an edge case.

A trailing fenced block cannot be separated from its document by any of those
actions, and every Markdown tool preserves a fenced block whose language it
does not recognise.

The cost is accepted knowingly: a JSON block at the end of a human document.

## Rules

### The canvas block is written only when there is a canvas
A file with no canvas elements has no `bava-canvas` block. A document stays a
document.

### It is always last
After all prose and all diagram blocks. A reader scrolling a file in another
editor should reach the end of the writing before they reach the data.

### It is pretty-printed
Minified JSON is one enormous line, and one enormous line makes every git diff
useless. Readability of the *diff* is what matters here, not of the JSON.

### Diagram source stays readable
> **Superseded 2026-09-17** (`.claude/work/specs/diagrams-as-shapes.md`): D2
> now generates a diagram once and it is converted into ordinary shapes, so no
> element references a `d2` block. Milestone 6.6 rewrites this section. Fenced
> `d2` blocks a person writes in prose are still kept as they are.

A `diagram` element's D2 lives in its own fenced `d2` block in the prose, not
escaped into a JSON string. The canvas block references it by the `id` in the
fence info string, and stores only placement:

```json
{ "id": "e7", "type": "diagram", "block": "write-path", "x": 320, "y": 80, "w": 400, "h": 260, "z": 3 }
```

This is what keeps the promise that deleting Bava leaves the diagrams
reviewable in any editor.

### Unknown keys and unknown element types are preserved
A file written by a newer Bava must survive being opened, edited and saved by
an older one. So:

- An element whose `type` is unrecognised is **kept verbatim** and written back
  unchanged. It is not rendered and not editable, but it is not destroyed.
- Unrecognised keys on a recognised element are **kept verbatim** and written
  back.
- `version` records the format generation. An unknown `version` is read on a
  best-effort basis rather than refused; the preservation rules above are what
  make that safe.

This is the rule that cannot be added later. A version that drops what it does
not understand has already destroyed files by the time anyone notices.

### Text carries its measured size
Canvas text elements store `measuredWidth` and `measuredHeight`. WebKitGTK and
WebView2 disagree on glyph advances, so re-measuring on open would reflow a
scene differently on another machine. The stored measurement is authoritative;
it is recomputed only when the text itself changes.

### Bindings reference ids, never coordinates
An arrow bound to a node inside a diagram stores the node's D2 absolute id.
Ids come from source text and survive re-layout; coordinates do not. A binding
whose target no longer exists is kept, marked detached, and never silently
deleted: the user drew it.

### Ids are stable within a file
An element's `id` is unique within its file and does not change once written.
Bindings and diagram-block references depend on it.

## Elements

Every element carries `id`, `type`, `x`, `y`, `w`, `h` and `z`. The types a
canvas holds, and the keys each adds, are below. Specified in Milestone 6,
before any code writes them.

### Shapes
Nine closed shapes, each filling its `x, y, w, h` box:

| `type` | Shape |
|---|---|
| `rect` | rectangle |
| `ellipse` | ellipse |
| `diamond` | diamond, vertices at the box's edge midpoints |
| `cylinder` | cylinder, the database symbol |
| `hexagon` | hexagon, flat top and bottom |
| `parallelogram` | parallelogram, slanted to the right |
| `document` | document, a rectangle with a wavy bottom edge |
| `person` | person, head and shoulders |
| `cloud` | cloud |

`rect` and `ellipse` keep the names Milestone 5 wrote, so files from before
Milestone 6 read unchanged. The shape set is the one D2 and Eraser share; see
`.claude/work/specs/diagrams-as-shapes.md`.

Optional keys on every shape:

| Key | Value | Absent means |
|---|---|---|
| `label` | plain text, drawn centred and wrapped inside the shape's box | no label |
| `fill` | a colour (see Colours) | the theme's default fill |
| `stroke` | a colour | the theme's default border |
| `color` | a colour, for the label | the theme's default text colour |

```json
{ "id": "e4", "type": "cylinder", "x": 40, "y": 24, "w": 120, "h": 90, "z": 2, "label": "Postgres", "fill": "blue", "stroke": "blue", "color": "blue" }
```

**A label is not separately measured.** It wraps inside its shape's box, so a
glyph's difference between WebKitGTK and WebView2 reflows it within the box
without moving anything else. Free text elements are different: see "Text
carries its measured size".

### Colours
A colour is **a swatch name or a literal `#rrggbb`**. A value starting with
`#` is a literal colour; anything else is a swatch name.

Swatches are the palette, and each has a light and a dark value, so a choice
stays readable when the theme changes; the values live in the app, not the
file: `gray`, `blue`, `green`, `yellow`, `orange`, `red`, `purple`, `pink`.

**An unknown swatch name renders as the default and is written back
unchanged**, like any unknown value: a newer Bava may add swatches.

A **literal colour** is what the user picked. It is drawn as stored where it
reads against that theme's canvas, and where it does not, its lightness is
flipped and nudged until it does, keeping its hue. The rule works from the
value alone, so the file never records which theme it was picked in and a file
written in one theme reads in the other. A malformed `#` value draws as the
default and is written back unchanged.

### Style properties
Optional on the element types listed, and absent means the default:

| Key | Value | Absent | Elements |
|---|---|---|---|
| `strokeWidth` | 1, 2 or 4 | 2 | shapes, `line`, `arrow`, `stroke`, `frame` |
| `strokeStyle` | `solid`, `dashed`, `dotted` | `solid` | as above |
| `edges` | `sharp`, `round` | `sharp` | `rect`, `diamond`, `hexagon`, `parallelogram` and `line`; the curved outlines have no corners to round |
| `opacity` | 0 to 100 | 100 | every element |
| `fontSize` | 16, 20, 28 or 36 | 20 | `text`, and a shape's or frame's label |
| `align` | `left`, `center`, `right` | `center` in a shape, `left` in free text | `text` and labels |
| `verticalAlign` | `top`, `middle`, `bottom` | `middle` | labels |
| `locked` | `true` | not locked | every element |
| `arrowType` | `straight`, `elbow`, `arc` | `straight` | `arrow` |
| `startArrowhead` | an arrowhead name | `none` | `arrow` |
| `endArrowhead` | an arrowhead name | `arrow` | `arrow` |
| `angle` | degrees, 0 to 359, clockwise about the element's centre | 0 | every element except an elbow arrow |
| `startBinding` | the `id` of the element this end is attached to | not attached | `arrow` |
| `endBinding` | as above, for the other end | not attached | `arrow` |
| `frame` | the `id` of the `frame` that owns this element | not in a frame | every element |
| `language` | the language a code block is highlighted as | plain text | `code` |

Arrowhead names: `none`, `arrow`, `bar`, `triangle`, `triangle-outline`,
`circle`, `circle-outline`, `diamond`, `diamond-outline`. The entity-relation
heads arrive with connections.

Numbers rather than names for `strokeWidth` and `fontSize`, so a custom value
later needs no new vocabulary. Every value above follows the rule this format
already has: **an unknown value draws as the default and is written back
unchanged.**

A locked element draws and exports normally; locking is about editing, not
appearance.

### Lines, arrows and strokes
`line`, `arrow` and `stroke` carry `points`: a flat list `[x1, y1, x2, y2,
...]` relative to the element's `x, y`. `line` and `arrow` have two points
when drawn; `stroke` has as many as the pen recorded. They take `stroke`, and
never `fill`.

### Attachment and containment
An `arrow` may carry `startBinding` and `endBinding`: the `id` of the element
that end is attached to. A bound end is drawn on the target's outline, on the
line towards its centre, a fixed gap clear of it, so moving either end re-aims
the arrow. The stored `points` are still written: they are what the arrow
falls back to when a binding cannot be resolved.

Any element may carry `frame`: the `id` of the `frame` element that owns it.
Membership lives on the child, so an element can only ever be in one frame and
there is one place to look. Moving a frame moves everything that records it;
deleting a frame keeps its contents and clears their `frame`, because deleting
a container must not delete work the user did not select.

**A binding whose target is gone is kept, never deleted.** The key stays, with
the id it had, the endpoint stays where it last was, and Bava marks that end
detached. Reopening a file whose target has since returned re-aims it. This is
the rule of `canvas-architecture.md`: never silently remove something the user
drew.

An `arrow` may also carry a `label`, drawn at the middle of the path it takes.

### Code blocks
A `code` element carries `code` (the text as typed, with its own line breaks),
`language` (the name of the language it is highlighted as, absent for plain
text) and the `measuredWidth`/`measuredHeight` every text-bearing element
stores.

**Its size comes from its code.** The block is as wide as its longest line and
as tall as its line count, so nothing it holds is ever hidden; it is the one
element with no resize handles.

**An unknown `language` is kept and drawn as plain text.** A file written by a
later Bava, or by hand, names a language this build may not bundle: losing the
name would silently change what the file says. The same applies to a language
that was removed.

### Text, frames and groups
- `text` carries `text`, `measuredWidth` and `measuredHeight`, and may take
  `color`.
- `frame` may carry a `label`, and takes `stroke` and `color`.
- `group` carries `children`, a list of element ids.

## What is not in a file

- No cursor position, zoom level, pane widths, or view mode. Those are
  per-viewer conveniences and live in `localStorage`.
- No chat transcripts. Those are Bava's own state, in the platform data
  directory as append-only JSONL; see `.ai/rules/ai.md`.
- No credentials, ever. Those are in the OS secret store.

## `.d2` files

A standalone `.d2` file is exactly what it looks like: D2 source, nothing else.
Bava opens it and shows the diagram. It has no canvas and no prose, and Bava
writes nothing extra into it; another tool's `.d2` file goes home unchanged.

## Round-trip tests are mandatory

Every change to this document ships with a test that writes, reads and
compares, not a unit test of the writer and another of the reader, because
that is exactly where asymmetries hide. The unknown-key and unknown-element
cases are part of that test, not an afterthought.
