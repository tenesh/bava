# Milestone 8: Documents, decisions

Worked out with the user one question at a time, before any plan
(`.claude/plan/roadmap.md`, Milestone 8). Each decision is dated; a later one
that changes an earlier one says so.

## To do once the discussion is finished

**Design pass in Claude Design** (the user's request, 2026-09-27; wait
until every Milestone 8 question is settled, then do it before the plan):
the user's design project,
https://claude.ai/design/p/28e3aa53-6138-47bd-9f8d-73729df2431a
- Design everything decided here properly: the Space, the Files tree
  (order by hand, trash, duplicate), the Media section and dialog, the
  attachment menu on a page, the Notion-like Document and whatever blocks
  are chosen.
- Update the project's existing designs to match the app as it is now: they
  are out of date (the canvas, toolbars and settings have moved on since
  they were drawn).
- Mockups are reference, not spec: the code and these decisions stay the
  source of truth.
- **Done 2026-09-27, as a Design artifact** (the user chose mockups made
  here over a brief for Claude Design): **Bava Design**,
  https://claude.ai/artifact/RMvLeKBkbF4N2Hv89HSude, pinned in the user's
  sidebar. Nineteen screens on a Light page and the same nineteen on a
  Dark page: Spaces and the shell, the Document, Media, Trash and
  Templates, export, import and states, the Canvas, Settings (redesigned
  with a section list) and the app's existing dialogs (Diagram from Code,
  Canvas export, launch and About, shortcuts, errors and prompts). Built on
  Bava's own tokens, Geist and the panda mark. AI chat mockups come later
  (the user, 2026-09-27).

## Decisions

### 1. The editor is Notion-like; Markdown is never shown (2026-09-27)

The user: "I am looking for something like Notion and prefer not to see
markdown when editing so non developers can use this app."

- The document is edited as formatted text. No Markdown marks (`#`, `**`,
  `-`) are visible while editing, not even on the line being edited.
- The editor is **ProseMirror**, as `CLAUDE.md` already names. Carta (a
  Markdown text editor with a preview) and CodeMirror's live preview (marks
  shown on the line being edited) were considered and set aside: both show
  Markdown syntax.
- The file on disk stays Markdown (non-negotiable 2). ProseMirror writes the
  document back out as Markdown, so hand-written Markdown can come back
  normalised; decision 51 accepts that (saving tidies the whole page).

### 2. Documents live in a collection, as Obsidian's vault (2026-09-27)

The user: "Lets do vault but use different name or concept." A folder the user
opens as the root of their work, which Bava treats as one collection: links
between pages that survive renames, backlinks, a home for attachments. (Pages
inside pages were later ruled out, decision 7; search waits for Milestone 15, decision 58.) The
files stay plain Markdown; the
collection is just the folder. Its name, and whether loose single files can
still be opened, are the next questions.

### 3. It is called a Space (2026-09-27)

The user chose "Space": Open Space, recent spaces. Chosen over Workspace
(Notion's word for a team account, which Bava has none of), Project and
Library. The code's `workspace` names are renamed when Spaces are built.

### 4. Spaces and single files (2026-09-27)

The user chose both, as Obsidian: a Space opens a folder as a collection; a
single `.md` file still opens and edits on its own, as it does today. Links,
backlinks and search work only inside a Space.

### 5. A Space's own data is split by kind (2026-09-27)

The user chose: what is part of the work (page order, the Space's settings)
lives in one small readable file inside the Space, so it
travels with the folder and diffs like the documents; personal conveniences
(last open page, expanded folders) stay outside, in Bava's own settings. This
keeps non-negotiable 2: work in files the user can read, Bava's state
outside. The file's name and format are decided with the file format.

### 6. Attachments go in one folder per Space (2026-09-27)

*Refined by decision 10: the folder is hidden, and pages use nothing else.*

The user chose one attachments folder at the top of the Space for inserted or
pasted images, videos and PDFs; moving a page moves no files. Its name is
part of the Space's own file (decision 5). A single file opened outside a
Space: see decision 52.

### 7. Folders and pages, as a file system; no sub-pages (2026-09-27)

The user: "I am inclined to filesystem where you can create folders and
pages. Folders can have subfolders but not pages." Read as Obsidian's model:
a Space holds folders and pages; a folder holds subfolders and pages; a page
never holds pages (no Notion sub-pages). What the tree lets a user do is
decided in decision 9; attachments in decision 10.

### 8. The words: Space, Folder, Page, Document and Canvas (2026-09-27)

The user chose: a **Space** holds **Folders** and **Pages**; a Page has two
halves, its **Document** (the writing) and its **Canvas** (the drawing), as
the View menu's Document | Both | Canvas already says. These words are used
in the interface, the docs and the code.

### 9. The tree: basics, order by hand, Bava's own trash (2026-09-27)

- Always: create, rename, delete and move pages and folders; folders in
  folders; collapse and expand.
- **Ordered by hand**, as Notion's: drag to arrange; new items go at the
  end. The order is saved in the Space's own file (decision 5), so it
  travels with the folder.
- **Bava's own trash**: a deleted page or folder goes to a Trash in the
  Space, browsed and restored from inside Bava, kept until emptied
  (decision 70; first decided as 30 days). Kept
  as a folder in the Space (its name, and whether the tree hides it, are
  decided with the file format).
- **Duplicate page** (its Document and Canvas, beside it). The user did not
  choose page icons, favourites or a recent-pages list (2026-09-27).
- The tree shows pages and folders only (decision 10); the trash is
  `.bava/trash` (decision 53).

### 10. Attachments live in one hidden folder per Space (2026-09-27)

This refines decision 6. The user weighed keeping a page's files beside it in
the Space (Obsidian), a hidden folder managed by Bava (Notion's feel), a
bundle per page, the file itself, and Bava's own storage (ruled out by
non-negotiable 2). The chosen form:
- Pasted and inserted files go into **one hidden attachments folder for the
  whole Space**, so the tree shows pages and folders only.
- **Pages use the attachments folder only** (confirmed by the user,
  2026-09-27, replacing an earlier "use files in place" idea): inserting any
  file, from anywhere, copies it there. Files a user drops into the Space by
  hand are ignored by Bava: not in the tree, not in Media.
- A name is never overwritten: a different file with the same name is saved
  numbered (`logo 2.png`); an identical file is reused, stored once; a
  pasted image with no name gets a dated one (`Pasted image 2026-09-27
  14.32.05.png`).
- Renaming an attachment inside Bava keeps every link working; one renamed
  or removed outside Bava shows as missing, with an offer to relink by name.
- Dot-folders are hidden on macOS and Linux, not in Windows Explorer.
- Sending one page on its own is an **Export page** command (the page with
  its files, or a PDF), not a property of the folder layout.
- **The Files tree shows pages and folders only** (the user's choice).

### 11. Attachments are kept until cleaned up; a Media manager (2026-09-27)

- Removing an image, video or PDF from a page never deletes its file: it
  stays, marked **Unused**, so undo always works.
- **On the page**, an attachment's menu: Rename file (every page follows),
  Replace, Show in Finder / Explorer, Delete (from this page).
- **A Media manager** for the Space: every attachment with a thumbnail,
  size and the pages that use it; rename, delete, reveal; filters by kind
  (images, videos, PDFs, other) and **Unused**; search by name; sort by
  name, size or date added; grid or list; upload without placing on a page;
  and an action that finds unused attachments and moves them to Bava's
  trash (restorable until the user deletes them: decision 70 dropped the
  30-day period).
- **Laid out in two places:** a Media section stacked under Files in the
  side pane (collapsible, resizable, compact; drag an item into the page),
  and a button on it opening a large Media dialog for tidying up.

### 12. Text blocks: the basics, six heading levels, lettered and roman lists (2026-09-27)

In: paragraphs and line breaks, **headings 1 to 6**, bulleted lists,
**numbered lists in `1.`, `a.` and `i.` styles**, to-do lists, quotes and
dividers. All plain Markdown except the lettered and roman styles, which
CommonMark does not have: their form in the file is decided with the file
format (for example HTML `<ol type="a">`).

### 13. Callouts follow Confluence's panels (2026-09-27)

The user: "Follow what Confluence has." Confluence Cloud's panels: **Info**
(blue), **Note** (purple), **Success** (green), **Warning** (orange),
**Error** (red), and a **custom** panel with any colour from the palette and
any emoji or no icon
([support.atlassian.com](https://support.atlassian.com/confluence-cloud/docs/insert-the-info-tip-note-and-warning-macros/),
[community.atlassian.com](https://community.atlassian.com/forums/Confluence-questions/Panels-Info-Note-Error-Success-Warning/qaq-p/1632781)).
Proposed form in the file, decided with the file format: the callout syntax
`> [!info]`, which Obsidian displays for all five kinds; GitHub displays
Note and Warning and shows the rest as quotes. The custom panel's colour and
icon need a Bava addition to it.

### 14. Toggle lists and toggle headings (2026-09-27)

*Toggle headings reversed by decision 91: the toggle list is the one fold.*

Both, each opening on its own (not accordion groups): a **toggle list** folds
the content indented inside it; a **toggle heading** folds its section, up to
the next heading of its size. A toggle list is stored as HTML `<details>`,
which GitHub and most viewers also fold. For a toggle heading, the file
format decides between marking the heading (so it stays a heading
elsewhere) and letting every heading fold, with the fold state kept outside
the file as a convenience, as Obsidian does. In the Document, a fold is the
HTML `<details>` element drawn by ProseMirror; elsewhere in the app, Ark UI's
Collapsible and Accordion.

### 15. Block colours, from Bava's palette (2026-09-27)

A whole paragraph, heading or list can take a text colour or a background
colour, from the named swatches the canvas uses, so they adapt to light and
dark theme. Stored as a small HTML addition carrying the swatch name; other
viewers show the text uncoloured.

### 16. Nesting: lists and quotes only (2026-09-27)

Tab nests list items (and content inside toggles and quotes), as Word and
Google Docs do; not Notion's indent-anything, which Markdown cannot hold.

### 17. Empty lines close up (2026-09-27)

Extra blank lines are not kept as empty blocks: spacing comes from the blocks
themselves, and the file stays clean Markdown. An empty line still exists
while typing; it is dropped on save.

### 18. `>` then space makes a quote (2026-09-27)

As Markdown has it, not Notion's toggle; toggles come from the `/` menu (a
typing shortcut of their own is decided with the editing interactions).

### 19. Code blocks, as on the canvas, with copy, wrap and caption (2026-09-27)

A fenced code block with a language, highlighted by CodeMirror with the same
language list as the canvas's code blocks; a **copy button**; a per-block
**wrap long lines** switch; a **caption** under the block. Wrap and caption
are small Bava additions in the file, decided with the file format.

### 20. Rich tables, as Notion or Confluence (2026-09-27)

A grid with a header row and a header column, add, remove and drag rows and
columns, alignment, **merged cells, cell colours (from the palette) and
column widths**. A GitHub table cannot hold the rich options, so they need an
HTML table in the file. Proposed, decided with the file format: a table
using none of them is written as a GitHub table, readable everywhere, and
only one that uses them as HTML.

### 21. No columns (2026-09-27)

A Document stays one column; side-by-side layout belongs on the Canvas.

### 22. A contents list block; no margin outline (2026-09-27)

The user chose, after a mockup (since deleted):
a **contents block** inserted from the `/` menu, listing the page's headings
as links, kept up to date, saved, printed and exported. No floating outline
beside the page. Its form in the file (a placeholder the editor fills, or the
list written out) is decided with the file format.

### 23. Equations, as blocks and inline (2026-09-27)

TeX formulas drawn properly, on a line of their own (`$$...$$`) and inside a
sentence (`$...$`), forms GitHub and Obsidian also draw.

### 86. A table cell holds formatted text, never blocks (2026-09-28)

The user's choice, as Notion's tables: bold, italic, underline, strike,
code, links, colours, highlights, equations and line breaks, but no lists,
headings or other blocks. Both table forms hold that, so other apps show the
same table. A line break is `<br>`; in an HTML table, formatting is written
as HTML, which is all GitHub draws inside one.

### 24. A canvas embed is an image kept up to date (2026-09-27)

The user: "Document should show the image but its live?", confirmed as: the
Document shows part of the Canvas as an **image that Bava redraws by itself**
whenever those shapes change (at once in the Document; the image file on
save). The image is saved in the Space's attachments, so GitHub, Obsidian and
any viewer show the same current picture; the file references both the
frame and the image. Clicking it opens the Canvas with the frame selected
(the roadmap's decision: no editor inside the Document). Never stale, no
Update button. What it shows: a frame (decision 26); when the frame is
deleted: decision 27.

### 25. Code diagrams reach the Document as Eraser's do (2026-09-27)

`/` then Diagram from Code, in the Document, opens the same dialog, places the
D2 diagram on the page's Canvas, and embeds its live image (decision 24) in
the text at that spot. There is no document-only diagram block, and no
Mermaid rendering: a pasted Mermaid block stays a code block. As in Eraser
([docs.eraser.io/diagram-as-code](https://docs.eraser.io/diagram-as-code)),
one diagram lives on the Canvas and the Document shows it; unlike Eraser,
Bava keeps no live code (2026-09-17: D2 becomes ordinary shapes).

### 26. An embed shows a frame (2026-09-27)

A canvas embed is always of a **frame**: it shows whatever the frame holds as
it changes, shapes added later included. To embed something, draw a frame
round it. So Diagram from Code started in the Document (decision 25) places
its diagram inside a new frame, and embeds that frame.

### 27. An embed whose frame is deleted keeps its last picture (2026-09-27)

It shows the last image with a small "frame deleted" mark, never removed
silently (as a detached arrow); undo on the Canvas brings it back to life.
The image stays in attachments while the embed uses it.

### 28. No synced blocks (2026-09-27)

Not within a page and not across pages; they can come later.

### 29. No buttons (2026-09-27)

After a mockup (since deleted): no
add-content or link buttons; ordinary links still open web addresses. Can
come later.

### 30. Images: resize, align, caption, full screen (2026-09-27)

*Sizing changed by decision 54: an aspect ratio and a preset width, not
dragging.*

Inserted, pasted or dropped images (copied into attachments, decision 10)
can be **resized by dragging** (the width saved), **aligned** left, centre or
right, given a **caption**, and opened **full screen** (nothing saved).
Width, alignment and caption are stored in HTML (`<img width>` inside a
`<figure>` with a caption, or similar), decided with the file format.

### 31. Video files: play in the page, resize, align, caption, poster, loop and mute (2026-09-27)

*Sizing changed by decision 54.*

Added video files (copied into attachments) play in the page with the
webview's own player; they can be resized and aligned like images, given a
caption, a chosen poster frame (a still, saved as an attachment), and loop
and mute options for short demo clips. Stored as HTML `<video>` attributes.
mp4 (H.264) is the format that plays on every platform (see Media, below).

### 32. Online videos load on click (2026-09-27)

YouTube, Vimeo and Loom videos show a plain placeholder with the link; nothing
contacts the site until the user clicks play (non-negotiable 1: network only
when the user triggers it). Stored as an `<iframe>` (or the link) with its
size. Whether each plays inside Bava's webview is tested early, on all three
platforms.

### 33. Only images and videos are shown in the page; every other file is a link or card (2026-09-27)

The user: "only image and video should be loaded and viewed and every other
just be a link or simple card or extended card with meta". This replaces an
answer given a moment earlier (a PDF viewer in the page): **a PDF, like a
spreadsheet, zip or Word file, appears as a link or a card** and opens in its
own app; no bundled PDF viewer. The same user message added:
- **Online images can be added** (by address, as well as from files).
- **Online videos can be added** (decision 32: they load on click).
- **Videos never autoplay**, local or online; loop and mute (decision 31)
  apply once the user presses play.

### 34. Other files: link, simple card or extended card, chosen per file (2026-09-27)

A PDF, spreadsheet, zip or other file (copied into attachments) is added as a
**simple card** (icon, name, size); a menu on it switches to a **plain link**
or an **extended card** (type, size, date modified). Clicking opens it in its
own app. The chosen look is stored with it.

### 35. Online images are shown from the web (2026-09-27)

An image added by its web address keeps only the address (plain Markdown
`![](https://…)`); it is fetched each time the page is shown, needs the
internet, and breaks if the site removes it. The user chose this over
downloading a copy into attachments. Note on non-negotiable 1: the user
added the address, so the fetch is theirs, but it happens on every open,
unlike online videos (decision 32), which load on click; the site sees each
view. Audio files, having no viewer (decision 33), are cards.

### 36. Web links: a card, switchable to a link or an extended card, as files (2026-09-27)

The user: "Card just like file but can be switched to link or extended card
like file". A pasted web link becomes a **simple card** (the site's icon,
the page's title, the domain); its menu switches it to a **plain link** or
an **extended card** (adding the description and preview picture). Bava
fetches the page's details once, when the link is pasted (the user's
action), and saves them with the card, so opening the page fetches nothing
(the preview picture is saved in attachments). Without the internet at paste
time, it stays a plain link until switched again.

### 37. No web embeds (2026-09-27)

Live pieces of other sites (maps, Miro, Figma, CodePen) are not embedded;
they are links or cards (decision 36). Online videos (decision 32) are the
one exception, loaded on click.

### 38. Inline formatting (2026-09-27)

Bold, italic, strikethrough, inline code, links and inline equations, plus
**underline** (HTML `<u>`), **text colour** and **highlight** (from Bava's
palette, adapting to theme; HTML carrying the swatch name), and an **emoji
picker** (`:` and a name, or a panel; saved as the character itself).

### 39. Page links with @, and backlinks (2026-09-27)

Typing `@` (or `[[`) and a page's name links that page; the link is a normal
Markdown link to its file (relative path). Each page can show the pages that
link to it ("Linked from"), found by scanning the Space, nothing written to
the files. Links update when a page is renamed or moved inside Bava; a
link broken outside Bava shows as missing, with an offer to relink by name.
Inside a Space only (decision 4).

### 40. Date chips, no reminders (2026-09-27)

`@today`, `@tomorrow` or a typed date insert a date chip, changed with a
calendar picker; stored with the date written out, so other viewers read the
date. No reminders or notifications. `@` offers dates and pages (decision 39)
in one menu.

### 41. No comments for now; nothing that needs accounts (2026-09-27)

Comments wait for a later milestone (they need a design for authorship
without accounts). Out, since they assume other people and a service:
@person mentions, reactions, suggested edits, reminders.

### 42. Footnotes (2026-09-27)

Numbered automatically, their notes at the foot of the page; stored as
Markdown footnotes (`[^1]`), which GitHub and Obsidian show.

### 43. The core Notion interactions (2026-09-27)

The `/` menu and the `+` button to insert; Notion's typing shortcuts (`#` for
a heading, `-` for a list, `[]` for a to-do; `>` a quote, decision 18); a
formatting bubble on selected text; the ⋮⋮ handle to drag a block and open
its menu (turn into, duplicate, delete, colour); multi-block selection;
paste of Markdown and of spreadsheet cells into tables; undo and redo; find
in page. None of it is stored in the file.

### 44. Find and replace, word count, links to headings (2026-09-27)

**Find and replace** across the page; a **word count** (words and characters,
for the page or the selection); **Copy link to heading**, a link that jumps
to that heading from within the page or another page (a standard heading
anchor, `page.md#heading`, which GitHub also follows). Not chosen: moving a
block to another page.

### 45. Lock per page; page width app-wide with a per-page override; no font options (2026-09-27)

Asked one at a time:
- **Lock page**, per page, saved in the page: stops edits until unlocked, for
  anyone who opens the file.
- **Page width** (Narrow, Wide, Full): an app-wide default (a per-viewer
  preference, not in any file) that a page can override, saved in that page.
- **No font style** and **no small-text** option: pages use Geist; zoom
  already scales everything.

### 46. No page history (2026-09-27)

Undo while editing, Bava's trash for deletions (decision 9), and the user's
own backups or Git for anything older.

### 47. Own templates, in each Space, in a Templates view with groups (2026-09-27)

The user: "Own but we should organise and store it properly." No built-in
templates. A Space's templates live in a **hidden templates folder in the
Space**, managed by Bava like attachments: they travel with the Space and
reach teammates who share it; they are not in the Files tree. A **Templates
view** (like the Media dialog) creates, renames, edits, deletes and
duplicates them and sorts them into **groups** (Meetings, Design, …); New
page offers them by group, and a page's menu has Save as template. Each
template is an ordinary page file (Document and Canvas), so it diffs like
the rest.

### 48. Export a page, a folder or the Space, as PDF or a Markdown zip (2026-09-27, revisited)

Revisited with the user the same day; this replaces the first answer (PDF,
Markdown bundle, HTML).
- **What:** a page, a folder or the whole Space (right-click in the tree,
  or File ▸ Export Space). A folder or Space exports all its pages with the
  attachments they use.
- **Which part of a page:** chosen in the export dialog: Document, Canvas,
  or both (the Canvas as one large picture after the Document).
- **Formats: PDF and a Markdown bundle.** Not HTML, not Word.
- **PDF:** a folder or Space goes to one combined PDF (tree order, a
  contents page, bookmarks) or a folder of PDFs mirroring the Space, chosen
  in the dialog. Options: paper size and orientation, light or dark theme,
  margins and scale, page numbers.
- **Markdown bundle:** always a **zip**, laid out **exactly as in the
  Space**, its `.bava` folder (attachments) included, so it opens as a Space
  in Bava; other Markdown apps may not show the hidden folder's images.
- Built in Milestone 15 (decision 68).

### 49. Import Markdown files and folders, and Bava export zips (2026-09-27, revisited)

Revisited with the user the same day; this replaces the first answer
(Markdown and Notion exports). Notion exports and Obsidian vaults are not
imported as such (their Markdown files still come in as plain Markdown).
- **What:** Markdown files and folders, their images copied into
  `.bava/attachments`; and a **Bava export zip** (decision 48), merged with
  its attachments.
- **Where:** where the user chooses (right-click a folder ▸ Import, or
  File ▸ Import asks for a folder); imported pages keep their own folders
  beneath it.
- **Name clashes:** keep both; the imported page is saved numbered
  ("Launch plan 2"); nothing is overwritten. Attachments follow decision 10
  (identical files stored once, different ones numbered).

### 50. No AI and no databases in Milestone 8 (2026-09-27)

AI in the Document comes with Milestones 11 to 14; databases (Notion's tables
of pages) are a separate product and not planned.

### 51. Saving tidies the whole page (2026-09-27)

Resolves decision 1's open consequence. Every save writes the whole page's
Markdown in Bava's one consistent style; a hand-written file gets one tidy-up
change the first time Bava saves it (`*bold*` as `**bold**`, list markers
made consistent). Chosen over keeping untouched blocks byte for byte. The
style itself (which markers, spacing) is written into `docs/file-format.md`
with the file format, so it is predictable.

### 52. A loose page asks to become a Space before it takes media (2026-09-27)

Pasting or inserting an image, video or file into a page opened on its own
offers to open its folder as a Space; the Space's attachments folder is then
used. Declined, the media is not added. Text editing needs no Space.

### 53. Everything Bava manages in a Space sits in one hidden `.bava` folder (2026-09-27)

```
My Space/
  Marketing/
    Launch plan.md
  Roadmap.md
  .bava/
    space.json      page order and the Space's settings (decision 5)
    attachments/    decision 10
    templates/      decision 47
    trash/          decision 9
```

The Space's top level shows only the user's folders and pages; on Windows,
where dot-folders are not hidden, one `.bava` folder shows. Settles the
Space's own file (decision 5): `.bava/space.json`, its keys specified in
`docs/file-format.md` first. A page's own settings (lock, width override)
stay in the page.

### 54. Images and videos are sized by aspect ratio and preset width (2026-09-27)

The user: "i dont think we need adjust size like canvas. better approach is
using aspect ratio". Replaces dragging to size (decisions 30 and 31). From
the media's menu:
- **Ratio**: Original, 16:9, 4:3 or 1:1. Any ratio but Original fills that
  shape and crops the rest, centred, so a run of images lines up.
- **Width**: Small, Medium, Large or Full (of the page's column).
Nothing is stretched. Both are saved with the media in the page (the form
decided with the file format); alignment, captions, poster, loop and mute
stay as decided.

### 55. A Spaces start screen, and a switcher in the side pane (2026-09-27)

From the UI review. Opening Bava with no Space shows a **start screen**: recent
Spaces, **New Space** (make a folder), **Open Space** (pick a folder) and Open
file; next time Bava reopens the last Space. Inside a Space, its name sits at
the top of the side pane, above Files: clicking it opens the **Space
switcher** (recent Spaces, New Space, Open Space, Space settings), as
Notion's workspace switcher. A Space's name is its folder's name.

### 56. The title is inside the page; the tree shows the file name (2026-09-27)

A page's title is its first heading, part of its Document, set like any
text; the file's name is set separately, by renaming in the Files tree, so
the two can differ. The tree shows the **file name**, matching the disk.

### 57. Saving stays ⌘S, with autosave optional (2026-09-27)

As now: pages are saved with ⌘S; autosave stays a setting (Settings ▸ Files,
off by default). The Files tree marks a page with unsaved changes with a
dot.

### 58. Search across the Space waits for Milestone 15 (2026-09-27)

Nothing Space-wide in Milestone 8: search belongs to the roadmap's Milestone
15, Export and search. Find and replace within a page (decision 44) is in.

### 59. Backlinks at the bottom of the page (2026-09-27)

A "Linked from" list after the page's content, as Obsidian can show it,
listing the pages that link to this one (decision 39); shown only in a
Space, and only when there are any.

### 60. The page's ⋯ menu, and the word count in the status bar (2026-09-27)

A **⋯ menu** at the top right of the page: Lock / Unlock, Page width (this
page), Duplicate, Save as template, Export…, Copy link, Move to Trash; the
same actions on the page's right-click menu in the Files tree. The **word
count** sits in the status bar while the Document is shown: the page's
words, or the selection's when text is selected.

### 61. Embedding a frame: from either side, from any page in the Space (2026-09-27)

- **In the Document:** `/` then Embed frame lists frames by name with
  thumbnails: this page's first, then other pages' in the Space.
- **On the Canvas:** right-click a frame ▸ Embed in Document puts it at the
  Document's cursor (this page).
- A frame from another page stays live (decision 24); clicking it opens that
  page on its Canvas with the frame selected; renaming or moving that page
  in Bava keeps the embed. A loose page (decision 4) embeds only its own
  frames.

### 62. The Canvas does not show Documents (2026-09-27)

No page cards or document views on the Canvas; Both view puts a page's
Document and Canvas side by side.

### 63. Trash and Templates open as dialogs from the side pane (2026-09-27)

*Changed the same day by the user: "remove templates and trash from the side
pane. It should be accessible from the app menu which opens the dialogs or
placed elsewhere." They open from the native app menu (File ▸ Templates,
File ▸ Trash) and from the Space switcher's menu; the side pane has no
buttons for them.*

Buttons at the bottom of the side pane open a large **Trash** dialog (browse,
restore, delete for good, empty; items older than 30 days go by themselves)
and the **Templates** dialog (decision 47), in the same pattern as the Media
dialog (decision 11).

### 64. One page open at a time (2026-09-27)

Clicking a page in the tree opens it in place, as Notion. Leaving a page with
unsaved changes asks to save (decision 57), unless autosave is on. No tabs.

### 65. Space settings (2026-09-27)

From the Space switcher: **Rename the Space** (renames its folder), **Default
page width** for the Space's pages, and **Reveal in Finder / Explorer**. (A
trash period was dropped by decision 70.) The default width is saved in
`.bava/space.json`, shared with the Space. Page width then resolves
page's own, else the Space's default, else the app-wide default (decision
45).

### 66. Tags on pages, with a Tags section (2026-09-27)

Asked by the user after the first mockups. A page can have several tags,
added under its title and stored in the page's front matter as a plain list
(`tags: [launch, q4]`), readable by Obsidian and other Markdown tools.
- **No tag colours:** every tag is a plain grey chip.
- **A Tags section** in the side pane lists every tag in the Space with its
  page count; clicking tags filters the Files tree to the pages that have
  **all** the chosen tags.
- **A tag's menu:** Rename (on every page), Merge into another tag, Delete
  (from every page; the pages stay).
- Inside a Space; a loose page keeps its tags but has no Tags section.

## Cloud, discussed (2026-09-27, no decision)

The user asked what cloud features (sync, sharing, live collaboration) would
take. Discussed: sync through iCloud, Dropbox or Git works on plain files
today; live collaboration needs a server whoever runs it; a Bava cloud would
need non-negotiable 1 changed (and cloud-only, non-negotiable 2 too); LLM
keys can stay on the device either way; a community plugin system (as
Obsidian's) would let others build sync without a Bava service, and is its
own future milestone. Nothing changes for Milestone 8. Proposed for its
plan, to keep those doors open at little cost: stable block ids in the
Document (in memory, not in the file), every file change through one place
in Go, commands in one registry, settings sections kept pluggable.

### 67. Milestone 8 is built in six parts (2026-09-27)

8.1 Spaces and files; 8.2 the Document editor; 8.3 rich blocks; 8.4 media and
attachments; 8.5 the Canvas in the Document (carrying the roadmap's exit
criterion); 8.6 tags and templates. Each is planned, gated and committed on
its own, its file-format changes specified first. The roadmap lists them.

### 68. Export and import go to Milestone 15, moved up to follow Milestone 8 (2026-09-27)

Decisions 48 and 49 are built in Milestone 15 (Export, import and search),
which now comes straight after Milestone 8, before Icons and AI, keeping its
number. Search across a Space (decision 58) is there too.

### 69. 8.1 details: new pages, .d2 files, restoring, the folder's name (2026-09-27)

Settled while planning 8.1, one question at a time:
- **A new page is named in the tree first:** a row appears with "Untitled"
  selected; the user types the file name, presses Enter, and the page opens
  with the cursor in its empty Document.
- **`.d2` files are hidden from the Files tree** (pages and folders only,
  decision 10); File ▸ Open File still opens one.
- **Restoring from the Trash recreates the original folder** when it has
  gone, so an item always returns to the exact path it came from.
- **The hidden folder stays `.bava`** (as `.git`, `.vscode`, `.obsidian`).
  `docs/file-format.md` rejects a `.bava/` directory only as a place for a
  page's canvas, which would be lost when one file is copied; `.bava` holds
  Space data, never a page's text or canvas, so that reasoning stands, and
  8.1 rewords the passage to say so. The one thing that can be separated
  from a copied page is its attachments (decision 10's trade-off); a missing
  file is never silent, and proposed for 8.4: Bava relinks a broken
  attachment by name in the attachments folder by itself.

### 70. The Trash never empties itself (2026-09-27)

The user: "Since its local app, do we need to delete?" Changes decisions 9,
63 and 65. Deleted items stay in `.bava/trash` until the user deletes them
there or presses Empty Trash, as the Finder's Trash does; the Trash dialog
shows its total size. No trash period, so Space settings has none. The
30 days came from Notion, which empties its trash for its own server
storage; a local app has no such reason. Known cost: the Trash is inside
the Space, so folder sync and Git carry it until emptied.

### 71. 8.1 details: ⌘O, a loose page's side pane, ⌘N (2026-09-27)

- **⌘O / Ctrl+O is Open Space**; Open File moves to ⇧⌘O / Ctrl+Shift+O.
- **A page opened on its own** shows, in the side pane, "This page isn't in
  a Space" with an Open folder as Space button; no tree.
- **⌘N / Ctrl+N with a Space open** makes a page beside the open page (at
  the top of the Space when none is open), named in the tree first
  (decision 69). With no Space open it makes an untitled page, as today.

### 72. New Space asks for a name and a place (2026-09-27)

- **One dialog:** the Space's name, and its Location (starting beside the
  open Space; Choose opens the folder picker). Bava makes the folder there
  and opens it; a taken name is refused, never merged. Open Space still
  opens an existing folder.

### 73. The Files header, and Space settings apply on Save (2026-09-27)

- **Files header:** a chevron folds the section (remembered per viewer);
  one Add menu holds New page and New folder.
- **Space settings** hold the name and page width until Save; Cancel, the
  close button and Escape discard. The width keeps a "Your setting" option.

### 74. The status bar follows what is being worked on (2026-09-27)

- The Space and the page path, then the canvas's engine and node count
  while the canvas is worked on, or the document's words and characters
  while the document is. In Both, the side last pressed or focused.

### 75. A page's settings live in a header at the top of its file (2026-09-27)

- Lock and the page's own width (decision 45) are written in the page's
  front matter, the lines between `---` marks at the very top, under a
  `bava:` key (`locked: true`, `width: wide`). Other editors hide it or show
  it as a small table; Obsidian calls it Properties. Tags (decision 66) will
  go in the same header, as a plain `tags:` list other tools read too.
- Keys Bava does not know are kept as they are.

### 76. Formatting Markdown lacks is written as invisible marks and small HTML (2026-09-27)

- Lettered and roman lists (decision 12) and block colours (decision 15) stay
  ordinary Markdown with an invisible HTML comment just before them, such as
  `<!-- bava: list=a -->` or `<!-- bava: color=blue -->`.
- Underline, text colour and highlight (decision 38) are small inline HTML
  tags around the words: `<u>`, `<span data-color="blue">`,
  `<span data-highlight="yellow">`. Other viewers show the text; only the
  styling is lost.
- Chosen over whole HTML blocks, which stop the Markdown inside them from
  being Markdown in many editors.

### 77. 8.3 is built in three parts (2026-09-27)

The user's choice, so each is planned, checked and committed on its own:
**8.3a** blocks inside a page (callouts, toggles, code blocks, equations,
footnotes, the contents block, emoji); **8.3b** rich tables, with
spreadsheet paste; **8.3c** links between pages (`@` page links, backlinks,
links to headings) and date chips, which need the Space scanned.

### 78. A custom callout keeps its colour and icon in an invisible mark (2026-09-27)

The user's choice. A custom panel (decision 13) is a note callout with the
invisible mark of decision 76 above it: `<!-- bava: color=purple icon=🚀 -->`
then `> [!note]`. The icon is an emoji at the callout's left, as the named
kinds have theirs; other apps show a plain note box. The five named kinds are
`[!info]`, `[!note]`, `[!success]`, `[!warning]` and `[!error]`.

### 79. Only headings made toggles fold (2026-09-27)

*Reversed by decision 91: there are no toggle headings.*

The user's choice, as Notion: "Toggle heading" is chosen from the `/` menu or
the block menu, and marked with the invisible mark `<!-- bava: toggle -->`
above the heading. Other apps show an ordinary heading with its section
visible. Toggle lists stay HTML `<details>` (decision 14).

### 80. Folding is remembered on this computer, never saved (2026-09-27)

*Toggle headings are gone (decision 91); this holds for toggle lists.*

The user's choice. Folding or unfolding a toggle list or toggle heading does
not change the file or mark the page unsaved; Bava remembers what was folded
on this computer, as it remembers pane sizes. A toggle it has no memory of
starts folded, or open when the file says `<details open>`, which is kept
as written.

### 81. A code block's wrap and caption go in an invisible mark (2026-09-27)

The user's choice: the invisible mark above the fence, as colours and toggles
have, `<!-- bava: wrap caption="Start the server" -->`. The fence itself
stays plain (`` ```go ``), so every app shows and colours the code as
before; the caption shows only in Bava.

### 82. The contents block is written out as a list (2026-09-27)

The user's choice. The file holds the list of links itself between two
invisible marks, `<!-- bava: contents -->` and `<!-- bava: /contents -->`,
rewritten on every save, so GitHub, Obsidian and exports show a working
contents list. Links use the standard heading anchors (`#goals`), which
GitHub also follows.

### 83. The `/` menu: one list, three groups (2026-09-28)

The user's choice after testing. One flat list with a label and a divider
between its groups, never a submenu; typing filters the whole list and a
group with nothing left hides its label.

- **Basic:** Text, Heading 1 to 6, Bulleted list, Numbered list, To-do
  list, Toggle list, Quote, Divider.
- **Advanced:** Callout, Code, Equation, Contents.
- **Inline:** Inline equation, Footnote, Emoji.

One Callout item inserts an Info callout; its kind (Info, Note, Success,
Warning, Error, Custom) is switched from the block menu. Lettered and roman
lists are a Numbered list's style, switched from the block menu. A toggle
heading is any heading switched to one from its block menu. Turn into never
lists the kind the block already is.

### 84. Turn into only within a family (2026-09-28)

The user's choice. Text and Heading 1 to 6 turn into one another; a
Bulleted, Numbered or To-do list turns into another of those three, the
whole list at once. Every other block has no Turn into: Quote, Toggle list,
Callout, Code, Equation, Divider, Contents, footnotes and kept blocks. They
keep their own switches (a callout's Kind, a code block's language, a
heading's toggle, a numbered list's Numbering); the callout's "Turn into
quote" goes. Enter in a footnote stays a new line in that note, as Google
Docs and Word do.

### 85. A table is a Markdown table until it uses a rich option (2026-09-28)

The user's choice, as decision 20 proposed. A table with only a header row,
cell text and column alignment is written as a Markdown (GitHub) table. Once
it uses a rich option (merged cells, a cell colour, column widths, a header
column or no header row), the whole table is written as an HTML `<table>`, which GitHub and
Obsidian also draw.

### 87. A date chip is a date tag around the readable date (2026-09-28)

The user's choice: `<time datetime="2026-10-02">2 Oct 2026</time>`. Bava
reads the exact date from `datetime`; other apps show the readable date as
plain text. A date typed as ordinary text never becomes a chip.

### 88. A page link's text follows the page's name, unless reworded (2026-09-28)

The user's choice, as Obsidian. A page link is `[Launch plan](../Marketing/Launch%20plan.md)`:
the path relative to the linking page, spaces and other characters a
Markdown link cannot hold written as `%20` and so on, which GitHub and
Obsidian both follow. Its text starts as the page's file name. When the page
is renamed or moved inside Bava, every link's path is updated, and its text
too wherever it still reads the old name; a link reworded by hand keeps its
words.

### 89. One reader decides what a link is (2026-09-28)

The user's choice, after two reviews found Bava's file side and its
Document disagreeing on what counts as a link (29 of 113 unusual pages,
two of them layouts Bava writes itself). The Document's own Markdown reader
finds and rewrites links in every page, closed ones too, changing only
their addresses (and their words where they follow a rename). The file side
lists the pages with their text and writes back a page only when it is still
as it was read. The two can never disagree; a rename in a large Space takes
a moment longer.

### 90. A line before or after any block, and always a line at the end (2026-09-28)

The user's choice, after finding no way out of a table at the end of a page.
The page always ends with an empty line, which is never saved (decision 17).
One way works for every block: ⌘Enter adds an empty line after the nearest
block that can have one beside it, ⇧⌘Enter one before, as ProseMirror
editors leave a code block and as Notion's `+` works on the block it is
beside. The block menu and the handle's `+` (⌥ for above) do the same.

### 91. No toggle headings (2026-09-28)

The user's choice, reversing decision 79. A toggle heading folded every block
after it up to the next heading of its size, so a line after a folded heading
was hidden too; Notion's toggle heading holds only what is put inside it,
which Markdown cannot hold without a second mark. A toggle list folds what
is inside it and nothing after, so it is the one fold. A heading carrying the
old `<!-- bava: toggle -->` mark keeps it as written (an unknown key) and no
longer folds.

### 92. An image is a Markdown image with a mark (2026-09-28)

The user's choice: `![alt](.bava/attachments/editor.png)`, with Bava's
settings in the invisible mark above it, as callouts and code blocks have:
`<!-- bava: width=medium ratio=16:9 align=center caption="The new editor" -->`.
Every Markdown app shows the image; only Bava applies the width, ratio,
alignment and caption.

### 93. A video file is written as an image, with a mark (2026-09-28)

The user's choice: `![Demo](.bava/attachments/demo.mp4)`, the image form
pointing at the video, its settings in the mark above:
`<!-- bava: width=large poster=".bava/attachments/demo-poster.png" loop muted -->`.
Obsidian plays it; GitHub shows a broken-image icon with the alt text; Bava
plays it with its poster, looped and muted as set.

### 94. An online video is written as an image, with a mark (2026-09-28)

The user's choice, the same shape as a video file: `![Launch demo](https://www.youtube.com/watch?v=abc123)`
with its settings in the mark above. Obsidian embeds the player; GitHub
shows a broken-image icon; Bava shows a placeholder and loads the video only
when play is pressed (decision 32).

### 95. A card is a link with a mark (2026-09-28)

The user's choice: an ordinary link, its text the file's name or the page's
title, with the card's look in the mark above (`card`, or `card=extended`)
and a web card's saved details there too (`description`, `icon`, `image`,
the pictures saved in the attachments). A plain link has no mark. A file's
size and type are read from the file, never written. Other apps show a
working link.

### 96. A missing attachment is offered for relinking, never relinked by itself (2026-09-28)

The user's choice, settling decisions 10 and 69 (which differed): media
whose file is gone shows as missing, with "Relink to <file>" when a file of
that name is in the attachments. Nothing changes until it is pressed, as for
a missing page link.

### 97. 8.4 is built in three parts (2026-09-28)

The user's choice, as 8.3 was: **8.4.1** the attachments folder, images and
video files with their settings, relinking; **8.4.2** online videos and file
and web-link cards (the only part using the network, on the user's paste or
click); **8.4.3** the Media section and dialog. Named 8.4.1 to 8.4.3 because
8.4a is the canvas checks that follow.

## Features

Chosen from Notion's editor, one question at a time (decisions 12 to 50),
from the inventory in `notion-editor-features.md`. The discussion finished
on 2026-09-27; next is the design pass above, then the plan.

## Media, background (2026-09-27; the decisions are 30 to 37 and 54)

All feasible as custom ProseMirror blocks. Sizes, ratios and captions are
saved as HTML in the Markdown, since plain Markdown has no size.
- Images and local video: the file is copied into `.bava/attachments` and
  shown from there; mp4 (H.264) is the format that plays on every platform.
- YouTube or Vimeo: an iframe needing the internet; by non-negotiable 1 a
  click-to-load placeholder, not a request on every open. Whether they play
  inside Bava's webview must be tested early.
- PDF: shown inline would need a bundled viewer (Linux's webview has none);
  decided against (decision 33): a PDF is a link or card.
- Web pages in an iframe: many sites refuse to be framed; a link card is the
  reliable form. Office documents: an attachment opened in its own app.

## Open questions

- None from the discussion. Left to the file format, where each is
  specified before code writes it: the forms of lettered lists, callouts,
  toggles, colours, rich tables, media attributes, cards, date chips,
  contents blocks and embeds. (`.bava/space.json`'s keys are specified and
  built.)
