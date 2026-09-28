# Editors

## Mounting
CodeMirror 6 and ProseMirror are imperative and own their DOM. Mount in
`onMount`, destroy in the cleanup return, never pass reactive props in. If you
find yourself writing `$derived` that feeds an editor, the design is wrong.

## The document editor
`frontend/src/docs/editor.ts` is a plain class (`DocEditor`) owning one
ProseMirror view; `DocumentPane.svelte` mounts it once and keeps the menus,
bubble and handle beside it as components fed by callbacks. Never a Svelte
component per block.

- **The file is Markdown both ways.** `docs/markdown.ts` reads a page into the
  schema and writes it back in Bava's style (`docs/file-format.md`). Anything
  the schema cannot hold becomes a `kept` block or `keptInline` run holding its
  source byte for byte; never drop or "fix" what cannot be edited. Every real
  `.md` in the repo is round-tripped by `markdown.test.ts`: a second save must
  change nothing.
- **Front matter is copied, never re-serialised.** Only the lines under
  `bava:` are read and written; every other line is kept verbatim.
- **Undo is per editor, routed by focus.** The page has its own history;
  `shell/edit-target.ts` sends ⌘Z and the other edit commands to whichever
  editor holds focus (`document` for `.bava-doc`).
- **Saving reads the editor.** `doc.bindSource(read)` makes save take the
  editor's Markdown; the pane never writes `doc.source` on each keystroke.
  A new page reaches the editor through `doc.generation` (incremented on open,
  reset and close) or a new pane instance, and `setPage` gives it a fresh
  history. `markdown()` gives back the text it was handed while nothing
  changed, and `null` before any page, so saving falls back to the file's
  text and never writes an empty editor over a page.
- **A locked page refuses edits in a transaction filter**, so no path (paste,
  drop, a menu command) gets round it. Loading a page replaces the editor's
  state rather than dispatching, so the filter never sees it.
- **Code in the page is page text, not an editor inside the page.** A code
  block is ProseMirror text coloured by decorations from the canvas code
  blocks' own parsers (`canvas/code/highlight.ts` `toRanges`), so undo is one
  history and focus never moves between editors. The section below on an
  embedded CodeMirror applies only if a diagram block is built.
- **Folding is not page content.** Which toggles are folded lives in
  decorations (`docs/fold.ts`) and in `localStorage` per page, inside
  try/catch; a fold must never be an attribute, or folding would mark the
  page unsaved.
- **Pane state read inside a closing handler is read before it is cleared.**
  A `{@const open = x}` follows `x`: set `x = null` and `open` is null too, so
  a handler reads what it needs from `open` first.
- **Tables come from `prosemirror-tables`, with Bava's own merge and header
  toggles.** A cell holds one paragraph, so the package's merge (which joins
  cells as separate paragraphs) would drop all but the first cell's text:
  `tables.merge` joins the texts with line breaks first. Its header toggles
  flip the corner cell; Bava's keep the header row and column independent.
  The writer picks the table's form on every save (`needsHtml`).
- **A cell selection must survive the browser.** Two ways the browser
  replaces one: WebKit on macOS selects the word under a right-click, and
  after a drag the browser's own text selection is read back a moment after
  the mouse is released. The editor holds the cells through a right-click on
  them, and `keepDraggedCells` keeps them until the next click or key. Both
  were seen only at a real window or under load, so they have unit tests
  that stand in for the browser.
- **ProseMirror's own stylesheets are loaded** (`prosemirror-view`'s and the
  gap cursor's): they hide the browser's highlight while cells or a node are
  selected, and draw the gap cursor.
- **The formatting bubble follows focus.** It shows for a text selection only
  while the page has focus: a selection left by find is not one to format.

## The diagram block
A diagram is a custom ProseMirror node type whose NodeView hosts a CodeMirror
instance holding the D2 source, plus a container for the rendered SVG.

**Read ProseMirror's own embedded code-editor example before changing this
seam.** It solves three things that are non-obvious and easy to get subtly
wrong:

- **Escaping the inner editor.** Arrow-up on CodeMirror's first line must move
  the cursor into the ProseMirror doc above, not sit there. Wired via
  CodeMirror keymap handlers dispatching ProseMirror selection transactions.
- **Undo across the boundary.** Two independent history plugins make Ctrl+Z
  unpredictable. CodeMirror changes are forwarded as ProseMirror transactions
  so there is one history.
- **Focus tracking.** Which editor is active, so toolbars and menus reflect
  the right context.

Budget real time here. It is the fiddliest part of the frontend and plausible-
looking wrong implementations are easy to produce.

## Compiler errors
D2 diagnostics come back from `Render` with positions. Surface them through
`@codemirror/lint` in the source pane and in `ErrorList`. Clicking a
diagnostic jumps to the line; that mapping comes from the render response,
never from re-parsing in the frontend.