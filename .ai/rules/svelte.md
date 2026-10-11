# Svelte

Rules for Svelte components and `.svelte.ts` modules.

## Runes only
`$state`, `$derived`, `$effect`, `$props`. Never `$:`, `writable`/`readable`
or `export let`. A file mixing idioms usually means a pasted Svelte 4 snippet.

## No store library
Shared state lives in plain `.svelte.ts` modules using `$state`.

## TypeScript only
No `.js` source, except config the tooling requires by name:
`frontend/svelte.config.js` and `frontend/eslint.config.js`.

## Logic out of markup
One component per file. Derivation, formatting and state machines go in a
`.svelte.ts` module, where they can be tested.

## Imperative libraries are not reactive
CodeMirror, ProseMirror and the canvas class own their DOM: mount in
`onMount`, destroy in the cleanup return, never pass reactive props in.
