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

## Adding blocks, and the line at the end
- **One way for every block** (`docs/lines.ts`): ⌘Enter / ⇧⌘Enter add an
  empty block after or before the nearest block that can have one beside it.
  A new kind of block needs a row in `lines.test.ts`, not a key of its own.
- **The page always ends with an empty line** (`endsWithALine` on reading,
  `endLinePlugin` after each change). It is never saved and never counted:
  counts and copies read the text through `textWithoutEndLine`. Tests put the
  caret at the end of a page's text with `atTextEnd`, never `Selection.atEnd`.

## Links between pages
- **One reader decides what a link is.** The Document's own Markdown reader
  finds a page's links with where each sits in its text (`pageLinks` in
  `markdown.ts`), for the open page and every other alike: a rename rewrites
  closed pages from those places (`page-links.ts`), and Go only lists pages
  and writes one back when it is unchanged since it was read. A second
  parser on the file side disagreed with this one on 29 of 113 unusual pages;
  never bring one back. `testdata/links/pages.json` pins what is a link and
  where; add a case for every surprise.
- **A rewrite touches only a link's address, and its words where they are
  still the old name.** Every other byte of a page stays as it was. A link
  whose place cannot be found exactly is left alone and the page is named,
  never guessed at.
- **"Linked from" and missing links are read, never written.** The editor
  holds the Space's pages (`setSpacePages`) and asks for them again when a
  page opens, the `@` menu opens, the window regains focus, or pages move.
- **A floating panel shows a copy of what it opened for** (`{#each x ? [x] : []}`),
  never `{@const}` of state its own close clears: the calendar's pick read
  `null` that way.

## Images and videos
- **A media block is drawn once and changed in place** (`docs/media.ts`): its
  node view's `update` sets the new settings on the same elements, so a video
  that is playing keeps playing while the page is edited. `stopEvent` leaves
  the player's clicks and keys to the player; `ignoreMutation` ignores what
  the player does to its elements. Never return `false` from `update` for a
  settings change.
- **Its file comes from the app's file route** (`mediaUrl`), never a
  `file://` address or a bound call, and only at an address inside the
  opened folder; or from its own address on the web. A web image loads when
  shown; a web video loads nothing until play (`preload="none"`), and a web
  file that fails is never probed.
- **Its address follows moves like a link's** (`pageLinks` reports it with
  `kind: 'media'`, a poster with `kind: 'poster'`), and its words never
  change with it.
- **An online video contacts no one until play is pressed** (`onlineView`):
  its placeholder loads nothing, and play puts the site's player in a
  sandboxed frame. Its ids are checked to letters, digits, `-` and `_` before
  they reach the player's address (`online-video.ts`).
- **A web card's details are fetched once**, on the paste of its link or
  Refresh details, in Go (`internal/web`, bounded, no cookies), and saved:
  drawing a card asks the web for nothing. A file card reads its size and
  date from the file each time, and never writes them.
- **A card's click opens; a program never runs.** `FileService.OpenFile`
  opens only a document type on its list and shows anything else in its
  folder: a list of what may open, never of what may not.
- **Tests do not trust jsdom for events on a node view.** jsdom lays nothing
  out, so ProseMirror never reaches `stopEvent` or `ignoreMutation` from a
  dispatched event: call them on the node view itself.
- **A field or dialog opened from a menu item opens a frame later.** Ark's
  menu can focus itself in the frame an item is chosen, taking focus back
  from whatever the item opened.

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