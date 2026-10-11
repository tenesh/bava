# Editors

Rules for the page (ProseMirror, `docs/`) and the D2 editor (CodeMirror,
`editor/`).

## Mounting
Mount in `onMount`, destroy in the cleanup return, never feed reactive props
or a `$derived` in. `DocEditor` (`docs/editor.ts`) is a plain class owning one
view; never a Svelte component per block.

## The file is Markdown both ways
`docs/markdown.ts` reads and writes. What the schema cannot hold becomes a
`kept` block or `keptInline` run, byte for byte; never drop or fix it. Front
matter is copied verbatim except the lines under `bava:`.

## Saving reads the editor
`doc.bindSource(read)` makes save take the editor's Markdown. `markdown()`
returns the text it was given until something changes, and `null` before any
page, so save never writes an empty editor over a page.

## A new page arrives through `doc.generation`
Incremented on open, reset and close (or a new pane). `setPage` gives a fresh
history.

## A locked page refuses edits in a transaction filter
So paste, drop and menu commands cannot get round it. Loading a page replaces
state rather than dispatching, so the filter never sees it.

## Code in the page is page text
Coloured by decorations from `canvas/code/highlight.ts` (`toRanges`), so undo
stays one history and focus never moves between editors.

## Folding is not page content
Folds live in decorations (`docs/fold.ts`) and per-page `localStorage` in
try/catch. A fold attribute would mark the page unsaved.

## Read closing state before clearing it
`{@const open = x}` follows `x`: after `x = null`, `open` is null too. A
floating panel shows a copy (`{#each x ? [x] : []}`), never `{@const}` of state
its own close clears.

## Tables merge and toggle Bava's way
A cell holds one paragraph, so `tables.merge` joins texts with line breaks
(the package's merge would drop text). Header row and column toggle
independently. The writer picks the table form on each save (`needsHtml`).

## A cell selection must survive the browser
WebKit selects a word on right-click, and a drag's text selection is read back
after release. The editor holds cells through a right-click, and
`keepDraggedCells` keeps them until the next click or key.

## ProseMirror's own stylesheets are loaded
`prosemirror-view`'s and the gap cursor's: they hide the browser highlight on
cell or node selections and draw the gap cursor.

## The formatting bubble follows focus
It shows for a text selection only while the page has focus (not for find).

## One way to add a block
⌘Enter / ⇧⌘Enter add an empty block after or before the nearest block that
allows one (`docs/lines.ts`). A new block kind gets a row in `lines.test.ts`,
not its own key.

## The page always ends with an empty line
`endsWithALine` and `endLinePlugin` keep it; it is never saved or counted
(`textWithoutEndLine`). Tests use `atTextEnd`, never `Selection.atEnd`.

## One reader decides what a link is
`pageLinks` in `markdown.ts` finds links and their places; renames rewrite
closed pages from those (`page-links.ts`). Never a second parser.
`testdata/fixtures/links/pages.json` pins cases; add every surprise.

## A rewrite touches only the address
And words still reading the old name. A link whose place cannot be found
exactly is left alone and the page named, never guessed.

## Backlinks and missing links are read, never written
The editor holds the Space's pages (`setSpacePages`), refreshed on page open,
`@` menu open, window focus and page moves.

## A media block is drawn once and changed in place
`docs/media.ts`: `update` sets new settings on the same elements so a playing
video keeps playing; never return `false` for a settings change. `stopEvent`
and `ignoreMutation` leave the player alone.

## Media loads from the file route
`mediaUrl`, never `file://` or a bound call, only inside the opened folder; or
from its web address. A web video uses `preload="none"`; a failed web file is
never probed. Addresses follow moves (`kind: 'media'` / `'poster'`).

## An online video loads no player until play
`onlineView` shows the thumbnail; play opens a sandboxed frame, or the browser
where the site refuses (`playsInPage`). Ids are limited to letters, digits,
`-` and `_` before reaching the player address (`online-video.ts`).

## Cards
A web card's details are fetched once in Go (`internal/web`) and saved;
drawing fetches nothing. A file card reads size and date each time, never
writes them. `FileService.OpenFile` opens only listed document types.

## Media dragged in
Arrives as `application/x-bava-attachment` (its name) and is placed, never
copied again (`handleDrop`).

## jsdom never reaches a node view's event hooks
It lays nothing out, so call `stopEvent` and `ignoreMutation` on the node view
directly in tests.

## Open a field from a menu item a frame later
Ark's menu can refocus itself in the frame an item is chosen, stealing focus.

## Diagnostics come from Render
`editor/diagnostics.ts` maps `Render`'s positions onto `@codemirror/lint`;
never re-parse in the frontend.
