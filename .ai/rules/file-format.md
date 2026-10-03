# File format

## Nothing writes a format that is not specified
Until `docs/file-format.md` describes it, no code may write a persistent
format. This is the product's long-term contract with its users:
wrong once, wrong forever, and unnoticed until people have files in the old
shape.

## Plain text, always
No database, no embedded store, no binary container. A user must be able to
open everything Bava writes in any editor, diff it in git, and lose nothing if
Bava disappears. That property is the whole reason this app exists rather than
a hosted one.

A scene is JSON, which is plain text in the letter but not hand-editable in the
spirit. That is accepted for a scene, because coordinates are not something a
human edits by hand, but it raises the bar on the rest: document prose stays
Markdown, and a fenced `d2` block a person writes in it is kept as written.

## What the scene holds
Every element carries its own geometry. Two element properties are less
obvious and both are required:

- **Measured text dimensions.** Canvas text is measured in the frontend, where
  platforms disagree on glyph advances. Storing the measurement is what makes a
  scene reopen identically elsewhere.
- **Bindings by id, never by coordinate.** An attached arrow stores the
  target element's id (`startBinding`, `endBinding`). Coordinates would break
  on the next move. A target that is gone leaves the end detached, never
  deleted.

## Round-trip tests are mandatory
Every format change ships with a test: write → read → compare. Not a unit test
of the writer and a separate one of the reader: the round trip, because that
is where asymmetries hide.

## Forward compatibility
Unknown keys and unknown block types are preserved on read and written back
unchanged. A newer Bava must not destroy data when an older one opens the
file, and vice versa.

## Changes are specified before they are written
A new frontmatter key, block type, or sidecar file goes into
`docs/file-format.md` first, in the same change as the code that writes it,
with the round-trip test. The build loop gates on this.

## Preservation is tested through the frontend bridge
Reading and writing in Go is not the whole path. The app opens a file, sends
the scene to the frontend through encoding/json, and gets it back to save.
Until Milestone 6, `format.Element` kept unknown keys in a `json:"-"` field,
so every save from the app dropped a stroke's points, a text element's text
and every unknown key, while every Go round-trip test passed.
`TestSceneSurvivesTheFrontendBridge` marshals and unmarshals the scene between
read and write; any new format test belongs on that path too.

## Space data lives in `.bava`, never a page's content
A Space's `.bava/` holds what belongs to the Space as a whole (`space.json`:
the order and the default page width; `trash/`; `attachments/`). A page's text and canvas stay in its own `.md` file, so copying
one page still carries all of it; `docs/file-format.md` ("Why one file rather
than a sidecar") is the reason. Every change to a Space goes through
`internal/space`, which refuses a path that leaves the Space or is hidden.

## A rename rewrites other pages, byte for byte
Renaming or moving a page or folder rewrites the links to it in every page of
the Space. That is Bava writing into files the user did not open, so it
changes only a link's address, and its words where they still read the old
name, and nothing else; the links are found by the Document's own reader,
never a second parser. The file side writes a page back only if it still
reads as it did (`Space.WriteIfUnchanged`), and saving keeps a file's
permissions.
