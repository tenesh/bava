# AI

Rules for AI features (not built yet).

## No service of ours
Calls go from the user's machine to an endpoint they chose, with their
credentials. No proxy, relay, default remote URL or hosted fallback: no local
endpoint means the feature is off.

## Credentials live in the OS secret store
Keychain, Credential Manager, libsecret. Never a config file, transcript, log
or error message.

## Model output is compiled before the user sees it
Generated D2 is compiled in-process; on a diagnostic the error is fed back,
**at most two retries**, with a visible checking state (each hosted retry costs
the user money). Never skip it to show what came back.

## AI edits are transactions
An edit enters as a ProseMirror transaction or CodeMirror change, so one undo
history holds it. Every targeted edit shows a diff the user can reject first.

## No second pipeline
The AI proposes D2 source, which goes through the existing `Render` path,
debounce and goldens.

## Context is bigger than the selection
Say so in front of the user before the first hosted call, not in settings.

## Transcripts are Bava's state, not work product
`<data dir>/bava/chats/<escaped-project-path>/<file>.jsonl`, per file,
append-only (a crash costs a line; unknown keys survive). Inline edits are not
logged. Detached history (after a rename or a moved folder) is never deleted.
