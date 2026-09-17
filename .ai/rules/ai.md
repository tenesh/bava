# AI

## No service of ours
Every call goes from the user's machine to an endpoint the user chose, with
credentials the user supplied. No proxy, no relay, no default remote URL, no
hosted fallback when a local endpoint is absent; absent means the feature is
off. If code needs a domain we control to work, it is wrong.

## Credentials live in the OS secret store
macOS Keychain, Windows Credential Manager, libsecret on Linux. Never a config
file, never a transcript, never a log, never an error message. This is the one
exception to "a user can read everything Bava writes", and it exists because a
credential in a plain file gets backed up, synced, and pasted into issue
reports.

## Model output is compiled before the user sees it
D2 the model produced is compiled in-process. On a diagnostic the error is fed
back and retried, **capped at two retries**, with a visible checking state.
The cap is fixed and the state is visible because on a hosted provider each
retry is the user's money; a silent loop spending it is not acceptable.

This loop is the payoff of owning the compiler: the app verifies the model's
work before presenting it. Never skip it to "just show what came back".

## AI edits are transactions, not writes
An edit enters the document the way a keystroke does: a ProseMirror
transaction, or a CodeMirror change forwarded as one. Writing directly into the
document bypasses the single undo history `editors.md` exists to protect, and
the first thing a user does after an edit they dislike is press Ctrl+Z.

Every targeted edit shows a diff the user can reject before it lands.

## The AI never touches rendered output
It proposes D2 source, which flows through the existing `Render` path, debounce
and goldens. There is no second pipeline for AI-produced diagrams.

## Context is bigger than the selection
Fixing a highlighted paragraph needs the surrounding file. Say so before the
first hosted call, in front of the user, not in a settings page nobody opens.

## Transcripts are Bava's state, not work product
Per-file threads, JSONL, append-only, in the platform data directory:
`<data dir>/bava/chats/<escaped-project-path>/<file>.jsonl`.

Append-only is what makes a crash cost the last line instead of the file, and
what gives forward compatibility for free: unknown keys survive because
existing lines are never rewritten. Inline edits are ephemeral and are not
logged. Detached history (after an external rename or a moved project folder)
is never deleted.
