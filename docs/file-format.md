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

The alternative (`notes.md` plus `notes.canvas`, or the canvas kept in a
hidden folder beside it) keeps the Markdown pristine, and loses the user's
work silently. Rename the file in Finder, copy one file to a USB stick,
`git add notes.md`: the canvas is gone and nothing says so. For an app whose
premise is that these are the user's files, to be used with any tool, that is
not an edge case.

A trailing fenced block cannot be separated from its document by any of those
actions, and every Markdown tool preserves a fenced block whose language it
does not recognise.

This holds with Spaces (below). A Space's `.bava/` folder keeps what belongs
to the Space as a whole (page order, the Trash, and from Milestone 8.4
attachments), never a page's text or canvas. The one thing that can be
separated from a page copied on its own is its attachments: a trade-off
accepted knowingly (`.claude/work/specs/08-documents.md`, decision 10),
never silent (a missing attachment says so), and covered by exporting the
page with its files.

The cost is accepted knowingly: a JSON block at the end of a human document.

## The document

**Status:** specified 2026-09-27 for Milestone 8.2, ahead of the code.

The prose part of a page, everything before the canvas block, is edited as
formatted text and written back as Markdown in one style. A page whose prose
and settings are not changed is saved exactly as it was read. A page written by
hand or by another tool is tidied into that style the first time its prose is
edited and saved: what it shows in any Markdown viewer stays the same, and a
second save changes nothing.

### Front matter
A page may open with a front matter block: lines between two `---` marks,
first thing in the file, holding YAML. Bava keeps its own settings under a
`bava:` key:

```markdown
---
bava:
  locked: true
  width: wide
title: Kept as it is
---
# Launch plan
```

- `locked`: `true` makes the page read-only until someone unlocks it.
  Absent means unlocked.
- `width`: `narrow`, `wide` or `full`, this page's own width. Absent means
  the Space's default, else the user's own app setting.
- Every other line, and every other key under `bava:`, is **kept as it is**,
  in its order; a changed setting is rewritten on its own line. When Bava has
  nothing to write under `bava:` it leaves the key out, and a front matter
  that held only Bava's settings is not written. One written empty stays.
- The block ends at a line that is `---` alone. A page that opens with `---`
  and then an empty line opens with a divider, not front matter.
- Its line endings are written as `\n`.

### Bava's Markdown style
Each block is separated from the next by one blank line; extra blank lines
are not kept.

| Block or mark | Written as |
|---|---|
| Heading 1 to 6 | `#` to `######` and a space |
| Bulleted list | `- ` |
| Numbered list | `1. ` for each item, counting up; from ten items on, the numbers are right-aligned (` 9.`, `10.`) and continuation lines indented to match |
| To-do | `- [ ] ` and `- [x] ` |
| Quote | `> ` on each line |
| Divider | `---` |
| Line break in a block | a trailing `\` |
| A line wrapped by hand inside a paragraph | joined with a space |
| Nested list item | indented under its parent by the parent marker's width |
| Bold, italic | `**bold**`, `*italic*` |
| Strikethrough | `~~strike~~` |
| Inline code | `` `code` `` |
| Link | `[text](url)`; a link written by reference (`[text][ref]`) is written inline, and its definition stays where it was |
| Underline | `<u>text</u>` |
| Text colour | `<span data-color="blue">text</span>` |
| Highlight | `<span data-highlight="yellow">text</span>` |

Colours are the canvas's swatch names, so they follow the theme; an unknown
name is kept and shows uncoloured.

Setext headings (a line underlined with `===` or `---`) are written as `#`
headings, `*` and `+` bullets as `-`, `1)` numbers as `1.`, `_` emphasis as
`*`, and an email in angle brackets as a link to it. Typed text that Markdown
would read as something else is escaped with a backslash: `*`, `_`, `[`, `]`,
`` ` ``, `~`, `\`, a `<` that would start a tag, a `&` that starts an entity, and `$`.
An entity in the file (`&amp;`, `&copy;`, `&nbsp;`) is written as the
character it stands for.

Inline HTML Bava does not know (`<kbd>`, `<sup>`, a comment, a `<u>` never
closed) is kept as it is, in its place in the text. Images, footnote
references and `$…$` equations are kept as written too. A numbered list that starts at another number
keeps its first number.

### Invisible marks
Formatting a block that Markdown has no form for is written as an HTML comment
on the line just before the block. Every Markdown viewer hides it, and the
block itself stays ordinary Markdown.

```markdown
<!-- bava: list=a -->
1. First, shown as a.
2. Second, shown as b.

<!-- bava: color=red background=yellow -->
A paragraph in red on yellow.
```

- `list=a` or `list=i`: a numbered list shown with letters or roman numerals.
- `color=<swatch>` and `background=<swatch>`: a paragraph, heading, list or
  quote in a text colour and on a background.
- A mark with a key Bava does not know is kept, with that key, on the block;
  known keys are written first. `list` on a block that is not a numbered list
  is kept as written.
- A mark with no block after it that can carry one (before a divider or a kept
  block, or at the end) is kept as it is, where it was.

### Blocks kept as they are
A block this version cannot edit is shown in the page, read-only, and written
back **byte for byte**: fenced code blocks (including `d2`), tables, HTML
blocks, footnote definitions, link reference definitions, math blocks, and any
other construct not listed above. It keeps its place among the other blocks.
Inside a list item or a quote, its lines are written under the container's
indent or `>`, with the container's own indent written as spaces. Later milestones make these
editable one by one; until then nothing about them changes.

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

A **literal colour** is what the user picked. In the light theme it is drawn
exactly as stored. In the dark theme it is drawn as Excalidraw's dark mode
draws it: inverted by 93% and its hue turned 180 degrees back, so a pale fill
becomes a deep one of the same hue. The rule works from the value alone, so
the file never records which theme it was picked in and a file written in one
theme reads in the other. A malformed `#` value draws as the
default and is written back unchanged.

### Style properties
Optional on the element types listed, and absent means the default:

| Key | Value | Absent | Elements |
|---|---|---|---|
| `strokeWidth` | 1, 2 or 4 | 2 | shapes, `line`, `arrow`, `stroke`, `frame` |
| `strokeStyle` | `solid`, `dashed`, `dotted` | `solid` | as above |
| `edges` | `sharp`, `round` | `sharp` | `rect`, `diamond`, `hexagon`, `parallelogram` and `line`; the curved outlines have no corners to round |
| `opacity` | 0 to 100 | 100 | every element |
| `fontSize` | 16, 20, 28 or 36; on `code`, 11, 13, 16 or 20 | 20; on `code`, 13 | `text`, `code`, and a shape's, frame's or arrow's label |
| `align` | `left`, `center`, `right` | `center` in a shape, `left` in free text | `text` and labels |
| `verticalAlign` | `top`, `middle`, `bottom` | `middle` | labels |
| `locked` | `true` | not locked | every element |
| `arrowType` | `straight`, `elbow`, `arc` | `straight` | `arrow` |
| `startArrowhead` | an arrowhead name | `none` | `arrow` |
| `endArrowhead` | an arrowhead name | `arrow` | `arrow` |
| `angle` | degrees, 0 to 359, clockwise about the element's centre | 0 | every element except an elbow arrow |
| `startBinding` | the `id` of the element this end is attached to | not attached | `arrow` |
| `endBinding` | as above, for the other end | not attached | `arrow` |
| `startAnchor` | `[fx, fy]`, each 0 to 1: the spot on the attached element's upright box the start aims through | the element's centre | `arrow`, with `startBinding` |
| `endAnchor` | as above, for the other end | the element's centre | `arrow`, with `endBinding` |
| `startMode` | `inside`: the start is pinned at its anchor, inside the element | on the element's edge | `arrow`, with `startBinding` |
| `endMode` | as above, for the other end | on the element's edge | `arrow`, with `endBinding` |
| `fixedSegments` | a list of `{ "index": n, "start": [x, y], "end": [x, y] }`: the middle segments of an elbow the user dragged, in the arrow's own coordinates | fully routed | `arrow` with `arrowType: "elbow"` |
| `closed` | `true`: the line is a loop, its last point on its first, and stays one when either is moved or deleted | open | `line` |
| `labelDirection` | `along`: the label lies along the arrow at its place, turned to stay readable | upright | `arrow` with a `label` |
| `labelPosition` | 0 to 1: where the label sits, as a share of the drawn path's length | the middle point: the middle one of an odd number of points, else the middle of the middle segment (before 06.16, half the length) | `arrow` with a `label` |
| `frame` | the `id` of the `frame` that owns this element | not in a frame | every element |
| `language` | the language a code block is highlighted as | plain text | `code` |

Arrowhead names: `none`, `arrow`, `bar`, `triangle`, `triangle-outline`,
`circle`, `circle-outline`, `diamond`, `diamond-outline`, and the
entity-relation (crow's foot) heads `one`, `many`, `oneOrMany`, `exactlyOne`,
`zeroOrOne`, `zeroOrMany`.

Numbers rather than names for `strokeWidth` and `fontSize`, so a custom value
later needs no new vocabulary. Every value above follows the rule this format
already has: **an unknown value draws as the default and is written back
unchanged.**

A locked element draws and exports normally; locking is about editing, not
appearance.

### Lines, arrows and strokes
`line`, `arrow` and `stroke` carry `points`: a flat list `[x1, y1, x2, y2,
...]` relative to the element's `x, y`. `line` and `arrow` have two points
when drawn and one more for each bend the user adds; `stroke` has as many as
the pen recorded. They take `stroke`. Only a closed `line` (`closed: true`)
takes `fill`, drawn while it is closed; opening it removes the fill. On a
closed line an absent `fill` means none, not the theme's shape fill.

**A new line or arrow is written with its kind.** Bava draws new arrows
curved (`arrowType: "arc"`) and new lines round (`edges: "round"`), as
Excalidraw does, and writes the key into each new element: an absent key
still means straight and sharp, so older files draw as they always have.

**The kind decides how bends are drawn.** A straight arrow or a line runs
through its points with sharp corners. An arc curves smoothly through them;
with no bends it is straight, as Excalidraw's (it bowed once before 06.15, so
an older two-point arc now draws straight). An elbow's `points` are its
route: right-angled, leaving each attached shape from the side its end is on
and going around both shapes, recomputed whenever either moves. Switching an
arrow to elbow replaces its bends with the route; switching away keeps only
its two ends. A middle segment the user dragged is kept where it was put
(`fixedSegments`): moving a shape or an end adapts only the legs to the ends,
and releasing the segment hands it back to the router. Each entry's `start`
and `end` are rewritten from `points` on every change; an entry whose index
is the first or last segment, or out of range, is dropped. Switching kind
drops `fixedSegments`. An elbow written before this rule is routed when the
file is opened: one with only its two ends gains its route, and one that kept bends
from being switched (06.10 and 06.11 kept them) has those replaced by its
route, which the next save writes.

### Attachment and containment
An `arrow` may carry `startBinding` and `endBinding`: the `id` of the element
that end is attached to, and `startAnchor` and `endAnchor`: where on that
element the end aims through, as fractions of its upright box (`[0.5, 0.5]` is
the centre, `[0, 0.5]` the middle of its left side), turned with it when it
rotates. A bound end is drawn where the line from its anchor towards its
neighbour (the next bend, or else the other end) leaves the target's outline,
a fixed gap clear of it, so moving either end or the target re-aims the arrow.
No anchor means the centre. An end whose mode is `inside` does not stop at
the outline: it sits at its anchor itself, inside the element, and moves with
it; the other end aims at it. An elbow end is never inside. An elbow does not aim: its end stays on the side
its anchor is on, where the anchor meets the outline, a gap clear, and its
route goes around. A bent attached arrow written before bends existed (one
inserted from D2, for instance) re-aims each end at its nearest bend, not
across the arrow, the first time it is drawn by a Bava that has them. An
anchor without its binding means nothing and is kept as written. The stored
`points` are still written: they are what the arrow falls back to when a
binding cannot be resolved.

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

An `arrow` may also carry a `label`, drawn at the middle of the path it takes,
or at `labelPosition` along it.

### Code blocks
A `code` element carries `code` (the text as typed, with its own line breaks),
`language` (the name of the language it is highlighted as, absent for plain
text) and the `measuredWidth`/`measuredHeight` every text-bearing element
stores.

**Its width and height are the user's, but never smaller than its code.** The
block is as wide as the user makes it (a new one starts 20 columns wide), and
each line that does not fit wraps onto the next, at its last space or, for a
word too long, at the edge. Its height is what the user makes it, but never
less than the wrapped code needs: an edit that needs more grows it, so nothing
it holds is ever hidden. A block written before this rule was
sized to fit its longest line, so it draws unchanged. All of this is measured
at the block's `fontSize` (13 when absent): the 20 columns, the wrapping, and
`measuredWidth`/`measuredHeight`; a new size re-wraps the code to the width
and grows the height when the code needs it.

**A block with a known `language` names it on its top edge,** near the left,
the border hidden behind the name. Plain text, or a language this build does
not know, shows no name.

**An unknown `language` is kept and drawn as plain text.** A file written by a
later Bava, or by hand, names a language this build may not bundle: losing the
name would silently change what the file says. The same applies to a language
that was removed.

### Text, frames and groups
- `text` carries `text`, `measuredWidth` and `measuredHeight`, and may take
  `color`.
- `frame` may carry a `label`, and takes `stroke` and `color`.
- `group` carries `children`, a list of element ids.

## Spaces

**Status:** built (`internal/space`).

A **Space** is a folder the user opens as the home of their pages. It holds
folders and pages (`.md` files) and one hidden folder, `.bava/`, which Bava
creates the first time the folder is opened as a Space. Pages are ordinary
Bava files: nothing in a page changes when it is in a Space.

```
My Space/
  Marketing/
    Launch plan.md
  Roadmap.md
  .bava/
    space.json
    trash/
```

### `.bava/space.json`

What is part of the work and belongs to the Space as a whole. It travels with
the folder, so a teammate who opens the same folder sees the same order.

```json
{
  "version": 1,
  "order": {
    "": ["Marketing", "Roadmap.md"],
    "Marketing": ["Launch plan.md"]
  },
  "pageWidth": "wide"
}
```

- `version`: 1. A newer number is read as far as it is understood.
- `order`: for each folder, keyed by its path relative to the Space (`""` is
  the top, `/` separates folders), the names of its pages and folders in the
  order the user arranged them. A name not listed is shown after the listed
  ones, by name; a listed name that no longer exists is left out, and dropped
  from the file on the next write. Absent means every folder is by name.
- `pageWidth`: `narrow`, `wide` or `full`, the Space's default for its pages.
  Absent means the user's own app setting (arriving with the document
  editor; until then, absent changes nothing).
- **Unknown keys are kept** through every write, as elsewhere.
- Written whole and atomically, like a page.

Per-viewer conveniences (which folders are open, the last page opened) are
not in it: they live in `localStorage`, as below.

### `.bava/trash/`

A page or folder moved to the Trash goes, whole and unchanged, into
`.bava/trash/<id>/`, beside an `item.json`:

```json
{ "path": "Marketing/Launch plan.md", "kind": "page", "deletedAt": "2026-09-27T10:12:00Z" }
```

- `path`: where it came from, relative to the Space; `kind`: `page` or
  `folder`; `deletedAt`: RFC 3339.
- `<id>` is opaque and unique within the Trash.
- The order kept for a trashed folder's contents is not kept with it: a
  restored folder comes back at the end of its parent, its contents by name.
- Items stay until the user deletes them from the Trash or empties it;
  nothing is removed by age. Restoring moves the item back to `path`,
  recreating missing folders; if the name is taken it comes back numbered
  (`Launch plan 2.md`).
- A folder holding a `.bava/` of its own is not a Space inside a Space: Bava
  treats only the folder opened as the Space.

## What is not in a file

- No cursor position, zoom level, pane widths, or view mode. Those are
  per-viewer conveniences and live in `localStorage`, as do recent Spaces and
  files, a Space's open folders and its last page.
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
