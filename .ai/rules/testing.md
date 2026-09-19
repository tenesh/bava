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
