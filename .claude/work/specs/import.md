# Import (15.3)

Builds `documents.md` decision 49: Markdown files and folders, and Bava's
export zips, into a chosen folder; clashes numbered, never overwritten.
These settle what it leaves open.

### 1. Links follow a renamed import (2026-10-12)

When a clash brings a page in numbered ("Launch plan 2"), links to it from
the other pages in the same import are rewritten to the new name. Pages
already in the Space are never touched.

### 2. Pictures from outside the import are copied in (2026-10-12)

A picture an imported page shows from outside the chosen folder or file
(`../images/chart.png`) is copied into `.bava/attachments` like the rest,
so the page keeps it whatever happens to the original. Inside a store's
sandbox, where that file may be out of reach, it stays a missing picture
with its link kept, never a failed import.

### 3. Every other file in an imported folder comes in (2026-10-12)

Files that are neither pages nor pictures (PDFs, spreadsheets) are copied
into `.bava/attachments` too, as adding them would: a file a page links to
keeps its card, and one no page names shows in Media as Unused, exactly as
an upload does. Nothing from the chosen folder is left behind but
hidden files (decision 8).

### 4. A zip's templates come in; its settings do not (2026-10-12)

A Bava export zip brings its pages, its attachments and its templates.
Templates are added beside this Space's own, a clash numbered as a page's
is. Tags need nothing: they are in each page's front matter. The zip's
`space.json` is not read; the Space imported into keeps its own settings.

### 5. A long import counts and can be cancelled (2026-10-12)

The window shows "Importing 34 of 210", as a Space's PDF counts its pages,
with Cancel. Cancel stops it and removes what this import added (pages,
folders, attachments and templates it created; an existing attachment it
reused stays), so a cancelled import leaves the Space as it was.

### 6. Two entries, the same on every system (2026-10-12)

File ▸ Import ▸ Files… (Markdown files or a Bava zip) and ▸ Folder…, and
the same two under a folder's right-click Import. Windows' and Linux's
dialogs cannot pick files and a folder at once; macOS's could, but every
system offers the same two, for one way to do it.

### 7. A dialog shows what comes in and where (2026-10-12)

After the system's dialog, Bava's Import dialog lists what is coming in
(pages, other files, templates; clashes that will be numbered) and an
"Into" list of the Space's folders, as Export Space's "What" list does;
Import or Cancel. From a folder's right-click it is the same dialog, set to
that folder, as Export is. Import needs a Space: with none open, both
entries are disabled.

### 8. Hidden files stay behind; a Space's .bava comes in (2026-10-12)

A file or folder whose name starts with a dot (`.git`, `.obsidian`,
`.DS_Store`) is not imported. The one exception: an imported folder that is
itself a Bava Space brings its `.bava` attachments and templates, as its
export zip would (decision 4), its settings again left out.

### 9. Imported pages are copied as written (2026-10-12)

Follows the rule that a rewrite touches only the address: a page comes in
byte for byte except the addresses that must change (pictures and files now
in `.bava/attachments`, links to a page numbered by decision 1). Bava's
usual tidy-up happens only when the user first saves it, as for any page
written elsewhere.

### 10. Export counts and cancels the same way (2026-10-12)

The progress import uses also serves export: a Markdown zip counts
"Writing 34 of 210" with Cancel, which removes the unfinished zip, and a
Space's PDF can be cancelled while it prints, not only while its pages are
drawn. Built in 15.3.
