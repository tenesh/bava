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
Behavior: the compile/layout/render pipeline, file I/O, IPC handlers, parsing.
Write the test from the spec, watch it fail, then implement.

Not scaffolding: migrations, config, bindings skeletons. Implement, then pin
the outcome with a contract test.

## Test quality
One behavior per test, named for the behavior. Before writing a test, name the
production change that would make it fail. If you cannot, the test asserts
nothing. Assert on real behavior, never on mock behavior.
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

## Three layers, and where each runs
1. **Logic tests** (`go test`, `vitest`): behaviour, no drawing. The user's
   Mac and CI.
2. **Screen checks** (`npm run visual`): the interface in a real WebKit
   browser, the Go side replaced by the stand-in in
   `frontend/tests/visual/harness/`, screenshots compared with the approved
   references in `testdata/visual/`. The user's Mac, in the container
   `tests/docker/visual.Dockerfile`, and CI in the same container.
3. **Smoke runs** of the real app, built with `-tags e2e`, walking
   `tests/e2e/scenarios/*.json` on Linux, macOS and Windows. CI only, after a
   push. Never on the user's Mac.

jsdom has no layout and applies no stylesheet that matters, so layer 1 cannot
see a thing drawn wrong: closed dialogs once covered the window at launch
with every logic test green. That is layer 2's job.

## A change to what is drawn gets a screen check
Any change that alters what the user sees (a component, a style, a token, a
layout, a string) runs `npm run visual` before it is called done. Every
screenshot it reports as changed is opened and read, in both themes. A
passing check with no changed images is evidence only for the screens the
walks cover: a new screen or dialog gets a walk in the same change.

## A reference changes only when it has been looked at
`npm run visual:update` is for an intended change. Open every new or changed
image under `testdata/visual/` before keeping it, and list them in the report
so the user sees them too. Regenerating because the check went red is how a
drawing regression becomes the new expected state, exactly as with goldens.

## References are small and named by where they are
`testdata/visual/<area>/<screen>--<state>--<theme>.png`, areas `start`,
`shell`, `space`, `dialogs`, `settings`, `canvas`. Crop each to its screen or
dialog at 1x; never the whole desktop. They live on `main`; source archives
leave them out (`.gitattributes` `export-ignore`).

## The stand-in answers as Go does
The layer 2 fakes return what the real services return, error codes
included; a test fails when the app imports a binding the fakes lack. A fake
that drifts from its service makes screens that cannot happen.

## The smoke driver never ships
Layer 3's driver (`internal/e2e`, `frontend/src/e2e/`) exists only in a build
with `-tags e2e` (Go) and `VITE_BAVA_E2E=1` (the page). `release_test.go`
fails if a default build links `internal/e2e`; CI's `release-has-no-driver`
job fails if a normal frontend bundle contains the driver. It answers native pickers
from its scenario, so it never needs a person.

## Smoke steps type as a person types
The smoke driver's `type` puts text in one character at a time, waiting a
tick between them. The Document's typing shortcuts (`$x$`, ```` ``` ````, `#`)
react to typing; a whole string put in at once is read as a paste and left as
text, so a scenario that relies on a shortcut would fail on CI and nowhere
else.
