# Testing

How Bava is checked, where each check runs, and how to run it.

## Where things live

```
tests/                         how the tests run
  docker/visual.Dockerfile     the screen-check container (layer 2)
  scripts/visual.sh            runs layer 2 in that container
  e2e/scenarios/*.json         the smoke walks (layer 3)
frontend/tests/visual/         layer 2's code: the stand-in Go side, the walks
internal/e2e/                  layer 3's driver, Go side (built only with -tags e2e)
frontend/src/e2e/              layer 3's driver, page side (the same)
testdata/golden/               D2's expected SVGs
testdata/visual/               layer 2's approved screenshots
```

## The three layers

| Layer | What it checks | On your Mac | On GitHub CI |
|---|---|---|---|
| 1. Logic tests | Behaviour: what the code does, with nothing drawn | Yes, directly | Yes |
| 2. Screen checks | What every screen looks like, in both themes | Yes, in a container | Yes, the same container |
| 3. Smoke runs | The real app doing a real job end to end | No | Yes: Linux, macOS, Windows |

### 1. Logic tests

```sh
go test ./internal/... .
(cd frontend && npm run check && npm run lint && npm test)
```

Fast, and blind to drawing: they run without real layout or styles.

### 2. Screen checks

The interface runs in a real WebKit browser (the engine macOS gives Bava),
with the Go side replaced by a stand-in over a pretend Space. Scripted walks
open each screen and dialog, and each screenshot is compared pixel by pixel
with its approved reference in `testdata/visual/`. They also check that
nothing covers the window at launch.

Needs OrbStack (or another Docker) running. The container sees the repo
read-only, writes its results to `frontend/tests/visual/.results/`, and makes
no network calls while it tests.

```sh
cd frontend
npm run visual           # check; differences land in tests/visual/.results/
npm run visual:update    # accept an intended change (look at every image first)
```

A reference is named `testdata/visual/<area>/<screen>--<state>--<theme>.png`,
for example `testdata/visual/dialogs/trash--with-items--dark.png`.

### 3. Smoke runs

A test build of Bava (`-tags e2e`) follows three scenarios in turn, each a
fresh launch, taking screenshots on the way:

- `create`: make a Space in a scratch folder and two pages, write in the
  Document (a page link, an equation, a code block, an image, a file, an
  online video, a table), draw a shape on the canvas, and save.
- `reopen`: open that Space again, check Media, rename a page, and show the
  canvas.
- `canvas`: draw shapes and an attached arrow, move, undo and redo, insert a
  diagram with Diagram from Code, save, and read the saved file back for the
  shapes, the bindings and the diagram's labels.

It answers the native pickers from the scenario. It runs on GitHub's Linux,
macOS and Windows machines after a push; the screenshots are attached to the
run.

Release builds never contain the driver: it exists only with the `e2e` tag,
and a test fails if a default build has it.

## The standard

Every test follows these. A change that adds or touches tests leaves them
following these.

### Everywhere

- **One behaviour per test, named as a sentence about it.** Before writing
  it, name the change to the code that would make it fail; if there is none,
  it tests nothing.
- **No fixed sleeps.** Wait for a sign that something happened, or use fake
  time. A wait that proves something did not happen first waits for what the
  action would have produced. The one exception is the screen checks'
  `personPace`: a person's pause, for readiness the page never shows (a
  listener not yet attached), used only where no signal exists.
- **No shared state between tests.** Each test sets up what it needs and the
  shared teardown removes it.
- **Retries only for a named cause.** A retry loop carries a comment saying
  what it waits out, and gives up within five seconds.

### Go tests

- `x_test.go` beside the code, in package `x_test`; package `x` only to reach
  something unexported, with a comment saying what.
- `Test<Subject><Behaviour>`, e.g. `TestRenameNeverReplacesAnotherFile`.
- A table with `t.Run(name)` when one behaviour is checked over several
  inputs; otherwise one function per behaviour.
- Shared helpers come from `internal/testutil`: repo paths, writing a tree of
  files, JSON keys, goldens. `t.TempDir` for files, `t.Cleanup` to restore
  anything changed, `t.Helper` in every helper.
- Every result type the frontend reads has a test pinning its JSON keys, in
  the package that defines it.
- A skip states its reason (the platform or filesystem that cannot do it).

### Frontend unit tests

- `x.test.ts` beside the module; `x.svelte.test.ts` only when the test itself
  uses runes. Node by default; `// @vitest-environment jsdom` only when the
  test needs a page.
- `describe` names the unit (a component or a function); each `it` is a
  behaviour.
- Components mount through `render()` from `src/test/render.ts`, the page
  editor through `src/docs/test-editor.ts`. The shared teardown in
  `src/test-setup.ts` unmounts everything, lets pending work finish, empties
  the page and restores real timers, so no test does its own.
- Spies restore themselves after each test (`restoreMocks`); a file that
  mocks a module with `vi.mock` clears those mocks itself.
- Fixtures sit in `__fixtures__/` beside the module. A test that reads a
  committed file as a contract (the menu spec, `docs/shortcuts.md`) finds it
  from its own location, never the working folder.
- What something looks like (classes, copy, markup) belongs to screen checks,
  not here.

### Screen checks

- One area, two files: `specs/<area>.spec.ts` takes the pictures, in both
  themes; `specs/<area>-actions.spec.ts` checks behaviour on the page or the
  saved file, in light only.
- Every helper comes from `specs/helpers.ts`; a spec defines none of its own.
- Before each picture, assert what makes it right (the counts, the focus,
  which row is checked or highlighted, images loaded) and move the pointer
  off what is pictured. Highlight and checked state is always read from the
  page, never trusted to the picture (headless WebKit can paint it late).
- Crop to what is pictured: `shotPane`, `shotDialog`, `shotFloating`. Only
  `start` and `shell` picture the whole window.
- References are `<area>/<screen>--<state>--<theme>.png`: the screen a
  singular noun that does not repeat the area, the state a short word.
- A full run lists any reference no test compared, to be deleted.
- The coverage table below changes in the same change as a walk.

### Smoke runs

- A scenario does one job and ends by reading back, with `file` steps, what
  it saved. The scenarios run in order on one scratch folder: `create`, then
  `reopen`, then `canvas`.
- A failing step takes a screenshot before the run reports.
- Native menus and accelerators are not reached by a scenario (`menu` steps
  send the command); they stay a check by hand.

## What the screen checks cover

Each area has its pictures in `specs/<area>.spec.ts` and its references in
`testdata/visual/<area>/`; behaviour is checked in `specs/<area>-actions.spec.ts`.
`canvas-actions` and `floating-actions` take no pictures: what the canvas does,
read from the saved file, and that anything floating closes on a press
elsewhere.

| Surface | Covered | Where |
|---|---|---|
| Every component in `src/components`, alone, in each state it shows: rest, hovered, focused from the keyboard, pressed, checked, disabled, open, empty, an error, loading, long text | Covered, both themes; `harness/gallery.test.ts` fails on a component with no demo or no picture | `gallery` (the page `harness/gallery.html`, one demo per component in `harness/gallery/demos/`) |
| Splash | Covered at launch, its settings held so it stays (the backstop's clock stands still), and alone | `shell`, `gallery` |
| Start screen, with and without recent Spaces | Covered; nothing covers the window at launch | `start`, `start-actions` |
| Shell: Both, Document, Canvas, no page, a page in no Space, Files hidden with the AI pane shown, the split between Files and Media dragged and let go | Covered; the Document and Canvas sides and the side pane have no splitter (their widths are fixed), so there is nothing else to drag | `shell` |
| Space tree: Files, a folder open, folded, naming a page, Media, switcher with and without recent Spaces, Add menu, the right-click menu on a page, a folder and below the rows, renaming a row and a name taken, a page dragged into a folder and between two rows, and dropped | Covered | `space`; renaming in `document-actions` |
| Document: text, headings, marks, lists, to-dos, quote, coloured paragraph, divider, code | Covered | `document` (`page--everything`) |
| Document: callouts, toggles, contents, code block, equations, footnotes | Covered | `document` (`block--*`) |
| Document: images and a video at each width, shape and alignment, a missing image | Covered | `document` (`media--*`) |
| Document: file and web cards, an online video | Covered | `document` (`card--*`) |
| Document: tables in both forms, merged, moved, pasted, a new one | Covered | `document` (`table--*`) |
| Document: date chips, links between pages, Linked from | Covered | `document` |
| Document: locked page, widths, find | Covered | `document` |
| Document floating UI: / and @ menus, emoji, bubble, block, page, language, media, card and table menus, equation field, calendar, link card, full screen | Covered | `document`; closing in `floating-actions` |
| Document: the link field (⌘K) and a caption field | Covered over a page: the link field over a word, and over a link with its address and Remove link, an image's and a video's caption field, a file card's name field; alone in the gallery, empty, linked and as a caption; closing is checked | `document-blocks`, `gallery`, `floating-actions` |
| Every block and inline type of `docs/schema.ts`, each on a page of its own: at rest, hovered with its handle, selected, being edited (a word under the formatting bubble, or its field: equation, code caption, caption, file name, link), emptied, and unable to draw (bad TeX, a missing video, file or page) | Covered, both themes; a block of text is never selected whole, so it is pictured being edited instead; `harness/document-blocks.test.ts` fails on a schema type with no picture in a state and no reason given | `document-blocks` (subjects and reasons in `harness/document-blocks.ts`) |
| Canvas elements: every shape, colour, style, arrow and head, frames and groups, turned, a diagram, many | Covered at 100% and 200% | `canvas-look` |
| Every canvas element kind (each shape; a line open, bent, round and closed; a straight, arc and elbow arrow; a stroke; text; code with and without a language; a frame; a group) at rest, selected, a handle hovered, locked, turned, with a label too long for it, being edited, under the eraser, and an arrow with a detached end | Covered, both themes; a hovered handle and an edited label also at 200%; a locked element cannot be selected, so locked is pictured as Select All selecting none and the Unlock All menu; `harness/canvas-elements.test.ts` fails on an element type of `canvas/scene.ts` with no pictures in a state and no reason given | `canvas-elements` (kinds and states in `harness/canvas-scenes.ts`) |
| Canvas states: each kind selected, all selected, marquee, rotating, points, snapping, arrow ends | Covered | `canvas-states` |
| Canvas controls: every picker, More, right-click menu and its submenus, insert panel, the toolbar of each kind, a tooltip on a tool and on a toolbar button | Covered; submenus in dark only, as headless WebKit paints a light menu's moved highlight late, so light's are checked by hand | `canvas-states` |
| Canvas: an empty canvas, with the tool rail and the zoom buttons | Covered; the zoom buttons open no menu | `canvas-states` |
| Dialogs: New Space (empty, ready, a name taken, a name no folder can have), Space settings (default, changed, the name emptied, a name taken), Trash (items, attachments, empty, searched, nothing matching), Media (and renaming, a name taken), every confirmation (delete for good, delete a file pages use, Empty Trash, unsaved changes, a file changed on disk), Shortcuts, About, Export (at rest, at 1× and 3×, no background, dark, something selected, only selected), Diagram from Code (empty, code D2 cannot read) | Covered; a name Go refuses in New Space or Media is told under the name, in the dialog, which stays open; one Space settings refuses is told in the status bar, as the dialog closes, so that is what is pictured for it; Escape while renaming in Media leaves the rename, not the dialog | `dialogs`, `dialogs-actions`, `canvas-states`, `gallery` |
| Unexpected error dialog: an error from Go, a failure the page left unhandled, the last session closed unexpectedly with and without its log, the window reloaded | Covered; a second error goes to the status bar (`shell`, `notice--another-error`) | `dialogs`, `gallery` |
| A pane that failed to draw | Covered: the Files pane in the window, made to fail by a listing it cannot draw, and the boundary alone; the Document and Canvas panes wear the same boundary and are not made to fail | `shell`, `gallery` |
| Settings, each tab | Covered at the defaults and with every control changed: following the system and narrow pages, autosave after a delay and when focus leaves, a delay held at its shortest, each canvas setting turned, verbose logging | `settings` |
| Status notices: every message the status bar shows (another error, a name Go refuses, settings that could not be read, a setting that could not be saved) and autosave paused for a change on disk and for a failed save | Covered | `shell` (`notice--*`) |

The smoke runs follow one chain on one scratch folder. `create` makes the
Space, writes a page with a link, maths, code, an image, a file card, an
online video and a table, draws a shape, saves, and reads the file back for
each. `reopen` opens that Space, checks the page, Media and a
rename's link, and reads back the rewritten link. `canvas` draws on that page,
inserts a diagram, saves, and reads back the shapes, bindings and labels. A
step that fails stops the chain where it is.

## What still needs you

Before a release, a short pass on your own Mac for feel: the menu bar, the
native pickers, ⌘ shortcuts, scrolling and trackpad gestures. Everything
else is covered above.
