# 9: Icons

**Goal:** an icon element on the canvas, from two bundled sets in Bava's
palette and a custom SVG library every Space can use, picked from a
searchable grid; a D2 shape with an icon arrives as that icon, and a remote
icon is never fetched.
**Specs:** `.claude/work/specs/icons.md` decisions 1 to 11;
`docs/file-format.md`; `.ai/rules/canvas.md`, `.ai/rules/d2.md`,
`.ai/rules/file-format.md`, `.ai/rules/ipc.md`, `.ai/rules/design-system.md`.
**File format impact:** one element type, `icon`, with its name, an
optional label and a colour that may be `brand` (below), with round-trip
tests.
**UI impact:** drawn as the mockup's "4.14 The Canvas menu" and "4.15" to
"4.20"; Canvas ▸ Icon and the + panel's Icon category.

Three parts, each its own commit and CI run: part 1 the element and the
bundled sets, part 2 the custom library, part 3 D2 icons.

## Constraints

- "An icon is its own element, placed, moved and sized like a picture. [...]
  An icon carries an optional label drawn under it, edited by double-click
  like a shape's, moving and sizing with it; arrows attach to the icon." (1)
- "General: a line-icon set under MIT, outline (5,184) and filled (1,054)
  [...] Logos: a brand-logo set under CC0 (3,466 logos) [...] only those
  with none listed or a permissive one (MIT, Apache-2.0, BSD, CC0,
  Unlicense) are bundled." (2)
- "The cloud providers' official icon sets are never bundled." (3)
- "Every bundled icon is one colour: it lands in the theme's ink [...] the
  user can pick any palette swatch instead [...] A logo offers one more
  swatch, Brand, its owner's colour [...] drawn exactly in both themes [...]
  A custom icon always shows its own colours, with no swatch [...] if
  `<name>.dark.svg` sits beside `<name>.svg` [...] a dark canvas draws that
  instead." (5)
- "The file stores the icon's name, never its drawing: `line/database`,
  `solid/database`, `logo/postgresql`, `custom/<name>`. [...] A name no set
  holds draws a 'missing icon' box of the element's size and keeps the
  name [...] Names, once shipped, keep resolving across set updates." (6)
- "The picker opens from Canvas ▸ Icon and the + panel's Icon entry, both
  beside Picture, and from the command palette; pages are untouched. [...]
  tabs for General, Logos and Custom. Typing searches names and the sets'
  own keywords." (7)
- "Custom icons live in one library for every Space [...]
  `<config>/bava/icons/` [...] Add icons (SVG files or a folder [...]),
  Show folder, rename and delete. It is a plain folder [...] Only SVG; each
  is sanitised." (8)
- "A Space names its custom icons and does not carry them." (9)
- "A D2 `icon:` resolves by name, locally, and nothing is fetched. [...]
  lowercased, the extension dropped, a leading number and dash dropped
  [...] looked up in Custom, then General, then Logos [...] Not found: the
  shape lands as a plain shape, and the D2 diagram dialog lists it." (10)
- "A D2 shape with an icon becomes the icon alone [...] A shape with
  children keeps its box [...] and the icon is placed in the box's top-left
  corner without a label." (11)
- Roadmap exit: "a test that conversion never yields a remote icon."

## Decisions this plan makes (not in the spec; raised in the report)

- **The icon's box is the drawing; the label sits under it.** `w`/`h` are
  the icon's square; the label is centred below, wrapped to
  `max(w, ICON_LABEL_WIDTH)` (160), and its measured size is stored as
  `measuredWidth`/`measuredHeight`, as a text's is. Selection, export bounds
  and Zoom to Fit take the label in; arrows attach to the box only. Resizing
  keeps the square; the label keeps its font size.
- **Colour is the `color` key**, a swatch name, a `#rrggbb`, or `brand`
  (logos only). Absent is the theme's ink (`--color-shape-text`); the label
  takes the same colour. A custom icon ignores it; the colour control is
  hidden when the selection holds only custom icons.
- **The sets reach the app through a build step, not committed data.** The
  two packages are pinned dev dependencies; a Vite plugin turns them into
  three lazily loaded modules (`line`, `solid`, `logo`), applying the
  licence filter there, so the excluded logos are never in the app.
- **Placed size:** 64 by 64 at the view's centre or the right-click spot,
  as Picture places; a D2 icon takes the size D2 gives its shape (the
  smaller side).

## File format

```json
{ "id": "k3", "type": "icon", "x": 120, "y": 80, "w": 64, "h": 64, "z": 7,
  "icon": "logo/postgresql", "color": "brand",
  "label": "Orders DB", "measuredWidth": 74, "measuredHeight": 18 }
```

- `icon`: `<set>/<name>`, set one of `line`, `solid`, `logo`, `custom`.
- `color`: as above. `label`, `measuredWidth`, `measuredHeight`: absent
  when unlabelled. Takes `opacity`, `angle`, `locked`, `frame`, `fontSize`.
- A name no set holds, or a custom icon this machine lacks, draws the
  missing box and is kept as written.

# Part 1: the element and the bundled sets

### Task 1: The format, first
**Files:** `docs/file-format.md` ("### Elements" row, new "### Icons"
section, "### On the clipboard"), `internal/format/roundtrip_test.go`.
- [x] Failing test: `TestRoundTripIcons` (every set, `brand`, a label with
  its measured size, an unknown key kept); expected failure: none from Go
  (it keeps every key), so the test asserts byte-identical output and is
  green at once; the TS side below is where it fails.
- [x] Write the section as above.
- [x] Green: `go test ./internal/format -run Icons`

### Task 2: The element type
**Files:** `frontend/src/canvas/scene.ts`, `clipboard-read.ts`, their tests.
- [x] Failing test: `scene.test.ts` "an icon is an element" and
  `clipboard-read.test.ts` "an icon is read back with its name"; expected
  failure: `icon` is not in `ELEMENT_TYPES`.
- [x] `IconElement = Base & StyleProps & { type: 'icon'; icon: string; color?; label?; measuredWidth?; measuredHeight? }`;
  `EVERY_TYPE`, the union.
- [x] Green: `npx vitest run src/canvas/scene src/canvas/clipboard-read`

### Task 3: The sets as modules
**Files:** `frontend/package.json` (two pinned dev dependencies),
`frontend/vite-icon-sets.ts` (plugin), `frontend/vite.config.ts`,
`frontend/vite.visual.config.ts`, `frontend/src/canvas/icons/sets.ts`,
`frontend/src/canvas/icons/virtual.d.ts`, tests.
- [x] Failing test: `vite-icon-sets.test.ts`: the `logo` module holds
  3,338 logos and none whose licence is outside the list; `line` 5,184 and
  `solid` 1,054; every entry has a name, its drawing and its keywords; a
  logo has its colour. Expected failure: no plugin.
- [x] Plugin: `virtual:bava-icons/line|solid|logo`, each
  `{ name, body, keywords, hex? }[]` (body: the inner SVG on a 24 grid).
- [x] `sets.ts`: `loadSet(set)` (one `import()` each, retried after a
  failure, as `docs/emoji.ts`), `iconSvg(name, colour, theme)`, the
  `line/` `solid/` `logo/` `custom/` name parsing.
- [x] Failing test: `sets.test.ts` "a line icon takes the colour given";
  "brand gives the logo's colour"; "an unknown name is missing".
- [x] Green: `npx vitest run vite-icon-sets src/canvas/icons`

### Task 4: Search
**Files:** `frontend/src/canvas/icons/search.ts`, test.
- [x] Failing test: "data finds database first, then by keyword"; "an
  empty query lists the set in name order"; expected failure: no module.
- [x] Name prefix, then name contains, then keyword; capped at 120 tiles.
- [x] Green: `npx vitest run src/canvas/icons/search`

### Task 5: Drawing on the stage
**Files:** `frontend/src/canvas/stage.ts`, `icon-placeholder.ts`,
`paint.ts`, `palette.ts`, tests.
- [x] Failing test: `stage.test.ts` "an icon draws its picture at its box
  with its label below"; "a missing icon draws the dashed box and its
  name"; `palette.test.ts` "brand resolves to the logo's colour, ink when
  absent". Expected failure: no icon branch.
- [x] `#drawIcon` beside `#drawPicture`: a `Konva.Image` from the icon's
  SVG (cached per name, colour and theme), the label as `Konva.Text`
  below; `setIcons(lookup)` redraws when a set or the library arrives, as
  `setPicture` does. Theme change redraws.
- [x] Green: `npx vitest run src/canvas/stage src/canvas/palette src/canvas/icon-placeholder`

### Task 6: Bounds, resize, bindings
**Files:** `frontend/src/canvas/pointer.ts`, `binding.ts`, the bounds
helper the exporter and Zoom to Fit share, tests.
- [x] Failing tests: "an icon resizes as a square"; "an arrow attaches to
  the icon's box, not its label"; "the icon's bounds take its label in".
- [x] Green: `npx vitest run src/canvas/pointer src/canvas/binding`

### Task 7: The label
**Files:** `frontend/src/canvas/label-editor.ts`, `label-box.ts`,
`frontend/src/App.svelte`, tests.
- [x] Failing test: `label-editor.test.ts` "double-clicking an icon edits
  its label"; "committing stores the measured size; clearing removes all
  three keys". Expected failure: `editableAt` skips icons.
- [x] Green: `npx vitest run src/canvas/label-editor src/canvas/label-box`

### Task 8: Colour
**Files:** `frontend/src/canvas/style.ts`, `components/StyleBar.svelte`,
`components/SelectionToolbar.svelte`, `i18n/messages.ts`, tests, the
StyleBar gallery demo.
- [x] Failing test: `style.test.ts` "an icon's colour is its `color`";
  "custom icons offer no colour"; `style-bar.test.ts` "Brand shows only
  when every selected icon is a logo". Expected failure: `styleKeysFor`
  gives icons nothing.
- [x] Green: `npx vitest run src/canvas/style src/components/style-bar`

### Task 9: The picker
**Files:** `frontend/src/shell/insert.svelte.ts`,
`frontend/src/shell/icon-picker.svelte.ts`,
`frontend/src/components/InsertPanel.svelte`,
`frontend/src/components/IconGrid.svelte`, `i18n/messages.ts`, tests,
gallery demo.
- [x] Failing tests: `insert.test.ts` "the + panel lists Icon after
  Picture and opens it as a category"; `icon-picker.test.ts` "tabs switch
  sets and keep the query"; "arrows move by a row; Enter places";
  "a set still loading shows its row of empty tiles".
- [x] The Icon category's view: search, the three tabs (the existing
  segments), a five-column grid, the footer naming the highlighted icon.
  The Custom tab is empty in part 1 except "Add icons" (part 2).
- [x] Green: `npx vitest run src/shell/insert src/shell/icon-picker src/components/insert-panel`

### Task 10: The command and placing
**Files:** `internal/app/menu/spec.json` (`insert.icon` after
`insert.picture`), `frontend/src/shell/commands.ts`,
`frontend/src/App.svelte`, `frontend/src/canvas/add-icon.ts`,
`docs/shortcuts.md` (no key; the palette lists it), tests.
- [x] Failing test: `add-icon.test.ts` "an icon lands 64 square at the
  spot, in ink"; `commands.test.ts` passes once spec and ids match.
- [x] Green: `npx vitest run src/canvas/add-icon src/shell/commands` and
  `go test ./internal/app/menu`

### Task 11: Export and the clipboard
**Files:** `frontend/src/canvas/export/svg.ts`, `export/png.ts`, tests.
- [x] Failing test: `svg.test.ts` "an icon exports as its own vector drawing
  in its colour, with its label"; "a missing icon exports the dashed box";
  `png.test.ts` "an icon is drawn into the PNG". Expected failure: no icon
  branch in `draw()`.
- [x] Inline `<svg>` with the icon's body (vector, not a picture); on the
  clipboard the element keeps its name, and the drawing pastes into other
  apps.
- [x] Green: `npx vitest run src/canvas/export`

### Task 12: Visual and end-to-end
**Files:** `frontend/tests/fixtures/canvas-scenes.ts`,
`frontend/tests/visual/canvas.spec.ts`, a picker test in
`frontend/tests/visual/`, `tests/e2e/canvas.json`.
- [x] Scenes: icons in ink, a swatch, Brand, labelled, missing; the
  picker's General and Logos tabs; both themes.
- [x] e2e: Canvas ▸ Icon, type "database", Enter; the saved page holds
  `"icon": "line/database"`.
- [x] Green: `(cd frontend && npm run browser)`; CI.

### Task 13: Credits and docs
**Files:** `NOTICE` (both sets: name, licence, copyright, URL, the MIT
text; the logos' trademark note), `docs/decisions.md` rows,
`.ai/rules/canvas.md` (icons draw through `setIcons`), design-system
inventory (`IconGrid`).

# Part 2: the custom library

### Task 14: Sanitising an SVG
**Files:** `internal/icons/sanitise.go`, test.
- [x] Failing test: `TestSanitise` table: scripts, `on*` handlers,
  `foreignObject`, external `href`/`src`, `<use>` pointing outside the
  file, CSS `url(http…)` and `@import` removed; shapes, gradients, groups,
  `viewBox` kept; not XML or no `<svg>` root is refused. Expected failure:
  no package.
- [x] An allow-list walk with `encoding/xml`.
- [x] Green: `go test ./internal/icons -run Sanitise`

### Task 15: The library
**Files:** `internal/icons/library.go`, `internal/config/config.go`
(`Dir()`), `internal/app/icons.go` (`IconService`), `main.go`,
`docs/ipc.md`, bindings, tests.
- [x] Failing tests: `TestListPairsDarkFiles` (`a.svg` and `a.dark.svg` are
  one icon); `TestAddCopiesAndNamesByFile` (a clash gets `name-2`; a
  folder adds its `.svg` files, not deeper); `TestAddRefusesWhatIsNotSVG`;
  `TestRenameMovesThePair`; `TestDeleteMovesThePairToTheBin` (the
  platform's trash, as Space trash does not apply); a file dropped into
  the folder by hand is listed, sanitised as it is read.
- [x] `IconService.List() []CustomIcon{Name, SVG, DarkSVG}`,
  `Add() ([]string, Problem)` (the chooser), `Rename`, `Delete`,
  `ShowFolder`. The folder is made on first use.
- [x] Green: `go test ./internal/icons ./internal/app -run Icon` and
  `wails3 generate bindings -f '' -clean=true -ts -i`

### Task 16: The Custom tab
**Files:** `frontend/src/shell/icon-picker.svelte.ts`,
`components/IconGrid.svelte`, `App.svelte`, `canvas/icons/sets.ts`, tests.
- [x] Failing tests: "the Custom tab lists the library each time it opens";
  "a custom icon draws in its own colours, the dark copy on a dark
  canvas"; "right-click on a tile offers Rename and Delete"; "a deleted
  icon's elements draw the missing box".
- [x] Green: `npx vitest run src/shell/icon-picker src/canvas/icons`;
  `npm run browser` for the Custom tab.

# Part 3: D2 icons

### Task 17: Go carries the icon
**Files:** `internal/render/layout_geometry.go`, `docs/ipc.md`, test.
- [x] Failing test: `TestLayoutCarriesIcon` (a name and a web address come
  through as written; a shape with an icon is never smaller than without:
  D2 makes room for it in the box, so "unchanged" was wrong). Expected
  failure: `LayoutShape` has no `Icon`.
- [x] `LayoutShape.Icon string` from `d2target.Shape.Icon`. Nothing reads
  the address; the header comment updated.
- [x] Green: `go test ./internal/render`; bindings regenerated.

### Task 18: Conversion
**Files:** `frontend/src/canvas/import/icon-names.ts`,
`frontend/src/canvas/import/convert.ts`, tests, a fixture.
- [x] Failing tests: `icon-names.test.ts` (`.../112-server.svg` is
  `server`; `Postgres.SVG` is `postgres`; an alias of a logo resolves; the
  order is custom, line, logo); `convert.test.ts` "a shape with a known
  icon becomes an icon with its label and its connections";
  "a container keeps its frame and gets an unlabelled icon top-left";
  "an unknown icon leaves a plain shape and is reported".
- [x] **Exit test:** `convert.test.ts` "conversion never yields a remote
  icon": every icon in the output is `<set>/<name>`, never an address,
  over a fixture of names, `http`, `https`, `data:` and `file:` values.
- [x] Green: `npx vitest run src/canvas/import`

### Task 19: The dialog's note
**Files:** `frontend/src/components/d2-diagram-status.ts`,
`D2DiagramDialog.svelte`, `i18n/messages.ts`, tests, the visual reference.
- [x] Failing test: "the status names icons not found; Insert stays on".
- [x] The preview SVG keeps passing through `withoutRemoteRefs` (a test
  that an icon address in the D2 never reaches the preview).
- [x] Green: `npx vitest run src/components/d2-diagram-status`;
  `npm run browser`.

## Artifacts

- `docs/file-format.md`: the `icon` element (part 1).
- `docs/ipc.md`: `IconService` (part 2), `LayoutShape.icon` (part 3).
- `docs/decisions.md`: the icon element and its sets; custom icons in
  Bava's config folder; D2 icons by name, never fetched (superseding the
  "never fetched" row's wording where needed).
- `.ai/rules/canvas.md`, design-system inventory, `NOTICE`.
- `docs/release-checklist.md`: icons crisp at 400% on each webview; a
  custom SVG with gradients draws the same on all three.
- Mockup: boards 4.15 to 4.20 replaced by the screens as built.

## Out of scope

Per-service cloud icons (custom icons cover them); colouring custom icons;
icons in pages; carrying custom icons inside a Space; watching the icons
folder while the picker is open; a keyboard shortcut for Icon.

## As built

### Part 1

- The sets come from a Vite plugin in `frontend/tooling/icon-sets.ts`,
  serving `virtual:bava-icons/line|solid|logo` to the app, the browser tests
  and Vitest alike; logos are filtered by their licence there (3,338
  shipped, 128 not). The 83 under MIT, Apache-2.0 or BSD are credited in
  `frontend/public/LOGO-LICENCES.txt`, written by `npm run icons:credits`
  and checked against the set by a test; `NOTICE` points to it (the
  maintainer chose crediting each over leaving them out).
- Bundled icons draw as vector paths (`Konva.Path`), not pictures: every
  part of both line sets is a path, a few filled or faded. The parts,
  colour, label layout and bounds live in `canvas/icons/icon-look.ts` for
  the stage and the SVG export; the PNG draws through the stage.
- The General tab lists each line icon followed by its filled version;
  filled icons are named `solid/<name>`.
- Tiles in the picker are Svelte SVG markup (bundled) or a picture (custom),
  never raw HTML.
- Beyond the plan: `iconsArrived` redraws the whole element, so a logo's
  label takes its Brand colour once the logos load; a resize measures an
  icon's label again (`iconLabelSize` pointer option); flipping mirrors an
  icon about its square, not its label; frame embeds and page pictures wait
  on `iconsReady`; the picker resets when the + panel opens; keys on its
  tabs stay with the tabs. Found by the spec review.
- Until part 2 reads the library, the custom set starts empty, so a custom
  icon shows as missing.
- Placing is at the view's centre only, as Picture places; the right-click
  menu has no Icon entry.
- Not built: a PNG unit test (the PNG is the stage's drawing, tested there);
  an alias table for renamed names (no shipped name has changed; the set
  counts are pinned by test, so an update that drops names fails); a
  rotated icon's label is edited at its square only. A set that fails to
  load draws nothing on the stage, and the missing box in an export.
- Gates: go vet, go test, check, lint, `npm test` 3,219 passed, `npm run
  browser` (new pictures `canvas/icons--100--*`, `canvas/icon--selected--*`,
  and the controls and canvas-chrome sheets, read in both themes).

### Part 2

- `internal/icons`: `Sanitise` and `Library`; `internal/app/icon_library.go`
  is `IconService` (List, Add, Rename, Delete, ShowFolder), registered in
  `main.go` with `config.IconsDir` (new beside `config.Dir`). Its files are
  named `icon_library*` because `internal/app/icons_test.go` already holds the
  app icon's tests.
- The cleaner keeps an allow-list of drawing elements and drops everything
  else with what it holds (scripts, animations, foreign content, other apps'
  markup). It never writes a stylesheet: a `<style>` is gathered whole and
  only its plain class rules are moved onto the elements they style as
  `style` attributes. Every kept value is refused if it holds an escape or
  an `@`, or calls any function but colours, transforms and `url(#id)`; an
  internal url() is written plainly. One root only; a `>` in a value is
  escaped. This replaced a first version the spec review broke (a comment or
  CDATA could split an import, capitals and escapes passed). A second
  review broke that too (a `srcset` on a picture inside a `<title>`, which a
  page reads as its own element; class rules copied without bound), so the
  cleaner now keeps an allow-list of drawing attributes as well as elements,
  keeps a title's or description's words only, counts a class named twice
  once, and refuses a drawing more than four times its file's size. A third
  and fourth pass bounded the stylesheets as a whole (one budget for every
  `<style>` in the file, counted as each element gathers its classes), took
  every style off the root, and capped nesting at 256; the last pass found
  no bypass.
- The preview's `withoutRemoteRefs` also drops style imports, image sets and
  outside url()s, as a second layer.
- Names: what Rename and Delete are given must be a name, never a path; a
  file added gets a name every platform can hold (unsafe characters become
  dashes, Windows device names get "-icon"); the library's own files end in
  lower-case `.svg`; a rename never overwrites an icon or a dark copy and is
  undone if its dark copy cannot follow.
- Changed from the plan: Delete moves to the library's own `.trash/`, not the
  system trash (no system-trash helper exists, and one inside every store's
  sandbox is a sizeable job of its own); Add picks files, not a folder (a
  combined dialog is unreliable on Windows; `Library.Add` takes folders, and
  dropping one into the library folder works); renaming a custom icon leaves
  canvases naming the old name showing it missing.
- Frontend: `canvas/icons/library.ts` reads the library, drops a read that
  answers after a newer one, and makes each SVG a picture once before it
  answers; the stage draws a custom icon from `setIconPicture`, its dark copy
  on a dark canvas, in its proportions; the SVG export nests its drawing with
  ids prefixed by the element's; the PNG makes its pictures first. The
  Custom tab has Add icons, Show folder, and a right-click menu with Rename
  (typed in place, settled once by Enter, Escape or leaving the field) and
  Delete; it reads the library each time it opens and once after each
  change, and shows dark copies in a dark theme. A refused name shows Go's
  reason, which names it; other problems are the app's own words.
- The whole library is sent on each read, as text; documented in
  `docs/ipc.md` as the cost of icons carrying large embedded pictures.
- Not built: an end-to-end walk through the native file dialog (the browser
  tests drive Add through the stand-in service).

### Part 3

- Go carries `LayoutShape.Icon`, the `icon:` as written; nothing reads it.
  A test points icons (plain, `shape: image`, on a SQL table) at a local
  server and finds it never asked: D2 v0.9.0 fetches only through a resolver
  Bava never gives it.
- `canvas/icons/d2-names.ts` turns a value into a name (an address's file
  name, lower-cased, its picture extension and a leading number dropped;
  nothing for data) and looks it up in the custom library, the general
  icons, the logos, then the logos' titles and other names. Conversion
  (`canvas/import/convert.ts`) stays pure and takes this as `resolveIcon`.
- A shape with a found icon becomes that icon, its side the box's shorter
  side, centred where D2 put the box, its label under it (measured as it
  lands, through `fitArriving`); its arrows attach to it, their ends moved
  from D2's box to the icon's square (D2 makes the box larger to hold the
  icon, so the square is never smaller than the plain shape). A container
  keeps its frame and gets the icon, 24 across, 8 in from its top-right
  corner (the frame's label holds the top-left), unlabelled. A table or
  class takes no icon and is not named as missing one. A shape whose icon is not found stays a plain shape; the
  dialog's status line names the icons not found.
- The sets load as the D2 dialog opens (and the library is read again), so
  the status line knows what is missing as the diagram is typed; Insert
  waits for them in the rare case they have not arrived.
- Exit test: `convert.test.ts` "conversion never yields a remote icon",
  over names, http, https, protocol-relative, file, data and ftp values,
  with the real lookup; no element carries an address.
- The stand-in renderer lays out `name: { icon: value }` lines, drawing
  D2's icon pictures by address in its preview, for a browser test through
  the dialog to the saved file: no request leaves for the address, the
  preview holds none, Insert stays on, the label and its measured size are
  saved.
- From the spec review: Insert reads the layout as pressed, presses once
  while it waits for the icons, and inserts nothing if the dialog closed
  meanwhile; the missing-icon note is worked out again after each library
  read; a picture carried as data is named briefly, a Windows path read, a
  leading number dropped from an address's file name only; the status line's
  joiners are messages. The page-embed insert shares the code but has no
  browser test of its own.
