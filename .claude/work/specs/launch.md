# Launch: decisions

From the brand handover's sheets 4a/4b (launch window) and 4c (no file open),
reviewed 2026-09-17. The sheets are reference; these decisions are the spec.

## What the app shows at launch: decided 2026-09-17

Asked and answered: **the no-file-open state, after a brief splash.**

- Bava launches with no document open. It no longer starts on an untitled
  document with demo D2 source.
- File ▸ New (`⌘N`) creates the untitled document; File ▸ Open, Open Recent
  and a file-tree activation open one. A failed open leaves the empty state
  in place.
- The splash (4a dark, 4b light) covers the window only while the app
  initialises: until the settings load has settled (loaded or failed) and
  `document.fonts.ready` has resolved. No minimum display time. Capped at
  2 seconds so a call that never answers cannot hide the app.
- The splash's bar is **indeterminate**. Nothing at startup reports real
  progress, and a fixed percentage would be a lie.
- No version number on the splash: nothing stamps one yet (the About dialog
  omits it for the same reason). No path either: nothing is being opened at
  launch. The line under the bar reads "Starting".

## The window with no file open: decided 2026-09-17

Asked and answered: **like 4c, title bar and status bar only.**

- The regions (files, document, canvas, AI) and the view switcher are hidden.
  They stay mounted underneath: CodeMirror and the canvas are mounted once
  (Milestone 3 rule).
- The title bar shows the mark and "No file open", with no saved/unsaved chip.

## Settings lives in the menu only: decided 2026-09-17

Asked for by the user: the title bar has no Settings button, in any state.
Settings is reached through the native menu (Bava ▸ Settings… on macOS,
File ▸ Settings… on Windows and Linux, `CmdOrCtrl+,`), which already exists.
- The main area shows the faded mark (dark only, per `brand.md`) and two key
  hints, taken from the menu spec for the current platform: Open a file, New
  file. The label says "file", not "file or folder": Open picks a file.
- The status bar keeps only the error count; engine and node count describe a
  document, and there is none.

## Known and accepted for now

- The native menu does not know whether a document is open: Save, Edit
  commands, view modes and tools stay enabled with nothing open. Their
  handlers do nothing (save is guarded, edits route nowhere, canvas commands
  check the canvas is on screen), but a tool or view chosen then persists into
  the next New. Disabling them needs a `hasDocument` menu state.
