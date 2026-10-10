# File format

What Bava writes to disk, and the rules that keep it readable for longer than
Bava exists.

**Status:** specified 2026-09-17, ahead of the code that writes it. Both
halves are built: the canvas block and the document (below). There is no
`diagram` element: Diagram from Code converts D2 into ordinary shapes and
arrows, and keeps no source.

## The shape

A Bava file is **Markdown**. One file holds a document and a canvas.

````markdown
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
````

Three parts, in this order:

1. **Prose**: ordinary Markdown. What every other editor sees first.
2. **Diagram blocks**, if the user wrote any: fenced `d2`, part of the prose
   and kept as written. No element refers to them.
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
to the Space as a whole (page order, the Trash and attachments), never a page's text or canvas. The one thing that can be
separated from a page copied on its own is its attachments: a trade-off
accepted knowingly (`.claude/work/specs/documents.md`, decision 10),
never silent (a missing attachment says so), and covered by exporting the
page with its files.

The cost is accepted knowingly: a JSON block at the end of a human document.

## The document

**Status:** specified 2026-09-27 for Milestone 8.2, and for 8.3a's callouts,
toggles, code blocks, equations, footnotes, contents and emoji, 8.3b's
tables, and 8.3c's links between pages and date chips, each ahead of the
code.

The prose part of a page, everything before the canvas block, is edited as
formatted text and written back as Markdown in one style. The page never
shows the canvas block: it is written from the canvas on every save, last,
after one blank line. Text a hand left after the block is kept in the page,
and the first save puts the block after it. A page whose prose
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
- Its line endings are written as `\n`, except when only the header is
  rewritten (a setting or the tags changed, the prose not): it then takes
  the page's own line ending, so a page written with `\r\n` keeps them.

#### Tags

A page's tags are a top-level `tags` key, beside `bava:`, so other Markdown
tools read them too:

```markdown
---
tags: [launch, q4, road-map]
---
```

- **A tag** is lowercase with no spaces. Bava reads a tag another tool wrote
  converted: lowercase, each run of spaces a dash (`Road Map` is
  `road-map`); an empty one and a repeat are dropped.
- **Read:** a flow list (`tags: [a, b]`, items quoted or not), a block list
  (`tags:` and then lines of `  - a`) or a single value (`tags: a`).
- **Written** only when the page's tags are changed in Bava, then as a flow
  list on the key's own line where the key stood (last in the front matter
  when the page had none), an item in double quotes when YAML needs it.
  The key's old lines are replaced, a block list's included. No tags left
  removes the key; a front matter that then holds nothing is not written,
  as with Bava's settings.
- Renaming, merging or deleting a tag across the Space rewrites only this
  key in each page that has it, every other byte kept. A locked page is
  left as it is, and named.

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
closed) is kept as it is, in its place in the text. An image inside a line of text
is kept as written too; an image alone on its line is a media block (below).
A numbered list that starts at another number keeps its first
number.

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
- `toggle` on a heading was a toggle heading in earlier versions; Bava no
  longer folds headings, so it is kept as written, as any unknown key.
- `wrap` and `caption="…"`: a code block's settings (below).
- `width`, `ratio`, `align` and `caption="…"`: an image's or a video's
  settings; `poster`, `loop` and `muted`: a video file's (below).
- `embed=<id>` and `page="<address>"`: a canvas embed, with an image's
  `width`, `align` and `caption="…"` (below).
- `card` or `card=extended`, and a web card's `description="…"`,
  `icon="<file>"` and `image="<file>"`: a link shown as a card (below).
- `color=<swatch>` and `icon=<emoji>` on a note callout: a custom callout
  (below).
- A value with spaces is quoted (`caption="Start the server"`). Inside the
  quotes, `&`, `"` and `--` are written `&amp;`, `&quot;` and `&#45;&#45;`, so
  the value can never end the comment.
- A mark with no block after it that can carry one (before a divider or a kept
  block, or at the end) is kept as it is, where it was.

### Callouts
A quote whose first line is a kind in brackets. Obsidian draws all five;
GitHub draws Note and Warning and shows the others as quotes.

```markdown
> [!warning]
> Back up before migrating.

<!-- bava: color=purple icon=🚀 -->
> [!note]
> A custom callout: your colour and icon, shown only in Bava.
```

- The kinds: `info`, `note`, `success`, `warning`, `error`, in lower case.
  Another kind (`[!tip]`, `[!NOTE]`) is kept as written and shown as the
  nearest of the five, or as a note.
- Text after the marker on its first line is a title (`> [!info] Heads up`),
  and `-` or `+` straight after the brackets folds it in Obsidian; both are
  kept as written.
- A custom callout is `[!note]` with `color` and `icon` in the mark above it.
- The callout's first block follows the marker's line directly when it is
  plain text, and after a `>` line otherwise, so it is never read as more of
  that line.

### Toggles
A **toggle list** is HTML's fold box, which GitHub and most viewers draw:

```markdown
<details>
<summary>What ships on Friday</summary>

The editor, the tree and the Trash.

</details>
```

- The summary is one line of plain text, with `&`, `<` and `>` written as
  `&amp;`, `&lt;` and `&gt;` (formatting inside `<summary>` shows as its raw
  marks on GitHub); the content is any blocks. `<details open>` is kept, and
  makes it start open. A `<details>` whose content does not start after a
  blank line is kept as written.

A toggle list is the only fold: a heading never folds. A heading carrying the
`<!-- bava: toggle -->` mark of earlier versions keeps it, as written.

Whether a toggle is folded is **never written**: Bava remembers it on this
computer. One it has no memory of starts folded, unless the file says `open`.

### Code blocks
A fence with a language. The mark above holds a block's wrap switch and its
caption, shown under the block in Bava only:

````markdown
<!-- bava: wrap caption="Start the server" -->
```go
func main() {}
```
````

- The fence is written with backticks, three or as many more as the code
  needs. A `~~~` fence is written with backticks.
- The language is the first word after the fence; anything after it on that
  line is kept as written. A block with no language is plain text.
- The code is kept byte for byte, tabs and trailing spaces included.
- A fence whose opening line holds a backtick is written with tildes (`~~~`),
  which is the only fence that allows one.
- A block indented four spaces is written as a fence, and an empty block as a
  fence around one empty line.
- In a tight list, an item's code block, list, quote, heading or equation
  follows its text with no blank line. When an item holds any other block
  after its first, the whole list is written loose.

### Equations
TeX, drawn in Bava and by GitHub and Obsidian:

```markdown
The area is $\pi r^2$.

$$
\int_0^1 x^2\,dx = \tfrac{1}{3}
$$
```

- `$$` blocks are written with `$$` on lines of their own; a one-line
  `$$…$$` block is written that way too.
- Inline `$…$` is kept exactly as written, TeX included. A `$` preceded by an
  odd run of backslashes is part of the TeX, not its end. TeX edited in Bava
  is kept on one line, trimmed, with any `$` in it escaped; a block's TeX
  never holds a line of `$$` alone.
- `$$…$$` inside a line (Obsidian's display maths) is kept as written.

### Footnotes
A reference `[^label]` in the text and its note `[^label]: …`, which GitHub
and Obsidian draw as numbered notes.

```markdown
Bava keeps files plain.[^1]

[^1]: No database, no container.
```

- Labels are kept as written; a new footnote takes the next free number.
- Notes are written after the page's last block, in the order they are first
  referred to, one blank line apart. A note of several paragraphs indents its
  later ones by four spaces.
- A note nothing refers to is kept, after the others.
- A note whose last reference is deleted in Bava is left out when the page is
  saved. Until then it stays, so a sentence cut and pasted elsewhere keeps its
  note.

### The contents block
The page's headings as a list of links, written out between two marks so
every viewer shows a working list. Bava rewrites the list on every save.

```markdown
<!-- bava: contents -->

- [Goals](#goals)
- [Timeline](#timeline)
  - [Beta](#beta)

<!-- bava: /contents -->
```

- Anchors are GitHub's: lower case, spaces as `-`, punctuation other than `-`
  and `_` dropped, and `-1`, `-2` after a heading's name when it repeats.
- A blank line sets the list apart from each mark; without it, some readers
  take the closing mark into the list's last item.
- The list between the marks is Bava's to write: an edit made there by hand
  is replaced on the next save. Anything but one list between the marks is
  kept as written, marks included, and shows as text.

### Emoji
Written as the character itself (`🚀`), never as a `:rocket:` code.

### Tables
A table is written in one of two forms, chosen on each save by what the
table uses.

**A Markdown table**, while it has only a header row, cell text and column
alignment. GitHub, Obsidian and most editors draw it:

```markdown
| Name | Role   | Hours |
|------|:------:|------:|
| Ana  | Design | 12    |
```

- Alignment is the header line's colons: `:---` left, `:---:` centre,
  `---:` right; `---` is none.
- A `|` in a cell is written `\|`; a line break is `<br>`, a closing one
  included. Spaces at a cell's edges are not written; readers trim them.
- Cells are padded to line up in a plain editor; the padding carries no
  meaning.

**An HTML table**, as soon as the table has a merged cell, a cell colour, a
column width, a header column or no header row. GitHub and Obsidian draw it
too:

```html
<table>
<colgroup><col width="120"><col><col></colgroup>
<tr><th>Name</th><th>Role</th><th>Hours</th></tr>
<tr><th>Ana</th><td colspan="2" data-background="yellow"><strong>Design</strong><br>and review</td></tr>
</table>
```

- Only `table`, `colgroup`, `col` (`width` in pixels), `thead`, `tbody`,
  `tr`, `th` and `td` are read, with `colspan`, `rowspan`, `align` (`left`,
  `center`, `right`) and `data-background` (a swatch name) on cells.
- A cell is a header cell (`th`) in the header row, the header column, or
  both.
- Inside a cell, formatting is HTML: `<strong>`, `<em>`, `<u>`, `<s>`,
  `<code>`, `<a href title>`, `<span data-color>`, `<span data-highlight>`,
  `<br>` and inline `$…$`. A footnote reference is `[^label]`; an image is
  kept as written; other inline HTML (`<kbd>`) is kept as written. Entities
  are decoded, and `&`, `<`, `>`, `$` and `[` in text are written as
  entities so they read back as text.
- Spans are at least 1, and the cells must fill the grid exactly: every row
  as wide as the others, no cell overlapping another, no span running past
  the last row. Anything else is kept as written.

A cell holds one line of formatted text, with line breaks, never a list or
another block. A table Bava cannot hold exactly is kept as written:
an HTML table with anything else in it, a Markdown table with a row longer
than its header (other readers drop the extra cells), and any table whose
cells hold blocks.

### Links between pages
A link to another page is an ordinary Markdown link to its file, so every
Markdown app follows it:

```markdown
See the [Launch plan](../Marketing/Launch%20plan.md) and its
[Timeline](../Marketing/Launch%20plan.md#timeline).
```

- The path is relative to the linking page, with `/` between folders. A
  space is written `%20`, and so is every other character a link's address
  cannot hold as it is (`(`, `)`, `<`, `>`, `%`, `#`, `?`, `|`); GitHub and
  Obsidian read it back the same.
- A link to a heading adds the heading's anchor, the same anchors as the
  contents block's (GitHub's). A link to a heading on the same page is the
  anchor alone (`#timeline`).
- The text starts as the page's file name without `.md`, and can be
  reworded like any link's.
- **When a page or folder is renamed or moved inside Bava**, every link to a
  page it moved is rewritten in every page of the Space, and a moved page's
  own links are rewritten from its new place. Only the link's address
  changes, and its text where the text is still the old file name; a
  reworded link keeps its words, and every other byte of the page stays as
  it was. A link is exactly what the Document shows as one, read by the same
  reader, so nothing else is ever rewritten: not code, comments, front
  matter, equations, inline HTML, HTML blocks, text in an HTML table's
  cells, or a table kept as written. A link in an HTML table is its
  `<a href>`; a reference link's address is its definition's. A page
  changed since it was read is left as it is and named.
- A link to a page that does not exist is kept as written and shown as
  missing. Nothing written to any file records who links to whom: Bava reads
  the pages to find a page's "Linked from" list.

### Date chips
A date is HTML's date tag around the date as a person reads it:

```markdown
The launch is on <time datetime="2026-10-02">2 Oct 2026</time>.
```

- `datetime` is the day, `YYYY-MM-DD`. Other apps show the readable text.
- Bava writes the text as day, short month and year (`2 Oct 2026`), in
  English. Text written by hand is kept as written until the date is changed
  in Bava.
- A tag whose `datetime` is not a valid day, or whose words are empty or hold
  anything but plain text (a tag, an entity, or Markdown's marks such as `*`,
  `_`, `` ` ``, `~`, `[`, `]`, `\` and `$`), is kept as written.
- A date typed as plain text (`2026-10-02`) stays text.

### Images and videos
An image or a video file alone on its line is a media block: a Markdown
image, its settings in the mark above.

```markdown
<!-- bava: width=medium ratio=16:9 caption="The new editor" -->
![The new editor](.bava/attachments/editor.png)

<!-- bava: width=large poster="demo-poster.png" loop muted -->
![Demo](.bava/attachments/demo.mp4)
```

- **Which it is:** by the address's file type. `.png`, `.jpg`, `.jpeg`,
  `.gif`, `.webp` and `.svg` are images; `.mp4`, `.webm` and `.mov` are
  videos. Any other type stays a kept image, as written.
- **Where it is:** relative to the page, or on the web (`https://…`). An
  image on the web is loaded when the page shows it, so opening the page
  reaches that site; a video on the web loads its first frame then, and
  plays nothing until play is pressed.
  An address from the root of the disk (`/…`) or by another scheme stays a
  kept image.
- **The address** is relative to the page, with `%20` and the other
  encodings of a link (above). Files Bava adds are in the Space's
  `.bava/attachments/`. Moving or renaming a page, or renaming an attachment
  in Bava, rewrites every address that reaches it, and nothing else.
- **The alt text** starts as the file's name without its extension; Bava
  keeps what is written there.
- **The settings**, each left out when it is the default:
  - `width`: `small`, `medium`, `large` or `full` (of the page's column).
    Without it the image is drawn at its own size, up to the column.
  - `ratio`: `16:9`, `4:3` or `1:1`. The image fills that shape, cropped
    about its centre. Without it, its own shape.
  - `align`: `left` or `right`. Without it, centred.
  - `caption="…"`: shown under it, in Bava only.
  - `poster="<file>"`, a video's still, by its name in the attachments
    folder (never a path, so moving the page never changes it); `loop`;
    `muted`.
- Other apps show the image (and Obsidian plays the video; GitHub shows a
  video as a broken image); the settings show in Bava only. A video never
  plays by itself.

**An online video** is the same form, at the video's page on YouTube
(`youtube.com/watch?v=…`, `youtu.be/…`, `youtube.com/shorts/…`), Vimeo
(`vimeo.com/<number>`) or Loom (`loom.com/share/<id>`):

```markdown
<!-- bava: width=large caption="The launch demo" -->
![Launch demo](https://www.youtube.com/watch?v=abc123)
```

- It takes `width`, `ratio`, `align` and `caption`; without a `ratio` it is
  drawn 16:9. `poster`, `loop` and `muted` are a video file's only, and kept
  as written on an online one.
- When the page shows it, Bava loads the video's picture from the site
  (YouTube's thumbnail; Vimeo and Loom publish none at a fixed address, so
  theirs is a placeholder), and offline shows the placeholder. Nothing plays
  until play is pressed; then Bava loads the site's player: YouTube's from
  `youtube-nocookie.com`, Vimeo's asked to keep no record of the viewer
  (`dnt=1`), and Loom's as Loom serves it (it has no such setting). Where
  YouTube will not play inside Bava's window (macOS, whose page has no web
  address), play opens the video in the browser.
  Obsidian embeds the player; GitHub shows a broken image.
- The page of any other site stays a kept image, as written.

### Canvas embeds
A frame of a canvas shown in the page: a picture of it in the attachments,
written as an image with an `embed` mark above it.

```markdown
<!-- bava: embed=f3 width=large caption="The write path" -->
![Ingest pipeline](../.bava/attachments/Architecture%20-%20Ingest%20pipeline.png)

<!-- bava: embed=f7 page="../Engineering/Architecture.md" -->
![Write path](../.bava/attachments/Architecture%20-%20Write%20path.png)
```

Both are in a page in a folder (`Marketing/Launch plan.md`): the first
embeds a frame of that page's own canvas, the second one of
`Engineering/Architecture.md`'s.

- **Which it is:** a mark with `embed` over a `.png` image in the Space's
  `.bava/attachments/`. A mark with `embed` over anything else is kept on
  that block as an unknown key is.
- **`embed=<id>`:** the frame's element id on its page's canvas.
- **`page="<address>"`:** the page whose canvas holds the frame, written as
  a link's address is (relative to this page, encoded the same way), left
  out when it is this page. A frame from any page in the Space can be
  embedded; a page in no Space embeds only its own, and asks to become a
  Space first, as for any media. Moving or renaming that page in Bava
  rewrites the address, as it rewrites links. An embed is not a link: it is
  not counted in Linked from.
- **The image** is the frame's picture, so every other app shows it. The alt
  text starts as the frame's label; Bava keeps what is written there.
- **The settings:** `width`, `align` and `caption="…"`, as an image's. No
  `ratio`: the frame decides the picture's shape.
- **The picture** is a PNG at twice the frame's size: the frame's area with
  everything drawn over it, cut at its edges, on the canvas background, without the frame's own border or
  label, in the theme Bava had when it was drawn. It is named once, when the
  frame is first embedded, `<page name> - <frame label>.png`
  (`<page name> - Frame.png` for a frame with no label), numbered if the
  name is taken, and never renamed by itself. Every embed of the same frame
  uses the same picture.
- **Kept up to date:** in Bava, an embed of the open page's frame is drawn
  live from its canvas. Saving a page draws again the picture of each of its
  frames that any page in the Space embeds, and writes it when it changed.
  A page changed outside Bava gets its pictures drawn again the next time
  Bava saves it.
- **A frame that is gone** leaves its embed showing the last picture, marked
  as deleted; it is never removed. The frame coming back (undo, or the id
  again in the file) makes it live again. The picture stays in the
  attachments while a page names it.

### Cards
A link alone on its line, with `card` in the mark above, is a card: a file
of the Space, or a page on the web, shown as a box that opens it.

```markdown
<!-- bava: card -->
[Q3 report.pdf](.bava/attachments/Q3%20report.pdf)

<!-- bava: card=extended description="How we ship each week." icon="example.com icon.png" image="example.com picture.png" -->
[Release notes](https://example.com/notes)
```

- **`card`** is the simple card: an icon, the link's text, and the file's
  size or the site's domain. **`card=extended`** adds the file's type and
  date modified, or the web page's description and picture.
- **A plain link** is the same line with no mark: switching a card to a link
  removes it, and back adds it.
- **The link's text** is the file's name, or the web page's title when the
  card was made. The address is a link's (above), and follows moves and
  renames as one does.
- **A web card's details** are saved in the mark when the card is made (or
  refreshed), so opening the page fetches nothing: `description="…"`, and
  `icon` and `image`, each a picture's name in the attachments folder (as a
  poster's). A file's size, type and date are read from the file, never
  written.
- A `card` key on anything but a link alone on its line is kept as written.
- Other apps show a working link; the card shows in Bava only.

### Blocks kept as they are
A block this version cannot edit is shown in the page, read-only, and written
back **byte for byte**: tables Bava cannot hold exactly (above), HTML blocks
other than `<details>` and Bava's own tables, link reference definitions, and
any other construct not listed above. It keeps its place among the other blocks.
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

### Fenced `d2` blocks are prose
A fenced `d2` block a person writes in the prose is kept exactly as written.
No element refers to it: a diagram inserted with Diagram from Code is
ordinary shapes and arrows, and its D2 source is not kept.

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
An arrow attached to an element stores that element's `id` in `startBinding`
or `endBinding`. Ids survive a move; coordinates do not. A binding
whose target no longer exists is kept, marked detached, and never silently
deleted: the user drew it.

### Ids are stable within a file
An element's `id` is unique within its file and does not change once written.
Bindings and frame membership depend on it.

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
| `align` | `left`, `center`, `right` | `center` in a shape, `left` in free text and a frame's label | `text` and labels |
| `verticalAlign` | `top`, `middle`, `bottom` | `middle`; `top` in a frame | labels |
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
    attachments/
    templates/
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
  Absent means the user's own app setting.
- **Unknown keys are kept** through every write, as elsewhere.
- Written whole and atomically, like a page.

Per-viewer conveniences (which folders are open, the last page opened) are
not in it: they live in `localStorage`, as below.

### `.bava/trash/`

A page, a folder or an attachment moved to the Trash goes, whole and
unchanged, into
`.bava/trash/<id>/`, beside an `item.json`:

```json
{ "path": "Marketing/Launch plan.md", "kind": "page", "deletedAt": "2026-09-27T10:12:00Z" }
```

- `path`: where it came from, relative to the Space; `kind`: `page`,
  `folder` or `attachment` (its `path` is `.bava/attachments/<name>`);
  `deletedAt`: RFC 3339.
- `<id>` is opaque and unique within the Trash.
- The order kept for a trashed folder's contents is not kept with it: a
  restored folder comes back at the end of its parent, its contents by name.
- Items stay until the user deletes them from the Trash or empties it, or
  removes the Space from Bava's list with "Also delete Bava's data in this
  folder" on, which deletes `.bava/` whole (order, page width, attachments
  and the Trash); nothing is removed by age. Restoring moves the item back to `path`,
  recreating missing folders; if the name is taken it comes back numbered
  (`Launch plan 2.md`).
- An attachment is restored to the attachments folder, numbered if its
  name was taken meanwhile; the page order never names it.
- A folder holding a `.bava/` of its own is not a Space inside a Space: Bava
  treats only the folder opened as the Space.

### `.bava/attachments/`

The files pages show or link to: images, videos and any other file added
by paste, drop, the `/` menu or Media, each copied here, in one folder for
the whole Space.

- A file keeps its name. A different file with a name already there is
  saved numbered (`logo 2.png`); a file with the same bytes as one already
  there is not copied again, and the page uses that one.
- A pasted image with no name is saved as `Pasted image YYYY-MM-DD
  HH.MM.SS.png`.
- Nothing records which page uses which file: a file no page names is
  unused, worked out by reading the pages. A page that names the file
  anywhere uses it (a mistake only ever keeps a file), and while any page
  cannot be read, no file is unused. Removing media from a page never
  deletes its file; Media moves unused files to the Trash when asked.
- A file of this folder's date modified is when Bava attached it: Media
  sorts by it as the date added.
- A file renamed or removed outside Bava leaves its media missing; Bava
  offers to relink it to a file of the same name here, and changes nothing
  until asked.

### `.bava/templates/`

The Space's page templates. Bava makes the folder the first time a template
is saved.

```
.bava/templates/
  Meetings/
    Weekly sync.md
    Retro.md
  Bug report.md
```

- **A template** is a page file (`.md`): front matter, prose and canvas
  block, read and written as a page is. Its name is its file's name
  without `.md`, under the rules a page's name follows.
- **A group** is a folder directly in `templates/`, named under the same
  rules; a template directly in `templates/` is in no group. Deeper
  folders, and files that are not `.md`, are not read. A group left with
  no templates is removed.
- **Addresses** (links, images, embeds) in a template are written relative
  to the template's own place, as a page's are to its own. A page made
  from a template, and a template saved from a page, has them rewritten
  for where it lands, so each still reaches what it reached.
- A page made from a template is the template's file, copied (tags, prose
  and canvas), with nothing filled in. Deleting a template removes its
  file for good; it does not go to the Trash.

## What is not in a file

- No cursor position, zoom level, pane widths, or view mode. Those are
  per-viewer conveniences and live in `localStorage`, as do recent Spaces and
  files, a Space's open folders and its last page.
- No chat transcripts. Those are Bava's own state, in the platform data
  directory as append-only JSONL; see `.ai/rules/ai.md`.
- No credentials, ever. Those are in the OS secret store.

## `.d2` files

**Not built.** Bava does not open a standalone `.d2` file as a diagram, and a
Space's file list leaves `.d2` files out. Bava writes nothing into one, so
another tool's `.d2` file is left unchanged.

## Round-trip tests are mandatory

Every change to this document ships with a test that writes, reads and
compares, not a unit test of the writer and another of the reader, because
that is exactly where asymmetries hide. The unknown-key and unknown-element
cases are part of that test, not an afterthought.
