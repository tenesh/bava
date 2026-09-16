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

1. **Prose** — ordinary Markdown. What every other editor sees first.
2. **Diagram blocks** — fenced `d2`, with an `id` in the info string. Readable
   and reviewable anywhere, and valid D2 that other tools can compile.
3. **The canvas block** — one fenced `bava-canvas` block, last in the file.

### Why one file rather than a sidecar

The alternative — `notes.md` plus `notes.canvas`, or a `.bava/` directory —
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
deleted — the user drew it.

### Ids are stable within a file
An element's `id` is unique within its file and does not change once written.
Bindings and diagram-block references depend on it.

## What is not in a file

- No cursor position, zoom level, pane widths, or view mode. Those are
  per-viewer conveniences and live in `localStorage`.
- No chat transcripts. Those are Bava's own state, in the platform data
  directory as append-only JSONL — see `.ai/rules/ai.md`.
- No credentials, ever. Those are in the OS secret store.

## `.d2` files

A standalone `.d2` file is exactly what it looks like: D2 source, nothing else.
Bava opens it and shows the diagram. It has no canvas and no prose, and Bava
writes nothing extra into it — another tool's `.d2` file goes home unchanged.

## Round-trip tests are mandatory

Every change to this document ships with a test that writes, reads and
compares — not a unit test of the writer and another of the reader, because
that is exactly where asymmetries hide. The unknown-key and unknown-element
cases are part of that test, not an afterthought.
