# 10: D2 editing

**Goal:** D2 is coloured and edited as D2 wherever it is written: the D2
diagram dialog, a canvas code block, a page's ```` ```d2 ```` block.
**Specs:** `.claude/work/specs/d2-editing.md` decisions 1 to 3;
`.ai/rules/editors.md`, `.ai/rules/canvas.md` (code blocks), `.ai/rules/d2.md`.
**File format impact:** none (`d2` is one more value a code block's
`language` and a fence already take).
**UI impact:** colours in the dialog's editor, in canvas code blocks and in
page code blocks set to D2, as the mockup's "4.5 D2 diagram" draws D2; D2
in the code language pickers. No new screen.

## Constraints

- "One D2 mode, everywhere D2 is written." (1)
- "Enter after `{` indents the next line; Enter before `}` lines it back
  up; Tab and Shift+Tab indent and outdent the selected lines. `{`, `[`,
  `(` and quotes add their partner. ⌘/ (Ctrl+/ elsewhere) turns the
  selected lines into `#` comments, or back. The bracket matching the one
  at the cursor is marked." (2)
- "Folding and completion of D2's words were offered and left out. A page's
  code block is page text, so it gets the colours, not these keys." (2)
- Colours: comment, keyword (D2 v0.9.0's reserved words), name, string
  (labels, values, block strings), number (`true`, `false`, `null` too),
  operator (connections, globs, filters), type (`${var}`), punctuation. (3)
- Roadmap exit: "tokeniser tests."

## How it works

- A hand-written stream tokeniser (`frontend/src/editor/d2-language.ts`),
  no new package: CodeMirror's `StreamLanguage` with the line comment `#`,
  indentation by brace depth, and D2's reserved words read from a list a
  Go test holds to D2's own (`d2ast` keyword tables).
- `d2Support()` = the language, plus closing brackets and quotes, bracket
  matching, indent on input (a typed `}` lines up), and the ⌘/ comment
  toggle.
- The dialog's editor takes `d2Support()` and the canvas's colouring
  (`KIND_HIGHLIGHTER`), as the canvas code editor already does for its
  languages. Tab indents there as in the canvas code editor; the dialog is
  left by keyboard as it is today (its own keys, checked in task 4).
- `d2` joins the code languages (`canvas/code/languages.ts`), so canvas
  code blocks and page code blocks colour it through the existing path.

## Tasks

### Task 1: D2's reserved words, from D2
**Files:** `testdata/d2/keywords.json`, `internal/render/keywords_test.go`.
- [x] Failing test: `TestKeywordListIsD2s`: the file lists exactly
  `d2ast.ReservedKeywords` and `d2ast.StyleKeywords`, sorted; expected
  failure: no file.
- [x] Write the file.
- [x] Green: `go test ./internal/render -run Keyword`

### Task 2: The tokeniser (the exit tests)
**Files:** `frontend/src/editor/d2-language.ts`, `d2-language.test.ts`.
- [x] Failing tests, token by token, over: a comment (whole line and after
  code); keys and nested keys (`a.b.c`); reserved words and `style.fill`;
  a label after `:`, quoted with escapes, unquoted to the end of the line or
  `;`, `{`; numbers, `true`, `false`, `null`; connections `->`, `<-`,
  `<->`, `--`, chained, with a label; globs and filters (`*`, `**`, `&`,
  `!&`); `${var}`; braces, brackets, `;`; a block string (`|md ... |`,
  `|||` ... `|||`) over several lines; an unclosed quote not running past
  its line; the keyword list matches `testdata/d2/keywords.json`.
- [x] Implement.
- [x] Green: `npx vitest run src/editor/d2-language`

### Task 3: The editing help
**Files:** `frontend/src/editor/d2-language.ts`, `d2-editing.test.ts`.
- [x] Failing tests (an `EditorState`, commands run on it): Enter after `{`
  indents by two spaces; a typed `}` on a blank indented line outdents;
  `{` adds `}`; `"` adds `"`; ⌘/ comments the selected lines, and again
  uncomments; Tab and Shift+Tab indent and outdent; the bracket at the
  cursor is matched.
- [x] Implement `d2Support()`.
- [x] Green: `npx vitest run src/editor/d2-editing`

### Task 4: The dialog
**Files:** `frontend/src/editor/source-pane.ts`, the dialog's styles if the
colour classes are not yet reachable there, tests.
- [x] Failing test: `source-pane.test.ts` "D2 is coloured as D2": a key
  and a keyword get the name and keyword classes; "⌘/ comments the line".
- [x] The pane takes `d2Support()`, `KIND_HIGHLIGHTER` and Tab to indent;
  confirm how the dialog is left by keyboard with Tab taken (its own keys,
  Escape) and keep that path, with a test.
- [x] Green: `npx vitest run src/editor src/components/d2-diagram`; the
  dialog's references in `npm run browser`, read in both themes.

### Task 5: D2 as a code language
**Files:** `frontend/src/canvas/code/languages.ts`, its tests, a canvas
scene and a page fixture with D2.
- [x] Failing test: `languages.test.ts` "D2 is offered, labelled D2, and
  colours its keywords"; the page's code block colours a ```` ```d2 ````
  fence.
- [x] Green: `npx vitest run src/canvas/code src/docs`; `npm run browser`
  with a D2 code block on the canvas and in a page, both themes.

### Task 6: Docs
**Files:** `docs/shortcuts.md` (⌘/ and Tab in code editors),
`docs/decisions.md`, `.ai/rules/editors.md` (the D2 mode), the build
skill's position.

## Artifacts

- `docs/shortcuts.md`, `docs/decisions.md`, `.ai/rules/editors.md`.
- `docs/release-checklist.md`: typing D2 in the dialog and a canvas code
  block on each webview (indent, closing, ⌘/).
- No design system change: the colours are the existing `--syntax-*`.

## Out of scope

Folding; completion of D2's words; D2 diagnostics anywhere but the dialog;
a full grammar (a stream tokeniser is enough for colour and keys).

## As built

- `editor/d2-language.ts`: a `StreamLanguage` tokeniser and `d2Support()`
  (closing brackets and quotes, bracket matching, indent on input, `#` as
  the comment for the default ⌘/). Three CodeMirror packages it uses, already
  installed through others, are now named in `package.json` at the versions
  installed; none changed.
- Reserved words: `testdata/d2/keywords.json` (46), held by
  `TestKeywordListIsD2s` to `d2ast.ReservedKeywords` and `StyleKeywords`.
- The dialog: D2 colours (`KIND_HIGHLIGHTER`, the canvas's), Tab indents,
  ⌘Enter inserts when Insert is on, and ⇧⌥M hands Tab back to focus on every
  platform. CodeMirror's own Ctrl-M is Minimise on Windows and Linux, so the
  menu reserves it; the spec review found that, and a test now runs the
  switch past each platform's reserved keys.
- `d2` is a code language, so canvas and page code blocks colour it; the
  languages test now allows the app's own modules beside packages.
- From the spec review: `<-->`, a `${var}` inside a value, a quote inside a
  name, a value before `{`, and the indent inside a block string (left to
  the embedded code) are fixed with tests; the duplicate ⌘/ binding went.
- Pictures: the D2 dialog (empty, with an error), the containers scene with
  a D2 code block, the page's blocks sheet with a ```` ```d2 ```` block, both
  themes. The error picture's test now inserts its text in one go: typed,
  the editor closes the brace and the error is gone. A browser test types
  D2 through real keys (brace closed, Enter indents, colours).
- Gates: go vet, go test, check, lint, `npm test` 3,281 passed, `npm run
  browser` 598 passed.
