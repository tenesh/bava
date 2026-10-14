# Icons (9)

Decisions for Milestone 9, settled with the user one at a time on
2026-10-13. Icons for what a user draws: two bundled sets and a custom
library. The app's own interface icons are a separate set and are not
offered for content.

## Decisions

1. **An icon is its own element**, placed, moved and sized like a picture.
   It never sits inside a shape as part of it; putting one over a shape is
   how the two combine. An icon slot inside shapes, and both kinds, were
   not chosen. An icon carries an optional label drawn under it, edited by
   double-click like a shape's, moving and sizing with it; arrows attach to
   the icon. A separate text grouped with the icon was not chosen.

2. **Bava bundles two sets for content** (chosen after shipping nothing,
   the interface's own icons, and the cloud providers' official sets were
   weighed):
   - **General:** a line-icon set under MIT, outline (5,184) and filled
     (1,054), about 470 KB compressed.
   - **Logos:** a brand-logo set under CC0 (3,466 logos), about 1.9 MB
     compressed. Some of its logos carry their own licence; only those
     with none listed or a permissive one (MIT, Apache-2.0, BSD, CC0,
     Unlicense) are bundled. Copyleft, share-alike, non-commercial,
     no-derivatives and custom ones are left out: 3,338 bundled, 128 not.
     The 83 bundled under a licence of their own (MIT, Apache-2.0, BSD)
     are each credited, with that licence and their source, in a list that
     ships with the app (chosen 2026-10-14 over leaving them out).
   - Both credited in `NOTICE`. Logos are trademarks of their owners
     whatever the drawing's licence; they are offered to name a product in
     a diagram.

3. **The cloud providers' official icon sets are never bundled.** Their
   terms permit diagrams, not open redistribution, and differ per
   provider. The bundled logo set has a provider's logo where it has one,
   not its per-service icons; a user who wants those downloads them from
   the provider, accepting its terms, and adds them as custom icons.

4. **Missing icons are asked for, not imported by default.** A user who
   needs a general icon or logo the sets lack requests it (an issue on the
   repository); it arrives with a release. Custom icons (decision 8) cover
   what a set will never hold.

5. **Bundled icons follow Bava's palette; custom icons keep their own
   colours.** Every bundled icon is one colour: it lands in the theme's
   ink, so it flips with dark mode, and the user can pick any palette
   swatch instead, like a shape's outline. A logo offers one more swatch,
   **Brand**, its owner's colour from the set's data, drawn exactly in both
   themes: a near-black brand (753 of them) is near-invisible on a dark
   canvas until another swatch is picked. Falling back to ink there was
   offered and not chosen. Logos are one-colour silhouettes; the line set
   keeps its own outline logos. A custom icon always
   shows its own colours, with no swatch and no detection of how many it
   has; if `<name>.dark.svg` sits beside `<name>.svg` (added at any time),
   a dark canvas draws that instead. Tinting one-colour custom icons and an
   "Original" swatch were weighed and not chosen as too much.

6. **The file stores the icon's name**, never its drawing:
   `line/database`, `solid/database`, `logo/postgresql`, `custom/<name>`.
   The set ids describe the set, never its source. A name no set holds
   draws a "missing icon" box of the element's size and keeps the name, so a later Bava or a restored custom
   icon brings it back. Names, once shipped, keep resolving across set
   updates (a rename keeps the old name as an alias).

7. **The picker opens from Canvas ▸ Icon and the + panel's Icon entry**,
   both beside Picture, and from the command palette; pages are untouched.
   It is a searchable grid with tabs for General, Logos and Custom. Typing
   searches names and the sets' own keywords. Choosing one places it like
   Picture places a picture.

8. **Custom icons live in one library for every Space**, Bava's own state
   in the platform config directory (`<config>/bava/icons/`), beside
   `settings.json`. The picker's Custom tab has **Add icons** (SVG files or
   a folder; Bava copies them in, named by file), **Show folder**, rename
   and delete. It is a plain folder: SVGs dropped there appear too. Only
   SVG; each is sanitised as a previewed SVG is (no scripts, no remote
   references).

9. **A Space names its custom icons and does not carry them.** On a
   machine whose library lacks one, the element shows the "missing icon"
   box (decision 6). Copying used icons into the Space was offered and
   not chosen.

10. **A D2 `icon:` resolves by name, locally, and nothing is fetched.**
    The name is the value itself or, for a web address, its file name:
    lowercased, the extension dropped, a leading number and dash dropped
    (`.../112-server.svg` is `server`). It is looked up in Custom, then
    General, then Logos (with the logo set's aliases). Found: an icon
    element is placed (decision 11). Not found: the shape lands as a plain
    shape, and the D2 diagram dialog lists it ("icon not found: postgres") so the user knows what to add.

11. **A D2 shape with an icon becomes the icon alone** (drawn as the
    mockup's "4.20 Icons in a D2 diagram"): no box around it, D2's label as
    the icon's label, at the place and size D2's layout gives the shape, and
    its connections attach to the icon. A shape with children keeps its
    box, since its children sit inside it, and the icon is placed in the
    box's top-right corner without a label (top-left at first; moved
    2026-10-14, as a frame's label is drawn in its top-left corner). A SQL
    table or class takes no icon; its `icon:` is ignored. Keeping the box with the icon
    inside it, grouped, was first chosen and then changed by the user the
    same day.
