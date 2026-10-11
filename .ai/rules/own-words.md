# Own words

## Bava never names another product as a comparison or a source
Specs, decisions, plans, rules, comments, test names and commit messages
say what Bava does and why it is right for Bava, in its own words: what the
user sees, what it prevents, what it costs. Not "as another app does", not
"matching another app's", not a study of another app kept in the
repository. `names_test.go` (at the root) fails on the names known so far;
a new one is added there when it would otherwise slip in. Names that are
also plain words are matched only capitalised, so a sentence may not start
with one of those words either: "A linear element" passes where the word
alone, capitalised at the start, would not.

## What stays named
`NOTICE`, where a licence requires its source to be named: code adapted
from another project carries that project's copyright and licence there,
for as long as the adapted code stays.

What Bava is built on and runs with: its dependencies (as `NOTICE` lists
them), the operating systems, their webviews and stores, file formats,
languages and standards (Markdown, D2, Mermaid, TeX), and GitHub, where the
code lives. Interoperability is said without brands: "other Markdown
editors", "a spreadsheet's copied cells".

## Looking elsewhere is fine; keeping it is not
Learning how something behaves elsewhere, in a conversation, is fine. What
reaches the repository is the decision and Bava's reason for it, never the
other product or its internals.
