# File format

Rules for anything Bava writes to disk. The format itself is
`docs/file-format.md`.

## Specify before writing
No code writes a persistent format, key, block type or sidecar until
`docs/file-format.md` describes it, in the same change, with a round-trip
test. A wrong format is wrong forever.

## Plain text, always
No database, embedded store or binary container. Prose stays Markdown, and a
fenced `d2` block a person writes is kept as written.

## The scene stores measured text and bindings by id
Measured text dimensions are stored, so a scene reopens identically on another
platform. Arrows bind by id (`startBinding`, `endBinding`); a missing target
leaves the end detached, never deleted.

## Round trips, through the frontend bridge
Every format change ships a write, read, compare test. Go-only round trips
once passed while every app save dropped data: new tests go on the path of
`TestSceneSurvivesTheFrontendBridge`, which passes the scene through JSON.

## Forward compatibility
Unknown keys and block types are kept on read and written back unchanged.

## Space data lives in `.bava`, never a page
`.bava/` holds `space.json` (order, default page width), `trash/` and
`attachments/`; a page's text and canvas stay in its `.md`. Every Space change
goes through `internal/space`, which refuses paths outside or hidden.

## A rename rewrites other pages, byte for byte
Moving a page rewrites links to it everywhere, changing only the address (and
words still reading the old name), found by the Document's own reader. A page
is written back only if unchanged (`Space.WriteIfUnchanged`), with its
permissions kept.
