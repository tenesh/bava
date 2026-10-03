# AI architecture

Decisions taken 2026-09-16. These supersede the "local Ollama only" position in
CLAUDE.md's stack table; the non-negotiables rewrite that follows from them is
done (CLAUDE.md's first non-negotiable).

## Scope change

Bava supports hosted LLM providers, not only local ones: API keys (BYOK) and
provider login for users on subscription plans rather than API credit. The
governing principle changes from **no network** to **no service we operate**:

> Nothing is stored or hosted on Bava's side. Every call goes from the user's
> machine to an endpoint the user chose, with credentials the user supplied.

Telemetry, analytics and crash reporting stay forbidden; that is not what this
change was for.

## Two AI features, not one

**Generation.** Prompt in, whole artifact out: a diagram or document content.
Nothing existed before, so accept-or-discard is sufficient.

**Targeted edit.** The user selects a range and asks for a fix or a review.
This is a structured mutation of existing work and needs a diff the user can
reject before anything lands.

**AI edits must be transactions, not writes.** `editors.md` already requires
CodeMirror changes to be forwarded as ProseMirror transactions so there is one
undo history. An AI edit that writes straight into the document bypasses that,
and the first thing a user does after an edit they dislike is press Ctrl+Z. If
that behaves strangely once, the feature is never trusted again.

**The AI never touches rendered output.** For diagrams it proposes D2 source,
which flows through the existing `Render` path, debounce and goldens. No second
render path.

## Compile-and-repair loop: decided

Model output is compiled in-process before the user sees it. On a diagnostic,
the error is fed back to the model and retried, **capped at 2 retries**, with a
visible "checking" state. Only then does it reach the canvas.

This is the payoff of owning the compiler in-process: the app can verify the
model's work before presenting it. It costs a couple of cheap round trips and
substantially lifts the hit rate of "draw me this". On a hosted provider those
retries are the user's money, so the cap is fixed and the state is visible,
never a silent loop.

## Chat persistence: decided

Per-file threads, **JSONL, append-only**, in a central user-level store:

```
<data dir>/bava/chats/<escaped-project-path>/<file>.jsonl
```

Resolved via XDG conventions per platform (`github.com/adrg/xdg` is already in
the module graph as an indirect dependency): `~/.local/share` on Linux,
Application Support on macOS, `%APPDATA%` on Windows.

**Why JSONL and not a human-readable transcript.** A transcript is Bava's own
state, not work product: losing it costs history, never work. Append-only
writing is crash-safe (a crash costs the last line, not the file), fits
streaming responses, keeps tool calls and model metadata structured, and gets
`file-format.md`'s forward-compatibility requirement for free: unknown keys
survive because existing lines are never rewritten. It is still plain text:
greppable, `jq`-able, no database, no binary container.

**Why central and not in the project.** Project folders stay clean and nothing
can be committed by accident. The cost, accepted knowingly: transcripts do not
travel when a project is cloned or shared.

**Rename and move.** Keying by path means an in-app rename must rewrite the
key, and an external rename or a moved project folder detaches history.
Detached history is never deleted; a "relink history" action is owed later.

**One chat per file, not per object.** The pane serves the whole file
(document and every diagram on the canvas) as a single conversation. A diagram
is attached to a *message* as a context reference, not as a separate thread, so
"about this diagram" is scoping within one transcript rather than a second one.
This keeps the per-file JSONL decision intact: one file, one thread.

**Inline edits are not logged.** Two surfaces: the chat pane holds the
conversation and persists; the inline edit box shows a diff and vanishes on
accept or reject. The thread stays readable as a conversation. Accepted cost:
no audit trail of what AI changed in a document.

## Credentials: decided

API keys and OAuth tokens go to the **OS secret store**: macOS Keychain,
Windows Credential Manager, libsecret on Linux. Never in a config file, never
in a transcript, never in a log. This needs a per-platform code path and will
need a headless story for CI.

## Context and consent

A targeted edit needs surrounding context, usually the whole file, so
highlighting one paragraph sends far more than the paragraph. The consent
screen must say this plainly before the first hosted call, not in a settings
page nobody opens.

## Milestone consequences

AI is Milestones 11 to 14 in the roadmap. Ordering constraints that cannot be
dodged:

- Chat persistence cannot precede the format spec it needs (Milestone 5).
- Selection-scoped document editing cannot precede documents (Milestone 8).
- Diagram generation with the repair loop needs the generator and conversion
  of Diagram from Code (Milestone 6.6).

## To settle before Milestone 11

- **What a chat is keyed by.** Bava now opens Spaces of pages, not single
  files: one thread per page or per Space, and how history follows a page
  that is moved or renamed inside the Space.
- **Attaching a diagram to a message.** Diagrams are now ordinary shapes,
  often in a frame, so "this diagram" means a selection or a frame rather than
  a `diagram` element.
