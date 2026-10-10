# Testing

How Bava is checked, where each check runs, and how to run it.

## Where things live

A folder names a test's layer.

```
frontend/src/**/<module>.test.ts       unit tests, beside the code
frontend/src/**/__fixtures__/          their fixtures
internal/**/<name>_test.go             Go unit tests, beside the code
frontend/tests/                        browser tests (Playwright, in Docker)
  playwright.config.ts                 two projects: visual and integration
  helpers.ts                           shared by both
  visual/<area>[-<topic>].spec.ts      visual regression: screenshots only
  integration/<area>.spec.ts           integration: behaviour, no screenshots
  harness/                             the app with a stand-in Go side
  fixtures/                            scenes, pages and the sample Space
tests/
  e2e/<scenario>.json                  end-to-end scenarios (CI only)
  docker/browser.Dockerfile            the browser-test container
  scripts/browser.sh                   runs the browser tests in it
internal/e2e/, frontend/src/e2e/       the end-to-end driver (built only with -tags e2e)
testdata/
  golden/                              D2's expected SVGs
  visual/<area>[-<topic>]/             approved screenshots
  fixtures/media/, fixtures/links/     input files
```

Areas are named the same in spec files and reference folders: `canvas`,
`components`, `dialogs`, `document`, `settings`, `shell`, `space`, `start`.
A topic (`<area>-<topic>`) splits an area grown too large for one file.

## The four layers

| Layer | What it answers | On your Mac | On GitHub CI |
|---|---|---|---|
| Unit | Is the logic right? Does simulated input on the canvas or page give the right data? | Yes, directly | Yes |
| Integration | Does it behave right in a real browser (selection, focus, layout)? | Yes, in a container | Yes, the same container |
| Visual regression | Does every screen still look the same, in both themes? | Yes, in a container | Yes, the same container |
| End-to-end | Does the real app do a real job on each system? | No | Yes: Linux, macOS, Windows |

### Unit

```sh
go test ./internal/... .
(cd frontend && npm run check && npm run lint && npm test)
```

Fast, and blind to drawing: they run without real layout or styles.

### Integration and visual regression

Both run the interface in a real WebKit browser (the engine macOS gives
Bava), with the Go side replaced by a stand-in over a pretend Space.
Integration tests act on the page and check what it did. Visual regression
tests picture each family of things once per theme, and each screenshot is
compared pixel by pixel with its approved reference in `testdata/visual/`,
almost exactly: a pixel may differ only by the few steps of colour that edge
smoothing varies run to run. They also check that nothing covers the window
at launch.

Needs OrbStack (or another Docker) running. The container sees the repo
read-only, writes its results to `frontend/tests/.results/`, and makes no
network calls while it tests.

```sh
cd frontend
npm run browser                            # both; differences land in tests/.results/
npm run browser -- --project=visual        # screenshots only
npm run browser -- --project=integration   # behaviour only
npm run browser:update                     # accept an intended change (look at every image first)
```

A reference is named
`testdata/visual/<area>[-<topic>]/<screen>--<state>--<theme>.png`,
for example `testdata/visual/dialogs/trash--with-items--dark.png`.

### End-to-end

A test build of Bava (`-tags e2e`) follows three scenarios (`tests/e2e/`) in turn, each a
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
  action would have produced. The one exception is the browser tests'
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
  uses runes. A component sharing its name with a module beside it
  (`Keycaps.svelte`, `keycaps.ts`) tests in `x-component.test.ts`. Node by default; `// @vitest-environment jsdom` only when the
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
- What something looks like (classes, copy, markup) belongs to visual regression tests,
  not here.

### Browser tests

- **A picture shows what no other picture or test shows.** A family of
  things sits on one sheet, its states side by side: the component sheets
  (`harness/gallery/sheets.ts`), the canvas scenes, the Document's pages. A
  state the page can say (pressed, disabled, checked, open, chosen, a count)
  is asserted as data before the picture; the sheet shows it once so its
  look is guarded.
- **A picture shows a finished state.** It is set through fixtures (a seeded
  scene or page, a demo's props) or one direct action (a click that opens a
  menu, a drag held). How it is reached is an integration or unit test.
- `visual/<area>[-<topic>].spec.ts` takes the pictures, in both themes.
  `integration/<area>.spec.ts` checks behaviour on the page or the saved
  file, takes no pictures, and runs in light only.
- Hovered, focused and pressed are forced on a sheet, not reached with the
  pointer: in the test page every `:hover`, `:focus-visible` and `:active`
  rule also matches `data-force="hover"`, `"focus"` or `"active"`
  (`harness/force-states.ts`); a `Cell` sets it, or a component's own state
  attribute (`data-hover`, `data-focus-visible`). A state inside `:not()` is
  left alone.
- A sheet opens with nothing holding focus (`openSheet`). A piece that opens
  on a press is pictured opened, one at a time: everything else on the sheet
  is hidden while it is taken.
- Pictures leave out the browser's text selection (`harness/screenshot.css`):
  headless WebKit paints it at one of two strengths by a window state no test
  sets. Which text is selected is asserted from the page.
- Every helper comes from `tests/helpers.ts`; a spec defines none of its own.
  Prepared scenes, pages and the sample Space live in `tests/fixtures/`.
- Before each picture, assert what makes it right (the counts, the focus,
  which row is checked or highlighted, images loaded) and move the pointer
  off what is pictured.
- Crop to what is pictured: `shotPane`, `shotDialog`, `shotFloating`. Only
  `start` and `shell` picture the whole window.
- References are `<area>/<screen>--<state>--<theme>.png`: the screen a
  singular noun that does not repeat the area, the state a short word.
- A full run lists any reference no test compared, to be deleted.
- The coverage table below changes in the same change as a walk.

### End-to-end

- A scenario does one job and ends by reading back, with `file` steps, what
  it saved. The scenarios run in order on one scratch folder: `create`, then
  `reopen`, then `canvas`.
- A failing step takes a screenshot before the run reports.
- Native menus and accelerators are not reached by a scenario (`menu` steps
  send the command); they stay a check by hand.

## What the browser tests cover

Pictures, about 140 per theme (`testdata/visual/`):

| Area | Pictured | Guard |
|---|---|---|
| `components` | Eight sheets (controls, pickers, menus, fields, canvas chrome, side pane, document floating, feedback), every state of each component side by side; and each piece that opens on a press, opened: the arrowheads picker and its More, the opacity slider, the colour swatches, the right-click menu, the Space switcher, tooltips; the Files tree naming a page | `harness/gallery.test.ts`: every component is on a sheet or in a screen, once |
| `canvas` | Every seeded scene (`fixtures/canvas-scenes.ts`), two also at about 200%; the empty canvas; one element of each kind of selection chrome selected; everything selected; a handle hovered, also at 200%; a turned shape; long labels; a label and a code block edited; a detached arrow end; the eraser, a marquee, rotating, point editing, snap guides, a shape moving with its position shown, and an arrow's end over a shape, each mid-drag | `fixtures/canvas-scenes.test.ts`: every element type is drawn in a scene |
| `document` | Sheets of every block, every inline piece and mark, every block unable to draw, and every block empty (`fixtures/document-blocks.ts`); media at each width, tables in both forms, cells selected and merged, a node selected, a canvas embed from another page and one whose frame is gone, a tag being added, a code caption edited, a selection under the bubble, a block's handle and menu, the placeholder, a locked page, Linked from, find, page widths, media full screen | `fixtures/document-blocks.test.ts`: every schema type is on a sheet |
| `dialogs` | Each dialog in its main state, and the variants with a layout of their own: the Tags dialog managing several and its delete asked, the Templates dialog, Save as template, Trash with attachments and empty, Media chosen, as a list and renaming, a delete asked first, an error without details, the export previews, a name taken, code D2 cannot read; the search palette before typing, with results and with none; find on the Canvas with its matches outlined | |
| `settings`, `shell`, `space`, `start` | Each settings tab; the window in each view, a template being edited under its bar, with no page, with the AI pane, a loose page, the splash, a failed pane, a status notice; the side pane open and folded, the tree narrowed by tags and the tag list, New page from template in Add, Media, a page dragged onto a folder and between rows; the start screen with and without recents | |

Behaviour in a real browser (`integration/`): what the canvas does, read from
the saved file; components reached by keys and pointer; the page typed and
pointed at; dialogs as they change; settings changed; the window's notices
and splitter; the side pane's menus, renaming and moves; tags added on a page and written to its
header, the tree narrowed by tags, and tags renamed, merged and deleted in
other pages' files from the tag list and the Tags dialog; templates made
into pages (links and images still right), pages saved as templates in a
group and a replace asked, a template edited under its bar and Done, a
template deleted after asking; canvas embeds
made from `/` and from a frame's right-click, their picture saved and their mark written, and
one clicked opening its frame selected beside the page; anything floating
closing on a press elsewhere.

The end-to-end scenarios follow one chain on one scratch folder. `create` makes the
Space, writes a page with a link, maths, code, an image, a file card, an
online video, a table and a tag, saves it as a template, draws a shape, saves, and reads the file back for
each. `reopen` opens that Space, checks the page, Media and a
rename's link, and reads back the rewritten link. `canvas` draws on that page,
inserts a diagram, saves, and reads back the shapes, bindings and labels;
then makes a diagram from the page with `/`, which lands in a new frame
embedded in the page, and reads back the embed's mark, the frame and its
picture. A
step that fails stops the chain where it is.

## Trying a build

Every CI run keeps the app it built, for 14 days: on the run's page in
GitHub, under Artifacts, `bava-macos-<commit>`, `bava-windows-<commit>` and
`bava-linux-<commit>`. The builds are unsigned: on macOS, the first launch
is refused; then System Settings, Privacy & Security, Open Anyway lets it
run (or `xattr -dr com.apple.quarantine bava.app` in Terminal).

## What still needs you

A change you would notice by eye or hand (a new tool, a dialog, a feel) is
worth trying in that build. Before a release, a short pass for feel: the menu
bar, the native pickers, ⌘ shortcuts, scrolling and trackpad gestures.
