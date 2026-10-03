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
  action would have produced.
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
- Mocks restore themselves after each test (`restoreMocks`).
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

## What still needs you

Before a release, a short pass on your own Mac for feel: the menu bar, the
native pickers, ⌘ shortcuts, scrolling and trackpad gestures. Everything
else is covered above.
