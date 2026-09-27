# Notion page editor: feature inventory

What Notion's page editor offers, taken from Notion's help centre and public
developer docs (September 2026), so features can be chosen for Bava's document
editor. This covers the editor for a single page. Databases and workspace
features are listed briefly at the end.

How to read the columns:

- **In a Markdown file** says whether the feature can survive in a plain `.md`
  file:
  - **Markdown**: plain Markdown represents it.
  - **Extended**: a common extension represents it (GitHub-flavoured tables,
    task lists, footnotes, math with `$`, Mermaid code fences).
  - **Needs a Bava convention**: no Markdown form; it would need HTML, a
    comment, front matter or a fenced block to survive a save.
  - **Not a document feature**: needs a server, accounts or a database.
  - **Not stored**: an editing behaviour only; nothing is written to the file.
- **Network or account** is "yes" when the feature fetches from the internet
  or depends on accounts. Bava has no service of its own, so a "yes" means the
  internet is reached only when the user triggers it, or the feature does not
  fit.

A useful reference throughout: Notion publishes its own "enhanced Markdown"
([developers.notion.com/guides/data-apis/enhanced-markdown](https://developers.notion.com/guides/data-apis/enhanced-markdown)),
which shows how Notion itself writes each block as text. Where plain Markdown
has no form, Notion uses HTML-like tags (`<callout>`, `<columns>`,
`<details>`, `<span color>`), which is a hint for what a Bava convention could
look like.

## 1. Page frame

Sources: [customize-and-style-your-content](https://www.notion.com/help/customize-and-style-your-content),
[create-links-and-backlinks](https://www.notion.com/help/create-links-and-backlinks),
[keyboard-shortcuts](https://www.notion.com/help/keyboard-shortcuts)

| Feature | What it does | In a Markdown file | Network or account |
|---|---|---|---|
| Page title | Large title at the top of every page, separate from the body | Markdown (a first `#` heading, or a title field in front matter) | no |
| Page icon | Emoji, built-in icon or uploaded image shown beside the title | Needs a Bava convention (front matter) | no (yes for Notion's icon library if fetched online) |
| Page cover | Banner image across the top: gallery, upload, image link, or Unsplash search | Needs a Bava convention (front matter) | no for a local image; yes for Unsplash search or an image link |
| Sub-pages | A page nested inside another page, shown as a block that opens it | Needs a Bava convention (a link to another file plus a rule for where child files live) | no |
| Link to page | Block that links to another page in the workspace | Markdown (a link to another file) | no |
| Backlinks | Count under the title of pages that mention this one; click to list them | Not stored (computed by scanning files) | no |
| Breadcrumb | Block showing the path of parent pages above this one | Needs a Bava convention (a placeholder the editor fills in) | no |

## 2. Text blocks

Sources: [types-of-content-blocks](https://www.notion.com/help/guides/types-of-content-blocks),
[columns-headings-and-dividers](https://www.notion.com/help/columns-headings-and-dividers),
[writing-and-editing-basics](https://www.notion.com/help/writing-and-editing-basics),
[enhanced-markdown](https://developers.notion.com/guides/data-apis/enhanced-markdown)

| Feature | What it does | In a Markdown file | Network or account |
|---|---|---|---|
| Paragraph (text) | Default block for writing | Markdown | no |
| Line break inside a block | Shift+Enter starts a new line without a new block | Markdown (backslash or two spaces at line end) | no |
| Empty blocks | Blank lines kept as real empty blocks for spacing | Needs a Bava convention (Markdown collapses blank lines) | no |
| Heading 1, 2, 3 | Three heading sizes in the menus and shortcuts | Markdown | no |
| Heading 4 | Smaller fourth level, added in 2026; levels 5 and 6 become 4 | Markdown | no |
| Toggle heading | A heading that folds its content open and closed | Needs a Bava convention | no |
| Bulleted list | Unordered list, nestable | Markdown | no |
| Numbered list | Ordered list; can be typed as `1.`, `a.` or `i.` | Markdown for numbers; Needs a Bava convention for letter and roman styles | no |
| To-do list | Checkbox items that can be ticked | Extended (task list `- [ ]`) | no |
| Toggle list | A line that folds its nested content open and closed | Needs a Bava convention (for example HTML `<details>`) | no |
| Quote | Indented, highlighted passage | Markdown | no |
| Callout | Boxed note with an icon and a colour, can hold other blocks | Needs a Bava convention (GitHub's `> [!NOTE]` alerts cover a fixed set only) | no |
| Divider | Horizontal line between sections | Markdown | no |
| Nesting under any block | Tab indents any block under the one above, not only list items | Needs a Bava convention (Markdown nests only inside lists and quotes) | no |
| Block colours | Text colour or background colour for a whole block | Needs a Bava convention | no |

## 3. Advanced blocks

Sources: [code-blocks](https://www.notion.com/help/code-blocks),
[guides/code-blocks](https://www.notion.com/help/guides/code-blocks),
[math-equations](https://www.notion.com/help/math-equations),
[simple-tables-vs-databases](https://www.notion.com/help/guides/simple-tables-vs-databases),
[columns-headings-and-dividers](https://www.notion.com/help/columns-headings-and-dividers),
[synced-blocks](https://www.notion.com/help/synced-blocks),
[buttons](https://www.notion.com/help/buttons)

| Feature | What it does | In a Markdown file | Network or account |
|---|---|---|---|
| Code block | Syntax-coloured code in 60+ languages, chosen from a searchable list | Markdown (fenced code with a language) | no |
| Code block caption | A line of text under the code block | Needs a Bava convention | no |
| Code block wrap | Wrap long lines instead of scrolling | Needs a Bava convention (per-block setting) | no |
| Code block copy button | One click copies the code | Not stored | no |
| Mermaid diagrams | Code block in Mermaid language, shown as code, diagram, or both side by side | Extended (fenced `mermaid`) | no |
| Block equation | Standalone formula written in TeX, drawn with KaTeX | Extended (`$$ ... $$`) | no |
| Simple table | Plain grid of text, not a database | Extended (GitHub table) | no |
| Table header row | Shaded, bold first row, toggled on or off | Extended (GitHub tables always have one) | no |
| Table header column | Shaded, bold first column | Needs a Bava convention | no |
| Table merged cells, cell colours, column widths, fit to page width | Layout options on a simple table | Needs a Bava convention (GitHub tables cannot hold these) | no |
| Table: turn into database | Converts a simple table into a database | Not a document feature | no |
| Columns | Side-by-side columns made by dragging blocks beside each other; any number; resizable | Needs a Bava convention | no |
| Table of contents | Block listing the page's headings as links; also a floating outline on the right when a page has 2+ headings | Needs a Bava convention (a placeholder; the list is generated) | no |
| Synced block | The same content shown in several places; editing one edits all; can be unsynced | Needs a Bava convention (within one file or across files) | no |
| Button | Runs actions on click: insert blocks, add or edit database pages, notify people, send email, call a webhook, open a link | Not a document feature (only "insert blocks" and "open a link" fit a local file) | yes for email, webhook, notify |
| Template button | Older name for a button that inserts a set of blocks | Needs a Bava convention | no |

## 4. Media and embeds

Sources: [embed-and-connect-other-apps](https://www.notion.com/help/embed-and-connect-other-apps),
[types-of-content-blocks](https://www.notion.com/help/guides/types-of-content-blocks),
[create-links-and-backlinks](https://www.notion.com/help/create-links-and-backlinks)

| Feature | What it does | In a Markdown file | Network or account |
|---|---|---|---|
| Image | Upload or link an image; resize and align it | Markdown for the image; Needs a Bava convention for size and alignment | no for a local file; yes for an image link |
| Image caption | Text under an image | Needs a Bava convention | no |
| Image full-screen | Space opens a selected image full screen | Not stored | no |
| Video | Upload a video or embed one by link (YouTube, Vimeo, Loom) | Needs a Bava convention (a link survives, the player does not) | no for a local file; yes for a hosted video |
| Audio | Upload or embed an audio file with a player | Needs a Bava convention | no for a local file; yes for a link |
| File | Attach any file as a download block | Markdown (a link to the file); Needs a Bava convention for the block look | no |
| PDF | Show a PDF inline, page by page | Needs a Bava convention | no for a local file; yes for a link |
| Web bookmark | Link shown as a card with the page's title, description and image | Needs a Bava convention | yes (fetches the web page to read its title and image) |
| Link mention | Pasted link shown inline with the site's icon and page title | Needs a Bava convention | yes (fetches the web page) |
| Web embed | Live content from another site inside the page | Needs a Bava convention | yes (loads the other site every time the page is shown) |
| Named embed blocks | Ready-made blocks for CodePen, Loom, Miro, Tweet, Google Drive, and so on | Needs a Bava convention | yes, often also a login to that service |

Embed providers Notion lists as common (over 1,900 domains through Iframely):
Abstract, Canva, CodePen, Excalidraw, Facebook, Framer, GitHub Gist,
GIPHY, Google Drive, Google Maps, Instagram, Invision, LinkedIn, Loom, Miro,
Mixpanel, Pinterest, Reddit, Replit, Sketch, Slideshare, Spotify, Streamlit,
Tableau, Tally, TikTok, Twitter (X), Typeform, Vimeo, YouTube. Every one of
them loads from that company's servers when shown.

## 5. Inline formatting and inline elements

Sources: [keyboard-shortcuts](https://www.notion.com/help/keyboard-shortcuts),
[math-equations](https://www.notion.com/help/math-equations),
[comments-mentions-and-reminders](https://www.notion.com/help/comments-mentions-and-reminders),
[reminders](https://www.notion.com/help/reminders),
[customize-and-style-your-content](https://www.notion.com/help/customize-and-style-your-content)

| Feature | What it does | In a Markdown file | Network or account |
|---|---|---|---|
| Bold | Heavier text | Markdown | no |
| Italic | Slanted text | Markdown | no |
| Underline | Underlined text | Needs a Bava convention (Markdown has none; Notion writes HTML) | no |
| Strikethrough | Crossed-out text | Extended (`~~text~~`) | no |
| Inline code | Monospace code inside a sentence | Markdown | no |
| Text colour | Colours letters: gray, brown, orange, yellow, green, blue, purple, pink, red | Needs a Bava convention | no |
| Background colour (highlight) | Same nine colours as a highlight behind text | Needs a Bava convention | no |
| Link | Text that links to a web address, a page, or a block | Markdown | no |
| Inline equation | TeX formula inside a sentence | Extended (`$...$`) | no |
| Emoji | Emoji picker, or `:` plus a name | Markdown (stored as the Unicode character) | no |
| Custom emoji | Workspace-uploaded images used as emoji | Not a document feature | yes (workspace) |
| @page mention | Inline link to another page that also creates a backlink | Markdown (a link to the file) | no |
| @person mention | Names a workspace member and notifies them | Not a document feature | yes (accounts) |
| @date mention | Inline date or time chip, typed as `@today`, `@tomorrow`, `@1/12` | Needs a Bava convention | no |
| Reminder | `@remind tomorrow 7pm` makes a date chip that notifies when due; turns red when overdue | Needs a Bava convention for the chip; Not a document feature for the notification | yes in Notion; a local-only version would need Bava running to notify |
| Inline comment | Comment thread on highlighted text; reply, resolve, reopen | Needs a Bava convention (single user); Not a document feature for other people's comments | yes when shared with others |
| Page comment | Comment thread on the whole page, shown under the title | Needs a Bava convention | yes when shared with others |
| Reactions | Emoji reactions on text or on comments | Not a document feature | yes (accounts) |
| Suggested edits | Changes proposed as suggestions for someone to accept | Needs a Bava convention (tracked changes) | yes when shared with others |
| Citations | Footnote-style source references (Notion AI writes these) | Extended (footnotes) | no |

## 6. Editing interactions

Sources: [writing-and-editing-basics](https://www.notion.com/help/writing-and-editing-basics),
[keyboard-shortcuts](https://www.notion.com/help/keyboard-shortcuts),
[embed-and-connect-other-apps](https://www.notion.com/help/embed-and-connect-other-apps),
[search](https://www.notion.com/help/search)

| Feature | What it does | In a Markdown file | Network or account |
|---|---|---|---|
| Slash menu | Type `/` to search and insert any block, or run a block action | Not stored | no |
| `+` button | Plus beside an empty line opens the same insert menu | Not stored | no |
| Markdown-style typing | Typing Markdown characters turns into formatting as you type (list below) | Not stored | no |
| Formatting bubble | Toolbar over selected text: turn into, bold, italic, underline, strike, code, equation, link, colour, comment, AI | Not stored | no |
| Block handle (⋮⋮) | Grip beside each block: drag to move, click for the block menu | Not stored | no |
| Drag and drop blocks | Move blocks with blue drop guides; drop beside a block to make columns | Not stored | no |
| Alt + drag | Drags a copy of the block | Not stored | no |
| Turn into | Change a block to another type, or into a page | Not stored | no |
| Duplicate | Copy the block in place | Not stored | no |
| Move to | Send a block to another page | Not stored | no |
| Delete | Remove the block | Not stored | no |
| Copy link to block | Copies a link that jumps straight to one block | Needs a Bava convention (a stable id per block, or a heading anchor) | no |
| Colour from block menu | Sets block text or background colour | Needs a Bava convention | no |
| Indent and outdent | Tab and Shift+Tab nest and un-nest blocks | Not stored (the nesting itself is covered in section 2) | no |
| Multi-block selection | Esc selects the current block; Shift+arrows, Shift+click and drag-select extend it; act on all at once | Not stored | no |
| Paste Markdown | Pasted Markdown text becomes formatted blocks | Not stored | no |
| Paste a URL | Offers: plain link, mention (rich inline link), bookmark card, or embed | Not stored (the chosen form is covered in section 4) | yes for mention, bookmark and embed |
| Paste into a table | Pasted spreadsheet cells fill a table | Not stored | no |
| Undo and redo | Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z | Not stored | no |
| Find in page | Cmd/Ctrl+F searches the page; the help centre documents no replace | Not stored | no |
| Word count | Word and character count for the page or selected blocks | Not stored | no |
| Expand or collapse all toggles | Cmd/Ctrl+Alt+T | Not stored | no |

### Markdown-style typing shortcuts, exactly as Notion documents them

At the start of a line, followed by a space:

| Type | Becomes |
|---|---|
| `*`, `-` or `+` | Bulleted list |
| `[]` | To-do checkbox |
| `1.`, `a.` or `i.` | Numbered list |
| `#` | Heading 1 |
| `##` | Heading 2 |
| `###` | Heading 3 |
| `>` | Toggle list (not a quote) |
| `"` | Quote |
| `---` (no space needed) | Divider |
| `$$` then the formula then `$$` | Inline equation (Notion uses double dollars inline) |

Around text:

| Type | Becomes |
|---|---|
| `**text**` | Bold |
| `*text*` | Italic |
| `` `text` `` | Inline code |
| `~text~` | Strikethrough |

Other typed triggers: `@` (mention a person, page or date), `@remind` (reminder),
`[[` (link to a page or create a sub-page), `+` then a page name (link or
create a page), `:` then a name (emoji), `/` (insert menu).

Note: Notion's `>` makes a toggle and `"` makes a quote. A Markdown user
expects `>` to make a quote. Bava should pick one on purpose.

### Main keyboard shortcuts, exactly as Notion documents them

Cmd on Mac, Ctrl on Windows and Linux.

| Keys | Action |
|---|---|
| Cmd/Ctrl + B | Bold |
| Cmd/Ctrl + I | Italic |
| Cmd/Ctrl + U | Underline |
| Cmd/Ctrl + Shift + S | Strikethrough |
| Cmd/Ctrl + E | Inline code |
| Cmd/Ctrl + K | Add a link |
| Cmd/Ctrl + Shift + E | Inline equation |
| Cmd/Ctrl + Shift + H | Apply the last used text or highlight colour |
| Cmd/Ctrl + Shift + M | Comment on the selection |
| Enter | New block |
| Shift + Enter | Line break inside the block |
| Tab / Shift + Tab | Indent / outdent |
| Cmd/Ctrl + Option/Shift + 0 | Turn into text |
| Cmd/Ctrl + Option/Shift + 1, 2, 3 | Turn into heading 1, 2, 3 |
| Cmd/Ctrl + Option/Shift + 4 | Turn into to-do |
| Cmd/Ctrl + Option/Shift + 5 | Turn into bulleted list |
| Cmd/Ctrl + Option/Shift + 6 | Turn into numbered list |
| Cmd/Ctrl + Option/Shift + 7 | Turn into toggle list |
| Cmd/Ctrl + Option/Shift + 8 | Turn into code block |
| Cmd/Ctrl + Option/Shift + 9 | Turn into a new page |
| Cmd/Ctrl + Enter | Act on the block: tick a to-do, open a toggle, open a page |
| Cmd/Ctrl + Option/Alt + T | Expand or collapse all toggles |
| Esc | Select the current block, or clear the selection |
| Cmd/Ctrl + A | Select the block the cursor is in (press again for all) |
| Arrow keys | Move between selected blocks |
| Shift + Up/Down | Extend a block selection |
| Shift + click | Select a range of blocks |
| Cmd + Shift + click (Mac), Alt + Shift + click (Windows/Linux) | Add or remove one block from the selection |
| Backspace or Delete | Delete selected blocks |
| Cmd/Ctrl + D | Duplicate selected blocks |
| Cmd/Ctrl + / | Open the turn-into and action menu for selected blocks |
| Cmd/Ctrl + Shift + Up/Down | Move selected blocks up or down |
| Cmd/Ctrl + F | Find in page |
| Cmd/Ctrl + Z / Cmd/Ctrl + Shift + Z | Undo / redo |
| Cmd/Ctrl + P or Cmd/Ctrl + K (outside text) | Search and jump to a page |
| Cmd/Ctrl + [ / ] | Back / forward |
| Cmd/Ctrl + Shift + U | Go up to the parent page |
| Cmd/Ctrl + Shift + L | Toggle dark mode |
| Cmd/Ctrl + + / - | Zoom in / out |

## 7. Page options, templates, export and import

Sources: [customize-and-style-your-content](https://www.notion.com/help/customize-and-style-your-content),
[tips-to-keep-your-teams-notion-pages-up-to-date](https://www.notion.com/help/guides/tips-to-keep-your-teams-notion-pages-up-to-date),
[duplicate-delete-and-restore-content](https://www.notion.com/help/duplicate-delete-and-restore-content),
[start-with-a-template](https://www.notion.com/help/start-with-a-template),
[export-your-content](https://www.notion.com/help/export-your-content),
[import-data-into-notion](https://www.notion.com/help/import-data-into-notion)

| Feature | What it does | In a Markdown file | Network or account |
|---|---|---|---|
| Font style | Default (sans), Serif, or Mono for the whole page | Needs a Bava convention (front matter) | no |
| Small text | Smaller text across the page | Needs a Bava convention (front matter) | no |
| Full width | Narrow margins so content fills the window | Needs a Bava convention (front matter), or a viewer setting | no |
| Page outline toggle | Show or hide the floating table of contents | Needs a Bava convention, or a viewer setting | no |
| Backlinks and comments display | Show, collapse or hide backlinks and page comments | Needs a Bava convention, or a viewer setting | no |
| Lock page | Stops anyone, including you, editing until unlocked | Needs a Bava convention (front matter) | no |
| Page history | Snapshots every few minutes of editing; open and restore one | Not a document feature in Notion (server snapshots); Bava could keep local history outside the file | yes in Notion |
| Page templates | Start a page from a prebuilt layout, or duplicate a page kept as a template | Markdown (a template is just a file to copy) | no for local templates |
| Template gallery | Thousands of community templates at notion.com/templates | Not a document feature | yes |
| Export to Markdown | Page as `.md`; subpages as separate files; callouts come out as HTML | Markdown | no |
| Export to HTML | Page as HTML in a zip, comments included | Not stored | no |
| Export to PDF | Page as PDF with paper size and scale options | Not stored | no |
| Import files | Plain text, Markdown, Word (.docx), CSV, HTML, PDF, zip; several at once | Not stored | no |
| Import from other apps | Evernote, Trello, Quip, Dropbox Paper, Hackpad, Google Docs, WorkFlowy, Confluence, Asana, Monday.com | Not a document feature | yes (logs in to that service) |

## 8. AI features (Notion AI), briefly

Source: [notion-ai-faqs](https://www.notion.com/help/notion-ai-faqs)

All of these call a language model. In Bava that would be the user's own
chosen endpoint.

| Feature | What it does | In a Markdown file | Network or account |
|---|---|---|---|
| Write with AI | Drafts text, outlines, emails or tables from a prompt | Markdown (the result is ordinary text) | yes (or a local model) |
| Edit selection | Fix grammar, change tone, make longer or shorter | Markdown | yes (or a local model) |
| Summarise | Summary of a page or a selection | Markdown | yes (or a local model) |
| Translate page | Translates the whole page into another language | Markdown | yes (or a local model) |
| AI block | A block that regenerates its content from a saved prompt | Needs a Bava convention | yes (or a local model) |
| Ask about the workspace, research mode | Answers questions using the workspace and the web | Not a document feature | yes |
| Meeting notes | Records and transcribes a meeting, then summarises it | Not a document feature | yes |
| Database autofill | Fills database properties with summaries or keywords | Not a document feature | yes |

## 9. Outside the page editor

Listed so they are visible; none belong in a page editor.

Source: [types-of-content-blocks](https://www.notion.com/help/guides/types-of-content-blocks)

- **Databases**: table, board, calendar, gallery, list, timeline, chart,
  form and map views; properties, formulas, relations, rollups; filters and
  sorts; linked views of a database inside a page; database templates;
  database automations.
- **Workspace**: sidebar page tree, teamspaces, favourites, trash and restore,
  workspace search.
- **People**: accounts, members and guests, sharing and permissions, live
  presence and multi-person editing, inbox and notifications.
- **Publishing**: publish to web, Notion Sites, "duplicate as template".
- **Connections**: integrations and the public API, Slack, Google Drive and
  Calendar, Zoom; Notion Calendar and Notion Mail.
- **Plans and admin**: plan limits, data retention, audit logs, workspace
  export.

## Hardest fit for a local Markdown app

1. **Web embeds, bookmarks and link mentions.** They fetch from other sites
   every time, which breaks "offline" and leaks what the user is reading to
   those sites. They also need a Bava convention to survive in the file.
2. **Nesting under any block.** Notion lets a paragraph, heading or to-do
   hold children. Markdown nests only inside lists and quotes, so either the
   editor limits nesting or the file needs a convention, and that convention
   touches almost every block.
3. **Columns.** No Markdown form at all; any convention (HTML or fenced
   blocks) makes the raw file hard to read in another editor.
4. **Synced blocks.** One piece of content in several places needs ids and a
   rule for which copy is the source, especially across files. Deleting the
   source is lossy in Notion itself.
5. **Colours and underline.** Used everywhere in Notion, with no Markdown
   form. Every coloured word becomes HTML or a custom mark in the file.
6. **Comments, suggested edits, @person and reminders.** They assume other
   people and a service that notifies them. Single-user comments can live in
   the file; anything involving other people cannot without a server.
7. **Toggles and callouts.** Very common in Notion pages and absent from
   Markdown. HTML `<details>` and GitHub alerts are partial answers that other
   editors show differently.
8. **Tables beyond the basics.** GitHub tables cannot hold a header column,
   merged cells, cell colours, column widths or multi-line cells with lists.
9. **Stable block links.** "Copy link to block" needs an id that survives
   edits; plain Markdown has only heading anchors, which change when the
   heading text changes.
10. **Page history.** Notion stores snapshots on its servers; a local app
    must keep its own history outside the file, and it must never be the only
    copy of the work.
