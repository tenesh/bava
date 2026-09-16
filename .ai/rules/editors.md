# Editors

## Mounting
CodeMirror 6 and ProseMirror are imperative and own their DOM. Mount in
`onMount`, destroy in the cleanup return, never pass reactive props in. If you
find yourself writing `$derived` that feeds an editor, the design is wrong.

## The diagram block
A diagram is a custom ProseMirror node type whose NodeView hosts a CodeMirror
instance holding the D2 source, plus a container for the rendered SVG.

**Read ProseMirror's own embedded code-editor example before changing this
seam.** It solves three things that are non-obvious and easy to get subtly
wrong:

- **Escaping the inner editor.** Arrow-up on CodeMirror's first line must move
  the cursor into the ProseMirror doc above, not sit there. Wired via
  CodeMirror keymap handlers dispatching ProseMirror selection transactions.
- **Undo across the boundary.** Two independent history plugins make Ctrl+Z
  unpredictable. CodeMirror changes are forwarded as ProseMirror transactions
  so there is one history.
- **Focus tracking.** Which editor is active, so toolbars and menus reflect
  the right context.

Budget real time here. It is the fiddliest part of the frontend and plausible-
looking wrong implementations are easy to produce.

## Compiler errors
D2 diagnostics come back from `Render` with positions. Surface them through
`@codemirror/lint` in the source pane and in `ErrorList`. Clicking a
diagnostic jumps to the line — that mapping comes from the render response,
never from re-parsing in the frontend.