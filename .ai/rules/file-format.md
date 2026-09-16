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

## Round-trip tests are mandatory
Every format change ships with a test: write → read → compare. Not a unit test
of the writer and a separate one of the reader — the round trip, because that
is where asymmetries hide.

## Forward compatibility
Unknown keys and unknown block types are preserved on read and written back
unchanged. A newer Bava must not destroy data when an older one opens the
file, and vice versa.

## Changes are specified before they are written
A new frontmatter key, block type, or sidecar file goes into
`docs/file-format.md` first, in the same change as the code that writes it,
with the round-trip test. The build loop gates on this.