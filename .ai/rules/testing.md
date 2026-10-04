# Testing

## Golden files are the primary safety net
Fixed `.d2` input → committed expected SVG. They are the only thing that
catches a silent layout regression, and they are what makes a D2, font, or
Wails version bump safe to do at all.

Run them before *and* after any such bump.

## A regenerated golden asserts nothing
`-update` is for when you have decided the new output is correct. Deciding
that requires opening the SVG and looking at it. Regenerating because the test
went red is how a layout regression gets committed as the new expected state.

When goldens change, say so explicitly in the report so the diff gets human
eyes.

## Byte comparison depends on .gitattributes
Golden SVGs are compared byte-for-byte, which only works because
`.gitattributes` forces LF line endings. Do not relax it. A CRLF checkout
would make every golden fail on Windows for no real reason.

## What gets a failing test first
This file is the one home for this table. A red-first cycle proves something
only for behaviour; for declarative scaffolding it proves nothing.

| Kind of work | Approach |
|---|---|
| Compile/layout/render pipeline, file I/O, IPC handlers, parsing | Failing Go test first. Write it from the spec, watch it fail, then implement. |
| File format: reading, writing, round-tripping | Failing test first, always. Format bugs corrupt user data silently and are unrecoverable once shipped. |
| Diagram output | Golden file. Add the fixture, watch it fail, implement, then open the generated SVG and look at it before keeping the golden. |
| Wails bindings, config, build scripts, migrations | Implement, then pin the outcome with a contract test. |
| Design system components | Build against `design-system.md`; `npm run check`, `npm run lint`, a visual check and a keyboard pass (tab order, Escape, arrow keys) before done. |
| Anything drawn: a style, token, layout, string, new screen or dialog | A visual check (below). |
| Canvas interaction, editor wiring | Tests where real logic exists: coordinate maths, staleness, debounce, selection state. Not for markup. |

## The gates
`go test ./internal/... .`, and for frontend work `npm run check`,
`npm run lint` and `npm test`, all judged by exit code. How every test is
written (names, structure, shared helpers, teardown, pictures) is the
standard in `docs/testing.md` ("The standard"); a test that departs from it
is fixed, not copied.

## A test that opens a file must close it, even when it is about not closing
Windows cannot delete a file another handle still has open, so `t.TempDir`'s
cleanup fails the test after every assertion has passed. A test that
deliberately leaves a session unclosed (a simulated crash) still closes it in
`t.Cleanup`; `logs.Session.Close` is idempotent for exactly this. This cost
four green-on-macOS tests a red Windows CI run.

## A path assertion compares shape, not separators
`filepath.Join` uses the host's separator, so a table that asks one machine for
another platform's folder (`logs.Dir("darwin", …)` on Windows) must compare
against `filepath.FromSlash(want)`.

## Unix mode bits mean nothing on Windows
Go reports 0666 or 0777 there whatever was asked for, and who may read a file
is an ACL question. A permissions test skips on Windows with the reason, rather
than weakening what it asserts on macOS and Linux.

## A seam at the transport does not test the transport
Injecting `send` into the render client is how its debounce and staleness are
tested, and it means those tests never execute `normalise`, the one place a
binding's response becomes what the UI reads. A field left out there is simply
absent at a running window while the suite stays green: Milestone 6.6 shipped
an Insert button that did nothing, for exactly this reason. Anything that
translates a response needs one test that drives the real path with the
binding stubbed.

## A test that supplies what the app computes tests nothing about the app
Three of Milestone 6.7's blockers hid behind this: an editor test that passed
its own rect never saw that the app computed a 1x1 one; an export test that
passed its own runs never saw that the app passed none; a `CodeEditor` test
never saw that nothing could open it. Where a value crosses from the app into
a module, one test has to come the way the app comes, even if the rest inject.

## Four layers, and a folder names each
1. **Unit** (`go test`, `vitest`): logic, and simulated input on the canvas
   and page checked as data. Beside the code (`<module>.test.ts`,
   `<name>_test.go`). The user's Mac and CI.
2. **Integration** (`frontend/tests/integration/<area>.spec.ts`): behaviour
   that needs a real browser (selection, focus, layout), asserted on data,
   never on screenshots.
3. **Visual regression** (`frontend/tests/visual/<area>[-<topic>].spec.ts`):
   screenshots compared with the approved references in `testdata/visual/`.
   2 and 3 run in a real WebKit browser, the Go side replaced by the stand-in
   in `frontend/tests/harness/`, through `npm run browser`: the user's Mac in
   the container `tests/docker/browser.Dockerfile`, and CI in the same
   container.
4. **End-to-end** of the real app, built with `-tags e2e`, walking
   `tests/e2e/<scenario>.json` on Linux, macOS and Windows. CI only, after a
   push. Never on the user's Mac.

A test lives in the folder of its layer, and an area has one name everywhere
(`canvas`, `components`, `dialogs`, `document`, `settings`, `shell`, `space`,
`start`): its spec files and its reference folder. A spec that
takes a screenshot belongs in `visual/`; one that takes none, in
`integration/`.

jsdom has no layout and applies no stylesheet that matters, so unit tests
cannot see a thing drawn wrong: closed dialogs once covered the window at
launch with every unit test green. That is the visual layer's job.

## A change to what is drawn gets a visual check
Any change that alters what the user sees (a component, a style, a token, a
layout, a string) runs `npm run browser` before it is called done. Every
screenshot it reports as changed is opened and read, in both themes. A
passing check with no changed images is evidence only for what is pictured:
a new component joins its family's sheet, and a new screen or dialog gets a
picture, in the same change.

## A picture shows what nothing else shows
One sheet per family, its states side by side, not one picture per state:
the old suite took 1,157 pictures, most of a state a test could read, and
broke on every colour change and flake. A state the page can say (pressed,
disabled, checked, open, a count) is asserted as data before the picture. A
picture shows a finished state, set by fixtures or one action; how it is
reached is an integration or unit test. Before a picture goes, what it
showed is checked somewhere else.

## Forced states, and what they must not touch
Hovered, focused and pressed are forced on a sheet: in the test page each
`:hover`, `:focus-visible` and `:active` rule also matches `data-force`
(`harness/force-states.ts`). A state inside `:not()` is left as written:
`:not(:hover)` rewritten matches every element, which hid the code block's
Copy button under a real pointer. The app's own build never has the plugin
(a test checks `vite.config.ts`).

## Pictures leave out the text selection
`harness/screenshot.css`, applied only while a screenshot is taken, makes
the browser's selection transparent. Headless WebKit paints a selection at
one of two strengths by a window state no test sets (not the page's focus:
probed). Which text is selected is asserted from the page; its colour,
`--color-selection`, by `styles/selection.test.ts`.

## A reference changes only when it has been looked at
`npm run browser:update` is for an intended change. Open every new or changed
image under `testdata/visual/` before keeping it, and list them in the report
so the user sees them too. Regenerating because the check went red is how a
drawing regression becomes the new expected state, exactly as with goldens.

## Pictures compare almost exactly
`maxDiffPixels: 0` and `threshold: 0.02` in
`frontend/tests/playwright.config.ts`. Playwright's default, 0.2, passes a pixel
within a fifth of its colour, which hid an icon's missing dot and a dozen
colour fixes behind references that never failed and so were never
regenerated. 0.02 passes the one to three steps of edge smoothing that differ
between runs under load, and fails the twelve and more a token change makes.
Never raise it to quiet a failure: find what changed.

## A click that moves the selection is held
A walk's click or double-click that moves the page's selection is held, as a
person's is (`{ delay: 50 }`). Pressed and released in the same instant, a
click out of selected table cells left them selected in 16 of 40 runs under
load, and a double-click on a word selected nothing on CI.

## References are small and named by where they are
`testdata/visual/<area>[-<topic>]/<screen>--<state>--<theme>.png`, one
folder per `visual/<area>[-<topic>].spec.ts` (the list is the coverage table in
`docs/testing.md`). Crop each to what it pictures at 1x; only `start` and
`shell` picture the whole window. They live on `main`; source archives
leave them out (`.gitattributes` `export-ignore`).

## The stand-in answers as Go does
The stand-in's fakes return what the real services return, error codes
included; a test fails when the app imports a binding the fakes lack. A fake
that drifts from its service makes screens that cannot happen.

## A canvas walk seeds its scene and reads back the file
A canvas check puts its scene into an existing page of the pretend Space
before opening it (`seedScene`, `openCanvas`), so the Files tree and every
other screenshot stay as they are. What the canvas does is asserted on the
scene the page saves (`savedScene`, which waits for the exact `saved` state:
`unsaved` contains it), not on how it looks. Scenes are data in
`frontend/tests/fixtures/canvas-scenes.ts`.

## Headless WebKit can paint a popover as it first appeared
After a menu's highlight moves or a picker's choice changes, the test
browser can keep painting the old state although every computed style has
changed; a resize does not repaint it. Which row is highlighted or checked is
asserted from the page (`data-highlighted`, `data-state`), and a picture of
it is kept only where it matches. Open submenus from the keyboard: by
pointer, Ark holds a submenu shut while the pointer may be heading into
another, so a resting pointer's picture depends on timing.

## An end-to-end scenario checks the file it saved
A scenario's `file` step has the host read a page back from the scratch
folder (through `os.OpenRoot`: nothing outside it, no links out) until it
holds the text, so a walk proves what reached the disk, not only the screen.
`key` and `drag` steps take `modifiers` (`shift`, `alt`, `mod`: ⌘ on macOS,
Ctrl elsewhere). A native menu accelerator is not a page key: drive its
command with a `menu` step.

## The end-to-end driver never ships
The end-to-end driver (`internal/e2e`, `frontend/src/e2e/`) exists only in a build
with `-tags e2e` (Go) and `VITE_BAVA_E2E=1` (the page). `release_test.go`
fails if a default build links `internal/e2e`; CI's `release-has-no-driver`
job fails if a normal frontend bundle contains the driver. It answers native pickers
from its scenario, so it never needs a person.

## End-to-end steps type as a person types
The end-to-end driver's `type` puts text in one character at a time, waiting a
tick between them. The Document's typing shortcuts (`$x$`, ```` ``` ````, `#`)
react to typing; a whole string put in at once is read as a paste and left as
text, so a scenario that relies on a shortcut would fail on CI and nowhere
else.
