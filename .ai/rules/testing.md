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