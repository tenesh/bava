# Errors and logs

Opened 2026-09-17. What a user sees when something fails, what is recorded, and
how they can hand it to us, **without anything reaching us unless they send
it**. The first non-negotiable rules out crash reporting and telemetry: every
mechanism here is local, and a report leaves the machine only by the user's
own action.

## What is true today (measured 2026-09-17, Wails v3.0.0-beta.20)

| Failure | User sees | Recorded |
|---|---|---|
| Panic inside a bound method | The call rejects; usually nothing visible | Nothing in a release build |
| Panic elsewhere (startup, a goroutine) | The app vanishes: Wails' default panic handler calls `os.Exit(1)` | Nothing |
| Uncaught frontend exception or rejection | Usually nothing; part of the UI may stop | Nothing, apart from two `console.error` calls |
| Webview content process dies (macOS) | A blank window | Nothing: no listener for `EventWebViewWebContentProcessDidTerminate` |
| Expected errors (conflict, save failure, bad D2) | Prompts, status bar, diagnostics | — |

The root fact: `pkg/application/logger_prod.go` makes the production
`DefaultLogger` write to `io.Discard`. Once built for release, nothing any
failure produces is kept.

Wails provides the hooks to fix this: `Options.Logger`, `Options.LogLevel`,
`Options.PanicHandler`, `Options.ErrorHandler`. Bound-method panics are
already converted into a rejected call (`bindings.go`, "#5037"), and a custom
`PanicHandler` still observes them.

## Design

### 1. Local log files
Go logs through `log/slog` to one file per session:

| Platform | Folder |
|---|---|
| macOS | `~/Library/Logs/Bava` |
| Windows | `%LOCALAPPDATA%\Bava\logs` |
| Linux | `$XDG_STATE_HOME/bava/logs` (default `~/.local/state/bava/logs`) |

- A file is named for its start time. Older sessions are pruned at startup
  within a retention limit and a total size cap.
- The same logger is passed to Wails as `Options.Logger`, so its own errors are
  kept too.
- Logs are Bava's own state, not work product, in line with the second
  non-negotiable: deleting them costs history, never work.

### 2. Frontend errors reach the same log
- `window` `error` and `unhandledrejection` handlers forward to a Go binding,
  `LogService.Report`, rate-limited so a render loop cannot flood the disk.
- `console.error` call sites go through one frontend logger that does the same.
- Each shell region sits in a Svelte 5 `<svelte:boundary>`. A crash inside a
  pane shows "This panel hit a problem" with Reload panel, instead of breaking
  the whole window.

### 3. Panics and unexpected exits
- A `PanicHandler` logs the full stack.
- Every goroutine Bava starts goes through a recover wrapper that logs and
  keeps the app alive where it safely can.
- A session writes a marker at start and removes it on a clean quit. If the
  marker is still there at the next launch, the previous session ended
  unexpectedly, and the app says so (section 5).

### 4. The webview's content process
On macOS, listen for the content-process termination event: log it, reload
the window, and tell the user. Whether Wails exposes the equivalents for
WebView2 (`ProcessFailed`) and WebKitGTK is **unverified**; checking is part of
the milestone.

### 5. What the user sees
- **Expected errors** keep plain-language messages that say what to do: the
  conflict prompt, a failed save in the status bar, D2 diagnostics. Never a
  stack trace.
- **Unexpected errors:** a dialog, "Something went wrong", with:
  - one plain sentence
  - a collapsed Details section
  - Copy Details
  - Open Logs Folder
  - Report Issue…
- **After an unexpected exit:** at the next launch, "Bava closed unexpectedly
  last time", with Open Logs Folder, Copy Report, Report Issue… and Dismiss.

### 6. Help menu
- **Open Logs Folder** — reveals the folder in Finder, Explorer or the file
  manager.
- **Copy Diagnostics** — puts a plain-text report on the clipboard:
  - Bava version
  - OS and architecture
  - webview engine and version
  - the most recent log lines
- **Report Issue…** — opens the project's new-issue page in the browser with a
  template. Nothing is attached or sent automatically; the user pastes or
  attaches what they choose.

### 7. What a log never contains
- document prose, D2 source, canvas content or labels
- AI prompts, replies or transcripts
- credentials or tokens, in any form
- the user's home directory, which is written as `~`

Held by a test that performs an open, an edit, a render and a save on a fixture
with distinctive content, then asserts none of that content appears in the log.

### 8. Not in this design
- **Recovering unsaved work after a crash**, meaning VS Code-style backups
  outside the project. Related, but a separate mechanism with its own format
  questions. Destination: Milestone 16, unless brought forward.
- **Any automatic upload.** Ruled out by the first non-negotiable, not by
  effort.

## Decisions

### Retention: the last 10 sessions, 50 MB total — 2026-09-17
Asked and answered. At startup, sessions beyond the newest 10 are deleted, then
the oldest are deleted until the folder is under 50 MB. The current session
is never pruned. A single session that grows past the cap is truncated from
its start rather than growing without bound.

### Verbose logging is a setting, off by default — 2026-09-17
Asked and answered. By default the log records warnings and errors, plus
session start and end. Settings ▸ Advanced ▸ Verbose logging adds debug
detail — timings, IPC calls, render durations — until turned off. It is a
preference in `internal/config`, so it survives a restart while someone
reproduces a problem. The privacy rules in section 7 apply at every level.

### Report Issue's destination is decided at release — 2026-09-17
Asked and answered. Milestone 5.8 builds Report Issue… and its bug template
with the destination URL in a single constant, but the menu item stays hidden
until Milestone 16 confirms the public repository. Open Logs Folder and Copy
Diagnostics ship in 5.8, and the unexpected-error dialogs show those two
actions until then.

No open questions remain for Milestone 5.8.
