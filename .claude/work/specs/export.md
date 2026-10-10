# Export, decisions

Settled with the user before the plan of 15.2, one question at a time.
They fill holes in decision 48 of `documents.md`, which stands.

### 1. A PDF is made by each system's own page printing (2026-10-11)

Each system's webview prints the page to a PDF file, as "Save as PDF"
does: real, selectable text, drawn exactly as Bava draws the page (tables,
equations, callouts, code). It needs its own work on macOS, Windows and
Linux, checked on CI; a combined PDF's contents and bookmarks are added to
the printed file afterwards. Chosen over Bava drawing its own PDF (every
block drawn a second time) and over pictures of pages (no selectable text).
Nothing leaves the machine.

### 2. Export is grouped by what is exported (2026-10-11)

The user: "we must organise/group what we are exporting much better."
Chosen from drawn dialogs (since deleted). File ▸ Export opens a short
list, Page, Canvas and Space, each opening its own dialog that shows only
what applies; the same dialogs open from where the work is.

| Exported | Started from | Formats |
|---|---|---|
| A page | File ▸ Export ▸ Page; the page's ⋯ menu; right-click a page in Files | PDF (the Document, the Canvas, or both: the Canvas as a picture after the text), or a Markdown zip (the page and the images it uses) |
| The Space, or a folder | File ▸ Export ▸ Space; the Space switcher; right-click a folder (the same dialog, set to it) | PDF (one file with a contents page and bookmarks, or one PDF per page in matching folders), or a Markdown zip laid out as in the Space |
| A canvas | File ▸ Export ▸ Canvas; right-click the canvas | PNG or SVG, as today: the whole canvas or only what is selected (a frame selected exports just it), background, dark, scale, copy to the clipboard |

Each dialog: a preview on the left (a PDF's first page, what a zip holds,
the picture), options on the right, the export button at the bottom. A
PDF's options: paper size, orientation, margins, scale, light or dark,
page numbers.

### 3. Paper: the common sizes, and Custom (2026-10-11)

A3, A4, A5, B4, B5, Letter, Legal and Tabloid, the sizes most apps offer
(Chrome's and Notion's PDF, Google Docs); **Custom** for anything else,
posters such as A0 to A2 included, as a width and height in millimetres or
inches. The first choice follows the computer's region: Letter in the US
and Canada, A4 elsewhere. Asked about the A and B series in full, the JIS,
ANSI and Arch sheets, envelopes and printers' sizes; the common set with
Custom was chosen.

### 4. Margins: None, Narrow, Normal, Wide, and Custom (2026-10-11)

0, 12, 20 and 30 mm all round, Normal the default; Custom takes top,
bottom, left and right in millimetres or inches. None suits a canvas, or a
dark page printed to the edge.

### 5. A page's Canvas goes on its own PDF page, fitted (2026-10-11)

After the Document, the Canvas starts a new PDF page and is scaled down to
fit it whole (never enlarged), on a landscape page when it is wider than
tall. Chosen over running on after the text at the text's width, and over
printing it 1:1 in tiles.

### 6. Export is built in three parts, PDF proven first (2026-10-11)

Wails keeps its Windows webview to itself (in code other modules may not
import), so Windows needs its own way to the system webview for printing;
macOS and Linux make a webview of their own. *As built in 15.2a:* Windows
prints through a hidden Wails window's WebView2, reached at run time. None of it can be tried without the running app, which runs
only on CI. So: **15.2a** proves that each system writes a PDF with a
chosen paper size and margins, checked on CI on all three; **15.2b** the
three dialogs, the Markdown zip and the canvas as today; **15.2c** PDF
export on the proven printing. Should the proof fail on a system, what to
do there is decided before anything is built on it.
