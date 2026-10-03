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

## What still needs you

Before a release, a short pass on your own Mac for feel: the menu bar, the
native pickers, ⌘ shortcuts, scrolling and trackpad gestures. Everything
else is covered above.
