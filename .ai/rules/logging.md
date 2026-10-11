# Logging

What may be logged, and how.

## Nothing leaves the machine
Logs go to the platform log folder only. No upload, no crash reporting. A
report reaches us only when the user copies diagnostics or attaches a file.

## A log never holds content
No prose, D2, canvas text, AI prompts or replies, credentials, and no file path
or name (a name can be content). Log sizes, counts, durations, outcomes; for
errors that quote input, log the kind of failure. `TestLogsNeverContainContent`
must stay green; the `~` redaction is a backstop, not permission.

## Wails never gets the session logger
It logs every bound call's arguments and result at debug level. It gets
`Session.WailsLogger()`: warn and above, values replaced.

## Frontend errors carry kind and stack, never message
Reports and the error dialog's details never include an error's message or a
thrown value. Panic messages are written by code, so they are logged as is.

## Every goroutine goes through `app.Go`
Wails does not recover Bava's own goroutines; an unrecovered panic ends the
process unlogged. `app.Go` logs the stack, emits `app:error`, and carries on.

## Packages log through `slog.Default()`
`main.go` sets it to the session logger; a package's own logger writes
somewhere nobody reads.
