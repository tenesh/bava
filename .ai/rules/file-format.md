# File format

## Nothing writes a format that is not specified
Until `docs/file-format.md` exists and describes it, no code may write a
persistent format. This is the product's long-term contract with its users:
wrong once, wrong forever, and unnoticed until people have files in the old
shape.

## Plain text, always
No database, no embedded store, no binary container. A user must be able to
open everything Bava writes in any editor, diff it in git, and lose nothing if
Bava disappears. That property is the whole reason this app exists rather than
a hosted one.

A scene is JSON, which is plain text in the letter but not hand-editable in the
spirit. That is accepted for a scene, because coordinates are not something a
human edits by hand, but it raises the bar on the rest: **D2 source inside a
diagram element is stored as readable source, never escaped into
unrecognisability**, and document prose stays Markdown.

## What the scene holds
Every element carries its own geometry. Two element properties are less
obvious and both are required:

- **Measured text dimensions.** Canvas text is measured in the frontend, where
  platforms disagree on glyph advances. Storing the measurement is what makes a
  scene reopen identically elsewhere.
- **Bindings by id, never by coordinate.** An arrow into a diagram stores the
  node's D2 absolute id. Coordinates would break on the next re-layout.

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
