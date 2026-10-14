# D2 editing (10)

Decisions for Milestone 10, settled with the user on 2026-10-14.

## Decisions

1. **One D2 mode, everywhere D2 is written.** The D2 diagram dialog's
   editor, and `d2` as a language for code: a code block on the canvas set
   to D2, and a ```` ```d2 ```` block in a page, colour the same way. The
   dialog alone was offered and not chosen.

2. **The common editing help, and only that** (the user: "add what's
   commonly used and necessary only"), where D2 is typed in a code editor
   (the dialog, a canvas code block):
   - Enter after `{` indents the next line; Enter before `}` lines it back
     up; Tab and Shift+Tab indent and outdent the selected lines.
   - `{`, `[`, `(` and quotes add their partner.
   - ⌘/ (Ctrl+/ elsewhere) turns the selected lines into `#` comments, or
     back. ⌘/ belongs to the page only while the page has focus.
   - The bracket matching the one at the cursor is marked.

   Folding and completion of D2's words were offered and left out. A page's
   code block is page text, so it gets the colours, not these keys.

3. **Colours are Bava's code colours** (`--syntax-*`, both themes), as the
   mockup's "4.5 D2 diagram" draws D2:
   - a comment, `# ...`: comment;
   - a reserved word (`shape`, `label`, `icon`, `style` and its fields,
     `direction`, `near`, `width`, `height`, `tooltip`, `link`, `class`,
     `classes`, `vars`, `layers`, `scenarios`, `steps`, `constraint`,
     `grid-rows`, `grid-columns` and the rest D2 v0.9.0 reserves): keyword;
   - a shape's or a connection's name: name;
   - a label or value after `:`, quoted or not, and a block string
     (`|md ... |`): string;
   - a number, and `true`, `false`, `null`: number;
   - a connection (`->`, `<-`, `<->`, `--`) and a glob or filter (`*`,
     `&`, `!&`): operator;
   - a variable (`${name}`): type;
   - braces, brackets, `;`, `.`, `:`: punctuation.
