# Svelte

## Runes only
`$state`, `$derived`, `$effect`, `$props`. Never `$:` reactive statements,
never `writable`/`readable` stores, never `export let`.

Svelte 5 is recent enough that mixed Svelte 4/5 code appears constantly in
training data and search results — a file with both idioms usually means a
snippet was pasted without translation.

## No store library
Shared state lives in plain `.svelte.ts` modules using `$state`. Runes give
fine-grained reactivity across module boundaries; adding Zustand-alikes or
Svelte 4 stores on top is redundant.

## TypeScript only
No `.js` source files. The sole exception is a config file the tooling
requires by name (`svelte.config.js`).

## Logic out of markup
One component per file. Anything beyond rendering — derivation, formatting,
state machines — goes in a `.svelte.ts` module and is imported. Markup that
contains logic cannot be tested and cannot be reused.

## Imperative libraries are not reactive
CodeMirror, ProseMirror, and the canvas class own their own DOM. Mount them in
`onMount`, destroy them in the cleanup return, and never pass reactive props
in. See `editors.md` and `canvas.md`.