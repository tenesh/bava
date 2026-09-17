# Logging

## Nothing leaves the machine
Logs are written to the platform log folder and nowhere else. No upload, no
crash reporting, no "anonymous" statistics. A report reaches us only when the
user copies diagnostics or attaches a file themselves. Adding any automatic
send breaks the first non-negotiable.

## A log never holds content
Never document prose, D2 source, canvas text or labels, AI prompts or replies,
or credentials — at any level, verbose included. **Never a file path or file
name either**: a name can be content ("layoffs-march.md"). Log sizes, counts,
durations and outcomes instead. Error messages that quote input — a D2
diagnostic, a JSON syntax error, an OS error carrying the path — are not
logged verbatim; log what kind of failure it was.

**Wails never gets the session logger.** It logs every bound call's arguments
and result at debug level. It gets `Session.WailsLogger()`: warn and above,
attribute names kept, values replaced.

**Frontend reports carry an error's kind and stack frames, never its message
or a thrown value.** The error dialog's details follow the same rule.

**Panic messages are written by code, never built from user content.** They are
logged as they are, because a panic without its message cannot be diagnosed.

The home directory is redacted to `~` by the handler, but that is a backstop
for Wails' own messages, not permission to log paths.
`TestLogsNeverContainContent` runs the real services at debug level over
sentinel content and must stay green.

## Every goroutine goes through `app.Go`
Wails recovers the goroutines it starts; Bava's own it does not, and an
unrecovered panic ends the process with nothing logged. `app.Go` logs the
stack, emits `app:error`, and lets the app continue.

## Bava's packages log through `slog.Default()`
`main.go` sets it to the session logger. A package that builds its own logger
writes somewhere nobody reads.
