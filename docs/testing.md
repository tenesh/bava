# Testing

How Bava is checked, where each check runs, and how to run it.

## The four layers

| Layer | Where | Command |
|---|---|---|
| Unit (Go, Vitest) | host and CI | `go test ./internal/... .` and `(cd frontend && npm run check && npm run lint && npm test)` |
| Integration (`frontend/tests/integration/<area>.spec.ts`) | Docker, host and CI | `cd frontend && npm run browser -- --project=integration` |
| Visual regression (`frontend/tests/visual/<area>[-<topic>].spec.ts`) | Docker, host and CI | `cd frontend && npm run browser -- --project=visual` |
| End-to-end (`tests/e2e/<scenario>.json`) | CI only: Linux, macOS, Windows | none locally |

Unit tests run without real layout or styles, so they are blind to drawing.
Areas: `canvas`, `components`, `dialogs`, `document`, `settings`, `shell`,
`space`, `start`.

## Browser tests

- Start OrbStack (or another Docker) first. `npm run browser` runs both
  projects in `tests/docker/browser.Dockerfile` via `tests/scripts/browser.sh`.
- WebKit, with the Go side replaced by a stand-in (`frontend/tests/harness/`)
  over a pretend Space. The repo is mounted read-only, there is no network,
  results land in `frontend/tests/.results/`.
- Helpers come only from `frontend/tests/helpers.ts`; fixtures (scenes, pages,
  the sample Space) from `frontend/tests/fixtures/`.

## Pictures

- References: `testdata/visual/<area>[-<topic>]/<screen>--<state>--<theme>.png`,
  both themes, compared pixel by pixel (only edge-smoothing noise tolerated).
- `npm run browser:update` accepts a change. Look at every new image first.
- One sheet per family of things, every state side by side
  (`harness/gallery/sheets.ts`). Assert state as data before the picture.
- Pictures show a finished state, set by fixtures or one direct action.
  Hover, focus and press are forced with `data-force` (`harness/force-states.ts`).
- Crop with `shotPane`, `shotDialog`, `shotFloating`; only `start` and `shell`
  picture the whole window. Text selection is hidden (`harness/screenshot.css`).
- A full run lists references no test compared, to be deleted.

## End-to-end

A build with `-tags e2e` (the driver in `internal/e2e/` and `frontend/src/e2e/`)
runs each scenario on a fresh launch, answering native pickers from the
scenario's `folders`, `files` and `saves`. The `walks` job runs them on each
system; its screenshots are kept as `walks-<os>`, and a failing step takes
one and stops the chain. A failed result also says what had focus, whether
a new page or folder was waiting to be named, and the app's last 40 log
lines, so a run that kept nothing else still shows what led up to it. A default build must not contain the driver: the
`release check` job checks the frontend bundle, `release_test.go` (in
`test`) the Go side.

| Scenario | Does |
|---|---|
| `create` | New Space, two pages, a Document with link, maths, code, image, file, online video, table, tag; saved as a template; a shape drawn; saved and read back |
| `reopen` | Reopens it, checks Media, renames a page, searches, exports a zip and PDFs and reads them back |
| `canvas` | Shapes and an attached arrow, move, undo, redo, D2 diagram, an embed from `/`; reads back shapes, bindings, labels, embed |
| `export-proof` | System printing to PDF: A4 portrait, Letter landscape, A3 no margins, and a page over 2 MB |
| `import` | Imports the zip `reopen` wrote into a new folder of that Space: pages, their picture address rewritten, a link kept, a template numbered to keep both |

| Step | Takes |
|---|---|
| `click`, `menu`, `gone` | `target` (a selector; a menu command id for `menu`) |
| `wait` | `target`, optional `text`, `timeoutMs` |
| `type`, `key`, `paste` | `text`; `key` takes `modifiers` (`shift`, `alt`, `mod`) |
| `drag` | `target`, `from`, `to` as `[x, y]`, `modifiers` |
| `pause` | `timeoutMs` |
| `shot` | `name` |
| `file` | `target` (path in the scratch folder), `text` it must hold |
| `zip` | `target`, `text`: `holds=` and `lacks=`, items apart by `;` |
| `pdffile` | `target`, `text`: `min=` sheets, `first=` / `last=` size in mm |
| `pdf` | `target`, `name` as `paper/orientation/margins[/heavy]`, `text` as `pages=2 size=210x297` |

Inside the Mac App Store's sandbox, the `store walks (macos)` job packs
the end-to-end build as an `.app`, signs it ad hoc with
`build/darwin/entitlements.sandbox.plist` and runs the same walks with
`BAVA_E2E_SANDBOX=1`: the build lays each walk out in its own container
(its scenarios and fixtures are built in) and leaves its result there.
Screenshots the sandbox refuses are skipped, not failures.

As the Microsoft Store ships Bava, the `store walks (windows)` job packs
the end-to-end build as an MSIX (`build/windows/msix/app_manifest.xml`),
signs it with a certificate it makes, installs it and starts it through
Windows. A package starts without the shell's environment, so each walk is
named in `~/.bava-e2e` and lays itself out in the home.

As Flathub ships Bava, the `store walks (linux)` job packs the end-to-end
build with a test-only manifest (`tests/flatpak/bava-ci.yml`, ID
`com.tharabyte.bava.Devel`, never submitted), installs it and runs the walks
with `flatpak run`; each lays itself out in the app's own folder,
`~/.var/app/com.tharabyte.bava.Devel`.

What each store walk leaves (results, screenshots, logs) is kept as
`store-walks-<os>`; the browser tests' results, on a failure, as `browser`.
Every job's setup but `browser`'s (which runs in its container) is
`.github/actions/setup`: Linux packages, Go, Node, `npm ci`, the `wails3`
CLI at the version `go.mod` pins, each job asking for what it needs.

## Rules for every test

- **One behaviour per test**, named as a sentence. Know which code change would fail it.
- **No fixed sleeps.** Wait for a signal or use fake time. Only exception: `personPace` in browser tests, where no signal exists.
- **No shared state.** The shared teardown (`frontend/src/test-setup.ts`, `t.Cleanup`) cleans up.
- **Retries only for a named cause**, commented, giving up within five seconds.
- **Go:** `x_test.go` in package `x_test`, `Test<Subject><Behaviour>`, helpers from `internal/testutil`. Every result type the frontend reads pins its JSON keys.
- **Frontend:** `x.test.ts` beside the module (`x-component.test.ts` when a component shares a module's name), Node unless `// @vitest-environment jsdom`. Mount with `src/test/render.ts`, the page editor with `src/docs/test-editor.ts`. Look belongs to visual tests.

## Trying a build, and what needs a person

Each CI run keeps `bava-macos-<commit>`, `bava-windows-<commit>` and
`bava-linux-<commit>` under Artifacts for 14 days. They are unsigned: on macOS
use System Settings, Privacy & Security, Open Anyway (or
`xattr -dr com.apple.quarantine bava.app`).

Checked only at a running window: native menus and accelerators (scenarios
send commands instead), native pickers, ⌘ shortcuts, scrolling, trackpad
gestures, and the feel of a new tool or dialog.
