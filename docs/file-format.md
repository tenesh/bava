# File format

What Bava writes to disk: enough to read and edit a Bava file without Bava.

## The shape

A Bava file is **Markdown**, holding a document and a canvas:

````markdown
# Ingest pipeline

Events arrive over HTTP and are written to the queue.

```d2 id=write-path
writer -> queue -> postgres
```

```bava-canvas
{
  "version": 1,
  "elements": [
    { "id": "e1", "type": "rect", "x": 40, "y": 24, "w": 160, "h": 90, "z": 1 }
  ]
}
```
````

1. **Prose**: ordinary Markdown. A fenced `d2` block in it is prose, kept as
   written; a D2 diagram inserts ordinary shapes and keeps no D2.
2. **The canvas block**: one fenced `bava-canvas` block of pretty-printed
   JSON, last in the file after one blank line, written only when the canvas
   has elements.

One file, not a sidecar, so renaming, copying or committing it never separates
the canvas from its document. A page copied out of its Space can lose only its
attachments, and a missing attachment says so.

## The document

The prose is edited as formatted text and written back in one style. A page
whose prose and settings are unchanged is saved byte for byte. A page written
elsewhere is tidied on its first edited save: it renders the same, and a
second save changes nothing. Text after the canvas block is kept; the first
save moves the block after it.

### Front matter

YAML between two `---` lines, first in the file:

```markdown
---
bava:
  locked: true
  width: wide
tags: [launch, q4, road-map]
title: Kept as it is
---
```

| Key | Value | Absent means |
|---|---|---|
| `bava.locked` | `true`: read-only until unlocked | unlocked |
| `bava.width` | `narrow`, `wide`, `full` | the Space's `pageWidth`, else the app setting |
| `tags` | tags, below | none |

- Every other line and key, inside `bava:` or not, is kept in order; a changed
  setting is rewritten on its own line. With nothing to write, `bava:` is
  omitted, and a front matter that held only Bava's keys is not written (one
  written empty by hand stays).
- The block ends at a line of `---` alone. A file opening with `---` then an
  empty line opens with a divider.
- Line endings are `\n`, except when only the header is rewritten: then the
  page's own (`\r\n` stays).
- **Tags** are lowercase without spaces. On read they are lowercased, each run
  of spaces becomes `-` (`Road Map` is `road-map`), empties and repeats
  dropped. Read as a flow list (quoted or not), a block list (`  - a`) or a
  single value. Written only when changed: a flow list on the key's line
  (last when new), double-quoted where YAML needs it, replacing the old lines;
  no tags removes the key. A Space-wide tag rename, merge or delete rewrites
  only this key; locked pages are skipped and named.

### Markdown style

Blocks are separated by exactly one blank line.

| Block or mark | Written as |
|---|---|
| Heading 1 to 6 | `#` to `######` and a space (setext becomes `#`) |
| Bulleted list | `- ` (`*`, `+` become `-`) |
| Numbered list | `1. ` counting up (`1)` becomes `1.`); from ten items right-aligned (` 9.`, `10.`), continuations indented to match; a list starting elsewhere keeps its first number |
| To-do | `- [ ] `, `- [x] ` |
| Quote | `> ` on each line |
| Divider | `---` |
| Line break | a trailing `\` |
| Hand-wrapped line | joined with a space |
| Nested list item | indented by the parent marker's width |
| Bold, italic | `**bold**`, `*italic*` (`_` becomes `*`) |
| Strikethrough, inline code | `~~strike~~`, `` `code` `` |
| Link | `[text](url)`; a reference link is written inline, its definition left in place; `<email>` becomes a link |
| Underline | `<u>text</u>` |
| Text colour, highlight | `<span data-color="blue">`, `<span data-highlight="yellow">` |
| Emoji | the character (`🚀`), never `:rocket:` |

- Colours are swatch names (see Colours); unknown ones are kept, uncoloured.
- Typed text is `\`-escaped where Markdown would read syntax: `*`, `_`, `[`,
  `]`, `` ` ``, `~`, `\`, `$`, a `<` opening a tag, a `&` starting an entity.
  Entities in the file (`&amp;`, `&nbsp;`) are written as their characters.
- Unknown inline HTML (`<kbd>`, a comment, an unclosed `<u>`) and an image
  inside a line of text are kept in place.

### Invisible marks

Formatting Markdown cannot express is an HTML comment on the line before the
block, e.g. `<!-- bava: color=red background=yellow -->`.

| Key | On | Meaning |
|---|---|---|
| `list=a`, `list=i` | numbered list | letters or roman numerals (elsewhere kept as written) |
| `color=<swatch>`, `background=<swatch>` | paragraph, heading, list, quote | colours |
| `color`, `icon=<emoji>` | `[!note]` callout | custom callout |
| `wrap`, `caption` | code block | wrapping; a caption under it |
| `width`, `ratio`, `align`, `caption`, `poster`, `loop`, `muted` | image, video | Images and videos |
| `embed`, `page` | image | Canvas embeds |
| `card`, `card=extended`, `description`, `icon`, `image` | link | Cards |
| `contents`, `/contents` | own line | Contents block |

- Unknown keys are kept on the block, after the known ones (`toggle` on a
  heading included: headings never fold).
- Values with spaces are quoted (`caption="Start the server"`); inside, `&`,
  `"`, `--` are written `&amp;`, `&quot;`, `&#45;&#45;`.
- A mark with nothing after it that can carry it (before a divider or kept
  block, or at the end) is kept in place.

### Callouts

A quote opening with a kind: `> [!warning]` then `> Back up first.`

- Kinds: `info`, `note`, `success`, `warning`, `error`, lowercase. Others
  (`[!tip]`, `[!NOTE]`) are kept and shown as the nearest kind, or a note.
  Some viewers draw only some kinds.
- Text after the marker is a title; `-` or `+` after the brackets is kept.
- A custom callout is `[!note]` with `color` and `icon` in its mark.
- The first block follows the marker line directly when plain text, else
  after a `>` line.

### Toggles

`<details>`, a `<summary>` line, a blank line, any blocks, `</details>`.

- The summary is plain text with `&`, `<`, `>` as entities. `<details open>`
  is kept and starts open. Content not starting after a blank line is kept as
  written.
- Folded state is never written: Bava remembers it per computer; unknown
  toggles start folded unless `open`. Headings never fold.

### Code blocks

````markdown
<!-- bava: wrap caption="Start the server" -->
```go
func main() {}
```
````

- Backtick fences, three or as many as the code needs; `~~~` becomes
  backticks unless the opening line holds a backtick.
- The language is the first word after the fence, the rest of the line kept;
  none means plain text. The code is kept byte for byte.
- Indented blocks become fences; an empty block is a fence round one empty
  line.
- In a tight list an item's code block, list, quote, heading or equation
  follows its text directly; any other block after an item's first makes the
  whole list loose.

### Equations

Inline `$\pi r^2$`; blocks with `$$` on their own lines (a one-line `$$…$$`
block is rewritten that way).

- Inline TeX is kept as written; a `$` after an odd run of backslashes is TeX.
  TeX edited in Bava is one trimmed line with `$` escaped. A block never holds
  a `$$` line. `$$…$$` inside a line is kept as written.

### Footnotes

`text.[^1]` and `[^1]: The note.`

- Labels are kept; a new footnote takes the next free number.
- Notes go after the last block, in order of first reference, a blank line
  apart; later paragraphs indented four spaces.
- An unreferenced note is kept, last. One whose last reference was deleted in
  Bava is dropped on save.

### Contents block

```markdown
<!-- bava: contents -->

- [Goals](#goals)
  - [Beta](#beta)

<!-- bava: /contents -->
```

- Rewritten on every save; hand edits inside are replaced. Anything but one
  list between the marks is kept as written, marks included.
- Anchors: lowercase, spaces as `-`, punctuation other than `-`, `_` dropped,
  `-1`, `-2` appended to repeats. A blank line separates the list from each
  mark.

### Tables

A Markdown table while it has only a header row, cell text and alignment:

```markdown
| Name | Role   | Hours |
|------|:------:|------:|
| Ana  | Design | 12    |
```

- Alignment: `:---` left, `:---:` centre, `---:` right, `---` none. A `|` in
  a cell is `\|`, a line break `<br>`. Padding is cosmetic; edge spaces are
  not written.

HTML once it has a merged cell, a cell colour, a column width, a header column
or no header row:

```html
<table>
<colgroup><col width="120"><col><col></colgroup>
<tr><th>Name</th><th>Role</th><th>Hours</th></tr>
<tr><th>Ana</th><td colspan="2" data-background="yellow"><strong>Design</strong><br>and review</td></tr>
</table>
```

- Read: `table`, `colgroup`, `col` (`width` px), `thead`, `tbody`, `tr`,
  `th` (header row and column), `td`; on cells `colspan`, `rowspan` (at least
  1), `align` (`left`, `center`, `right`), `data-background` (swatch).
- In cells: `<strong>`, `<em>`, `<u>`, `<s>`, `<code>`, `<a href title>`,
  `<span data-color>`, `<span data-highlight>`, `<br>`, `$…$`, `[^label]`;
  images and other inline HTML kept as written. Entities decoded; `&`, `<`,
  `>`, `$`, `[` written as entities.

A cell holds one line of formatted text. Kept as written: an HTML table with
anything else or a grid that does not fill exactly, a Markdown table with a
row longer than its header, any table whose cells hold blocks.

### Links between pages

An ordinary link, e.g. `[Timeline](../Marketing/Launch%20plan.md#timeline)`.

- Path relative to the linking page, `/`-separated; space, `(`, `)`, `<`,
  `>`, `%`, `#`, `?`, `|` percent-encoded. A heading adds its anchor (as in
  the contents block); same page is the anchor alone. Text starts as the file
  name without `.md`.
- **Renaming or moving a page or folder in Bava** rewrites every link to it
  and a moved page's own links: the address, and the text where it is still
  the old file name. Only what the Document reads as a link changes (an HTML
  table's `<a href>`, a reference link's definition), never code, comments,
  front matter, equations, inline HTML, HTML blocks or kept tables. A page
  changed since read is skipped and named.
- A link to a missing page is kept, shown missing. Backlinks are not stored.

### Date chips

`<time datetime="2026-10-02">2 Oct 2026</time>`

- `datetime` is `YYYY-MM-DD`; Bava writes the text as `2 Oct 2026` (English)
  and keeps hand-written text until the date changes.
- Kept as written: an invalid day, or text empty or holding a tag, entity, or
  any of `*`, `_`, `` ` ``, `~`, `[`, `]`, `\`, `$`. Plain `2026-10-02` stays
  text.

### Images and videos

An image or video alone on its line, settings in the mark above:

```markdown
<!-- bava: width=large ratio=16:9 poster="demo-poster.png" loop muted caption="Demo" -->
![Demo](.bava/attachments/demo.mp4)
```

| Setting | Values | Absent means |
|---|---|---|
| `width` | `small`, `medium`, `large`, `full` (of the column) | own size, up to the column |
| `ratio` | `16:9`, `4:3`, `1:1`, cropped about the centre | own shape |
| `align` | `left`, `right` | centred |
| `caption="…"` | text under it | none |
| `poster="<file>"` | video still, a name in the attachments folder (never a path) | first frame |
| `loop`, `muted` | flags, video files only | off |

- **Type** by extension: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`
  images; `.mp4`, `.webm`, `.mov` videos; anything else kept as written.
- **Address**: relative to the page (encoded as links) or `https://…`; a root
  path (`/…`) or other scheme is kept as written. Web images load when shown;
  web videos load a first frame and play on request. Bava adds files to
  `.bava/attachments/` and rewrites addresses when a page moves or an
  attachment is renamed in Bava.
- Alt text starts as the file name without extension. Nothing autoplays.
- **Online videos**: `youtube.com/watch?v=…`, `youtu.be/…`,
  `youtube.com/shorts/…`, `vimeo.com/<number>`, `loom.com/share/<id>`. They
  take `width`, `ratio` (default 16:9), `align`, `caption`; video-file
  settings are kept, unused. A youtube thumbnail is fetched when shown (others
  and offline: a placeholder). The player loads only on play: from
  `youtube-nocookie.com`, vimeo with `dnt=1`, loom as served; on macOS youtube
  opens in the browser. Other sites are kept as written.

### Canvas embeds

A canvas frame as a picture: `embed` over a `.png` in `.bava/attachments/`
(over anything else, `embed` is an unknown key).

```markdown
<!-- bava: embed=f7 page="../Engineering/Architecture.md" width=large -->
![Write path](../.bava/attachments/Architecture%20-%20Write%20path.png)
```

- `embed=<id>`: the frame's id. `page`: its page, addressed as a link, omitted
  for this page, rewritten on moves. Pages outside a Space embed only their
  own. Not counted as a link.
- Settings `width`, `align`, `caption`; no `ratio`. Alt text starts as the
  frame label.
- The picture: PNG at 2x of the frame's area with everything over it, clipped,
  on the canvas background, without the frame's border or label, in the theme
  of the moment. Named once `<page name> - <frame label>.png` (`- Frame.png`
  unlabelled), numbered if taken, never renamed; shared by all embeds of it.
- Saving a page redraws (and writes if changed) pictures of its embedded
  frames. The open page's frames draw live.
- A deleted frame's embed keeps its last picture, marked deleted, and comes
  back live with the frame. The picture stays while a page names it.

### Cards

A link alone on its line with `card` in its mark:

```markdown
<!-- bava: card=extended description="How we ship." icon="example.com icon.png" image="example.com picture.png" -->
[Release notes](https://example.com/notes)
```

- `card`: icon, text, and file size or domain. `card=extended` adds file type
  and date, or the page's description and picture. No mark: a plain link.
- Text starts as the file name or page title; the address behaves as a link's.
- Web details live in the mark (`icon`, `image` as attachment names), saved
  when made or refreshed, so opening fetches nothing. File size, type and date
  are read live, never written.
- `card` on anything else is kept as written.

### Blocks kept as they are

Anything else (unholdable tables, HTML blocks other than `<details>` and
Bava's tables, link reference definitions) is read-only and written back
**byte for byte** in place; inside a list item or quote, under the container's
indent (as spaces) or `>`.

## The canvas

- **Unknown is preserved.** An unknown `type` is kept verbatim, not drawn.
  Unknown keys and values (a swatch, an arrowhead, a size) are kept; unknown
  values draw as the default. An unknown `version` is read best-effort.
- **Ids** are unique in the file and never change.
- **Bindings are ids**, never coordinates. A binding whose target is gone is
  kept, its end left in place and marked detached; the target returning
  re-attaches it.
- **Text stores its measured size** (`measuredWidth`, `measuredHeight`),
  authoritative and recomputed only when the text changes: webviews measure
  glyphs differently.

### Elements

Every element has `id`, `type`, `x`, `y`, `w`, `h`, `z`.

| `type` | Notes |
|---|---|
| `rect`, `ellipse`, `cloud` | |
| `diamond` | vertices at the edge midpoints |
| `cylinder` | database symbol |
| `hexagon` | flat top and bottom |
| `parallelogram` | slanted right |
| `document` | wavy bottom |
| `person` | head and shoulders |
| `line`, `arrow`, `stroke` | `points` |
| `text` | `text`, `measuredWidth`, `measuredHeight`; takes `color` |
| `code` | `code`, `language`, `measuredWidth`, `measuredHeight` |
| `frame` | optional `label`; takes `stroke`, `color` |
| `group` | `children`: element ids |
| `image` | `file`: a picture in `.bava/attachments/`, by name, never a path |

The nine shapes fill their box and take `label` (plain text, not
measured), `fill`, `stroke` and `color` (label), each a colour, absent
meaning the theme's default. A label sits in the box inside its shape, clear
of curved and slanted edges (an ellipse's inscribed box, a diamond's middle
half), less an inset; it wraps there, a word too wide broken across lines.
When a label, its size or its shape's width changes, Bava makes the shape's
`h` tall enough to hold it; nothing changes on open, and a label longer than
its stored `h` draws on past the shape until it is next edited.

```json
{ "id": "e4", "type": "cylinder", "x": 40, "y": 24, "w": 120, "h": 90, "z": 2, "label": "Postgres", "fill": "blue" }
```

### Colours

A value starting with `#` is a literal `#rrggbb`; anything else is a swatch:
`gray`, `blue`, `green`, `yellow`, `orange`, `red`, `purple`, `pink` (light
and dark values live in the app). Literals draw as stored in light theme; in
dark, inverted by 93% and hue turned 180 degrees. Unknown swatches and
malformed literals draw as the default and are kept.

### Style properties

| Key | Value | Absent | Elements |
|---|---|---|---|
| `strokeWidth` | 1, 2, 4 | 2 | shapes, `line`, `arrow`, `stroke`, `frame` |
| `strokeStyle` | `solid`, `dashed`, `dotted` | `solid` | as above |
| `edges` | `sharp`, `round` | `sharp` | `rect`, `diamond`, `hexagon`, `parallelogram`, `line` |
| `opacity` | 0 to 100 | 100 | all |
| `fontSize` | 16, 20, 28, 36; `code` 11, 13, 16, 20 | 20; `code` 13 | `text`, `code`, labels |
| `align` | `left`, `center`, `right` | `center` in a shape, `left` in `text` and frame labels | `text`, labels |
| `verticalAlign` | `top`, `middle`, `bottom` | `middle`; frame `top` | labels |
| `locked` | `true` (editing only) | unlocked | all |
| `angle` | 0 to 359, clockwise about the centre | 0 | all but elbow arrows |
| `frame` | id of the owning `frame` | none | all |
| `language` | highlighting language | plain | `code` |
| `closed` | `true`: last point on the first | open | `line` |
| `arrowType` | `straight`, `elbow`, `arc` | `straight` | `arrow` |
| `startArrowhead`, `endArrowhead` | arrowhead name | `none`, `arrow` | `arrow` |
| `startBinding`, `endBinding` | id of the attached element | unattached | `arrow` |
| `startAnchor`, `endAnchor` | `[fx, fy]`, 0 to 1 on the target's upright box | centre | bound end |
| `startMode`, `endMode` | `inside`: pinned at the anchor | on the outline | bound end |
| `fixedSegments` | `[{ "index": n, "start": [x, y], "end": [x, y] }]`, dragged middle segments, arrow coordinates | routed | elbow |
| `label` | text at mid-path | none | `arrow` |
| `labelPosition` | 0 to 1 along the path | middle point (odd count), else middle of the middle segment | labelled `arrow` |
| `labelDirection` | `along`: follows the path, kept readable | upright | labelled `arrow` |

Arrowheads: `none`, `arrow`, `bar`, `triangle`, `triangle-outline`, `circle`,
`circle-outline`, `diamond`, `diamond-outline`, and crow's foot `one`, `many`,
`oneOrMany`, `exactlyOne`, `zeroOrOne`, `zeroOrMany`.

### Lines, arrows and strokes

- `points` is flat `[x1, y1, x2, y2, ...]` relative to `x, y`: two ends plus
  one per bend; a stroke has every pen sample. All take `stroke`; only a
  `closed` line takes `fill` (absent: none), removed when opened.
- New arrows are written `arrowType: "arc"`, new lines `edges: "round"`.
- Straight arrows and lines have sharp corners at the points; arcs curve
  through them (straight with no bends). An elbow's `points` are its route:
  right-angled, leaving each target from its end's side, avoiding both,
  re-routed when either moves. To elbow replaces bends with the route; away
  keeps the two ends and drops `fixedSegments`.
- `fixedSegments` hold until released, only the end legs adapting; `start`
  and `end` are rewritten from `points` on every change, and an entry for the
  first, last or a missing segment is dropped. An elbow whose `points` are not
  a route is routed on open.
- A bound end sits where the line from its anchor towards its neighbour (next
  bend, else the other end) leaves the target's outline, a fixed gap clear;
  anchors turn with the target. An `inside` end sits at its anchor. An elbow
  end is never inside: it stays on its anchor's side. An anchor without a
  binding is kept, meaningless. `points` are always written, the fallback when
  a binding cannot resolve.

### Pictures

```json
{ "id": "p1", "type": "image", "file": "har gow.png", "x": 40, "y": 24, "w": 200, "h": 150, "z": 3 }
```

- `file` is the attachment's name, as a video's `poster` is: moving the page
  never breaks it. Renaming the attachment in Bava rewrites it in every
  page's canvas.
- The picture fills its box; resizing keeps its proportions unless Shift is
  held. It takes `opacity`, `angle`, `locked` and `frame`; no fill, border or
  label.
- A file that cannot be loaded draws as a dashed box naming it, and is kept.

### Frames and code

- `frame` lives on the child: one frame at most. Moving a frame moves its
  members; deleting it keeps them and clears their `frame`.
- A `code` block's width is the user's (new: 20 columns); lines wrap at the
  last space, or the edge for a long word. Height is the user's but never less
  than the wrapped code. All measured at `fontSize` (13 absent); a new size
  re-wraps. A known `language` is named on the top edge; an unknown one is
  kept, drawn plain and unnamed.

### On the clipboard

Copy and Cut on the canvas put an SVG on the system clipboard: the copied
elements drawn as Copy as SVG draws them, with the elements themselves, as
the file stores them (contents of a copied group or frame included), right
after the opening `<svg>` tag:

```xml
<metadata id="bava-canvas">{"version":1,"elements":[...]}</metadata>
```

The JSON is escaped for XML. Paste reads it back as elements with fresh ids,
arrows and frames pointing at the copies. Any other text pasted on the canvas
becomes one `text` element, wrapped at 400 scene units when wider. A text
element whose `w` is less than its longest line is drawn wrapped at `w`, and
stays so as it is edited.

A picture element in the copy is drawn from its file's bytes, as a data
address on an `<image data-file="<name>">`. Pasted into a Space without that
file, the bytes are attached under its name (or a free one) first.

## Spaces

A folder opened as the home of its pages: folders, `.md` pages (ordinary Bava
files) and a hidden `.bava/` (`space.json`, `attachments/`, `templates/`,
`trash/`), created on first open. A nested folder with its own `.bava/` is not
a Space.

### `.bava/space.json`

```json
{ "version": 1, "order": { "": ["Marketing", "Roadmap.md"], "Marketing": ["Launch plan.md"] }, "pageWidth": "wide" }
```

| Key | Value | Absent means |
|---|---|---|
| `version` | 1; newer read as far as understood | |
| `order` | per folder path (`""` top, `/`-separated): entries in the user's order; unlisted follow by name; missing dropped on next write | all by name |
| `pageWidth` | `narrow`, `wide`, `full` | the app setting |

Unknown keys kept. Written whole and atomically.

### `.bava/trash/`

A trashed page, folder or attachment moves unchanged to `.bava/trash/<id>/`
(opaque, unique) with an `item.json`:
`{ "path": "Marketing/Launch plan.md", "kind": "page", "deletedAt": "2026-09-27T10:12:00Z" }`

- `kind`: `page`, `folder`, `attachment` (`path` `.bava/attachments/<name>`);
  `deletedAt`: RFC 3339.
- Nothing expires. Items go when deleted, the Trash is emptied, or the Space is
  removed with "Also delete Bava's data in this folder" (deletes `.bava/`).
- Restore returns to `path`, recreating folders, numbered if taken
  (`Launch plan 2.md`); a folder lands at its parent's end, contents by name.

### `.bava/attachments/`

Every file pages show or link to, one folder per Space.

- Names kept; a different file with a taken name is numbered (`logo 2.png`);
  identical bytes reuse the existing file. A nameless paste is
  `Pasted image YYYY-MM-DD HH.MM.SS.png`.
- Use is not recorded: a file no page names is unused; while any page is
  unreadable, none is. Removing media never deletes the file.
- Date modified is the date attached.
- Renamed or removed outside Bava: the media shows missing and Bava offers to
  relink by name.

### `.bava/templates/`

- A template is a page file, named by its file without `.md`. A group is a
  folder directly inside; deeper folders and non-`.md` files are ignored; an
  emptied group is removed.
- Addresses are relative to the template, rewritten when a page is made from
  it or it is saved from a page. A page from a template is a plain copy.
  Deleting a template is permanent.

## Not in a file

- Cursor, zoom, pane widths, view mode, recent Spaces and files, a Space's
  open folders and last page: per viewer, in `localStorage`.
- Chat transcripts: JSONL in the platform data directory (`.ai/rules/ai.md`).
- Credentials: the OS secret store.
- Folders and files the user allowed Bava to reach, inside a store's
  sandbox: `access.json` beside the settings, each a path and, on macOS, a
  security-scoped bookmark. Deleting it only means choosing them again.

`.d2` files are not opened as diagrams, are left out of a Space's list, and
are never written.

Every format change ships with a round-trip test (write, read, compare)
covering unknown keys and elements.
