/**
 * Every block and inline piece the page schema (`src/docs/schema.ts`) holds,
 * each as a small page of its own (a subject), and the pages the document
 * area pictures whole, made of them: the subjects at rest (`DOC_SHEETS`),
 * every one unable to draw, and every one empty (`sheetPage`). A page is put
 * into an empty page of the pretend Space before it opens (`openSeeded`), so
 * the Files tree never changes. `document-blocks.test.ts` fails on a schema
 * type on no sheet.
 */

/**
 * How a subject is selected: ArrowDown onto it from the end of the line
 * before; ArrowRight from the start of its line, `lead` characters in, then
 * onto it (or, with `shift`, across that many characters of it); its `word`
 * double-clicked; or a drag across table cells.
 */
export type Select =
  | { arrow: 'down' }
  | { arrow: 'right'; lead: number; shift?: number }
  | { word: true }
  | { drag: readonly [string, string] };

/**
 * How a subject is edited: its `word` selected, showing the formatting
 * bubble; its equation field; a code block's caption; a medium's caption
 * field or a file's name field, from its block menu; the link field (⌘K) over
 * its `word`, selected; the link field (⌘K) over its `word` that is already a
 * link, selected by keys, open with the address it links to.
 */
export type Edit = 'bubble' | 'equation' | 'code-caption' | 'caption' | 'rename' | 'link' | 'relink';

export type Subject = {
  /** The schema type pictured: a node or a mark of `src/docs/schema.ts`. */
  type: string;
  /** The page it is seeded on. */
  markdown: string;
  /** What is pictured, inside the page; several matches are pictured together. */
  find: string;
  /** What a selection or an emptying is checked on, inside the page; `find` when not given. */
  target?: string;
  /** Shown once it has drawn: a picture taken before would catch it loading. */
  ready?: string;
  /** A word in it, for the caret, a double-click, or a selection. */
  word?: string;
  select?: Select;
  /** What a selection marks, and how many, when it is not `target` ringed as one node. */
  marked?: { selector: string; count: number };
  edit?: Edit;
  /** The address its `word` links to, which the link field opens with when `edit` is `relink`. */
  linksTo?: string;
  /** Its line takes no marks, so no formatting bubble shows over its words selected. */
  takesNoMarks?: true;
  /** Emptied: its line's words deleted from `word`'s line, or a page holding it empty. */
  empty?: true | { markdown: string; ready: string };
  /** A page where it cannot draw what it holds, and the sign it shows. */
  error?: { markdown: string; ready: string };
};

/** A page holding `lines` between two lines of plain text. */
const page = (...lines: string[]) => ['Before it.', '', ...lines, '', 'After it.', ''].join('\n');

/** The line between the two, where an inline piece sits. */
const LINE = ':scope > p:nth-child(2)';

/** Marks are pictured on one word of a line, at rest and selected under the bubble. */
const mark = (type: string, written: string, word: string): Subject => ({
  type,
  markdown: page(`How we work: ${written} and the rest.`),
  find: LINE,
  word,
  select: { word: true },
});

/** The subjects, by the name their references are kept under. */
export const SUBJECTS = {
  // ---- blocks ----------------------------------------------------------------
  paragraph: {
    type: 'paragraph',
    markdown: page('A paragraph of plain words, set on one line.'),
    find: LINE,
    word: 'plain',
    edit: 'bubble',
  },
  'paragraph-coloured': {
    type: 'paragraph',
    markdown: page('<!-- bava: color=red background=yellow -->\nA coloured paragraph, on a background.'),
    find: LINE,
    word: 'coloured',
  },
  heading: {
    type: 'heading',
    markdown: page('## Goals for the launch'),
    find: ':scope > h2',
    word: 'Goals',
    edit: 'bubble',
    empty: true,
  },
  headings: {
    type: 'heading',
    markdown: page('# Heading one', '', '## Heading two', '', '### Heading three', '', '#### Heading four', '', '##### Heading five', '', '###### Heading six'),
    find: ':scope > :is(h1, h2, h3, h4, h5, h6)',
  },
  quote: {
    type: 'blockquote',
    markdown: page('> Files are the source of truth.'),
    find: ':scope > blockquote',
    word: 'source',
    edit: 'bubble',
    empty: true,
  },
  divider: {
    type: 'horizontal_rule',
    markdown: page('---'),
    // With the lines either side: a crop of the rule alone would cut through them.
    find: ':scope > :is(p:nth-child(1), hr, p:nth-child(3))',
    target: ':scope > hr',
    select: { arrow: 'down' },
  },
  bullets: {
    type: 'bullet_list',
    markdown: page('- Ship small\n  - Then smaller\n- Write it down'),
    find: ':scope > ul',
    word: 'Write',
    edit: 'bubble',
  },
  numbers: {
    type: 'ordered_list',
    markdown: page('1. Plan\n2. Build\n3. Check', '', '<!-- bava: list=a -->\n1. First\n2. Second', '', '<!-- bava: list=i -->\n1. One\n2. Two'),
    find: ':scope > ol',
    word: 'Build',
    edit: 'bubble',
  },
  item: {
    type: 'list_item',
    markdown: page('- Ship small\n- Write it down'),
    find: ':scope > ul',
    target: ':scope > ul > li >> nth=0',
    word: 'Ship',
    edit: 'bubble',
    empty: true,
  },
  todo: {
    type: 'list_item',
    markdown: page('- [x] Set up the Space\n- [ ] Invite the team'),
    find: ':scope > ul > li',
    target: 'li[data-checked="false"]',
    word: 'Invite',
    empty: true,
  },
  callout: {
    type: 'callout',
    markdown: page('> [!info]\n> Ship it on Friday.'),
    find: ':scope > aside.callout',
    word: 'Friday',
    edit: 'bubble',
    empty: true,
  },
  toggle: {
    type: 'toggle',
    markdown: page(
      '<details open>\n<summary>An open toggle</summary>\n\nShown inside it.\n\n</details>',
      '',
      '<details>\n<summary>A folded toggle</summary>\n\nHidden inside it.\n\n</details>',
    ),
    find: ':scope > .toggle',
    target: ':scope > .toggle >> nth=0',
    word: 'Shown',
    edit: 'bubble',
  },
  'toggle-summary': {
    type: 'toggle_summary',
    markdown: page('<details open>\n<summary>An open toggle</summary>\n\nShown inside it.\n\n</details>'),
    find: ':scope > .toggle',
    target: '.toggle-summary',
    word: 'open',
    takesNoMarks: true,
    empty: true,
  },
  code: {
    type: 'code_block',
    markdown: page('<!-- bava: caption="Start the server" -->\n```go\nfunc main() {\n\thttp.ListenAndServe(":8080", nil)\n}\n```'),
    find: ':scope > .code-block',
    ready: '.syntax-keyword',
    word: 'main',
    edit: 'code-caption',
    empty: { markdown: page('```go\n```'), ready: '.code-block' },
  },
  equation: {
    type: 'math_block',
    markdown: page('$$\n\\int_0^1 x^2\\,dx = \\tfrac{1}{3}\n$$'),
    find: ':scope > .math-block',
    ready: '.katex-display',
    select: { arrow: 'down' },
    edit: 'equation',
    empty: { markdown: page('$$\n$$'), ready: '.math-empty' },
    error: { markdown: page('$$\\frac{1$$'), ready: '.math-error' },
  },
  contents: {
    type: 'contents',
    markdown: page('<!-- bava: contents -->', '', '<!-- bava: /contents -->', '', '## Goals', '', '### This quarter', '', '## Dates'),
    find: ':scope > nav.contents',
    ready: '.contents a',
    select: { arrow: 'down' },
    empty: { markdown: page('<!-- bava: contents -->', '', '<!-- bava: /contents -->'), ready: '.contents-empty' },
  },
  footnotes: {
    type: 'footnotes',
    markdown: ['Before it.', '', 'A claim.[^1] And another.[^2]', '', '[^1]: The source of the claim.', '', '[^2]: A second source.', ''].join('\n'),
    find: ':scope > .footnotes',
    word: 'second',
  },
  footnote: {
    type: 'footnote',
    markdown: ['Before it.', '', 'A claim.[^1] And another.[^2]', '', '[^1]: The source of the claim.', '', '[^2]: A second source.', ''].join('\n'),
    find: ':scope > .footnotes',
    target: '.footnote >> nth=1',
    word: 'second',
    edit: 'bubble',
    empty: true,
  },
  table: {
    type: 'table',
    markdown: page('| Name | Role   |\n|------|--------|\n| Ana  | Design |\n| Ben  | Build  |'),
    find: ':scope > .tableWrapper',
    select: { drag: ['Name', 'Build'] },
    marked: { selector: '.selectedCell', count: 6 },
  },
  row: {
    type: 'table_row',
    markdown: page('| Name | Role   |\n|------|--------|\n| Ana  | Design |\n| Ben  | Build  |'),
    find: ':scope > .tableWrapper',
    select: { drag: ['Ana', 'Design'] },
    marked: { selector: '.selectedCell', count: 2 },
  },
  cell: {
    type: 'table_cell',
    markdown: page('| Name | Role   |\n|------|--------|\n| Ana  | Design |\n| Ben  | Build  |'),
    find: ':scope > .tableWrapper',
    target: 'td >> nth=0',
    word: 'Ana',
    select: { drag: ['Ana', 'Ben'] },
    marked: { selector: '.selectedCell', count: 2 },
    edit: 'bubble',
    empty: true,
  },
  'header-cell': {
    type: 'table_header',
    markdown: page('| Name | Role   |\n|------|--------|\n| Ana  | Design |\n| Ben  | Build  |'),
    find: ':scope > .tableWrapper',
    target: 'th >> nth=1',
    word: 'Role',
    select: { drag: ['Name', 'Role'] },
    marked: { selector: '.selectedCell', count: 2 },
    edit: 'bubble',
    empty: true,
  },
  image: {
    type: 'image',
    markdown: page('<!-- bava: width=medium caption="The landscape" -->\n![Landscape](../.bava/attachments/landscape.png)'),
    find: ':scope > figure.media',
    ready: 'figure.media[data-state="ready"]',
    select: { arrow: 'down' },
    edit: 'caption',
  },
  embed: {
    type: 'embed',
    markdown: page('<!-- bava: embed=f1 page="../Engineering/Release%20checklist.md" width=medium caption="The release flow" -->\n![Release flow](../.bava/attachments/landscape.png)'),
    find: ':scope > figure.embed',
    // A frame its page no longer holds.
    error: { markdown: page('<!-- bava: embed=gone page="../Engineering/Release%20checklist.md" width=small -->\n![Gone](../.bava/attachments/logo.png)'), ready: 'figure.embed[data-deleted]' },
  },
  video: {
    type: 'video',
    markdown: page('<!-- bava: width=medium poster="demo poster.png" -->\n![Demo](../.bava/attachments/demo.mp4)'),
    find: ':scope > figure.media',
    ready: 'figure.media video[poster]',
    select: { arrow: 'down' },
    edit: 'caption',
    error: { markdown: page('![Demo](../.bava/attachments/gone.mp4)'), ready: 'figure.media[data-state="missing"]' },
  },
  'online-video': {
    type: 'image',
    markdown: page('<!-- bava: width=medium caption="The launch demo" -->\n![Launch demo](https://www.youtube.com/watch?v=abc123)'),
    find: ':scope > figure.media',
    ready: 'figure.media[data-kind="online"]',
    select: { arrow: 'down' },
  },
  'file-card': {
    type: 'card',
    markdown: page('<!-- bava: card -->\n[Q3 report.pdf](../.bava/attachments/Q3%20report.pdf)'),
    find: ':scope > .card',
    ready: '.card[data-state="ready"]',
    select: { arrow: 'down' },
    edit: 'rename',
    error: { markdown: page('<!-- bava: card -->\n[Budget.xlsx](Budget.xlsx)'), ready: '.card[data-state="missing"]' },
  },
  'web-card': {
    type: 'card',
    markdown: page(
      '<!-- bava: card=extended description="How we ship each week, and what went out." icon="example.com icon.png" image="example.com picture.png" -->\n[Release notes](https://www.example.com/notes)',
    ),
    find: ':scope > .card',
    select: { arrow: 'down' },
  },
  kept: {
    type: 'kept',
    markdown: page('<div align="center">\n  <b>raw</b>\n</div>'),
    find: ':scope > .kept-block',
    select: { arrow: 'down' },
  },

  // ---- inline ----------------------------------------------------------------
  bold: mark('strong', '**bold**', 'bold'),
  italic: mark('em', '*italic*', 'italic'),
  underline: mark('underline', '<u>underlined</u>', 'underlined'),
  strike: mark('strike', '~~struck~~', 'struck'),
  'inline-code': mark('code', '`code`', 'code'),
  colour: mark('color', '<span data-color="blue">blue</span>', 'blue'),
  highlight: mark('highlight', '<span data-highlight="yellow">highlighted</span>', 'highlighted'),
  link: {
    type: 'link',
    markdown: page('Read the [guide](https://example.com) first.'),
    find: LINE,
    // By keys: a click on a link opens its card.
    select: { arrow: 'right', lead: 'Read the '.length, shift: 'guide'.length },
    // A link made: the field over a word not yet linked.
    word: 'first',
    edit: 'link',
    error: { markdown: page('The [Brief](Brief.md) was never written.'), ready: '.link-missing' },
  },
  // A link changed: the field over a word already linked, with its address.
  'link-changed': {
    type: 'link',
    markdown: page('Read the [guide](https://example.com) first.'),
    find: LINE,
    word: 'guide',
    linksTo: 'https://example.com',
    edit: 'relink',
  },
  'page-link': {
    type: 'link',
    markdown: page('See [Roadmap](../Roadmap.md) for the dates.'),
    find: LINE,
    select: { arrow: 'right', lead: 'See '.length, shift: 'Roadmap'.length },
  },
  'inline-equation': {
    type: 'math_inline',
    markdown: page('The area is $\\pi r^2$, as claimed.'),
    find: LINE,
    target: '.math-inline',
    ready: '.math-inline .katex',
    select: { arrow: 'right', lead: 'The area is '.length },
    error: { markdown: page('The area is $\\frac{1$, as claimed.'), ready: '.math-error' },
  },
  'footnote-ref': {
    type: 'footnote_ref',
    markdown: ['Before it.', '', 'A claim.[^1] And more.', '', '[^1]: The note.', ''].join('\n'),
    find: LINE,
    target: 'sup.footnote-ref',
    select: { arrow: 'right', lead: 'A claim.'.length },
  },
  date: {
    type: 'date',
    markdown: page('Due <time datetime="2026-10-02">2 Oct 2026</time> at noon.'),
    find: LINE,
    target: 'time.date-chip',
    select: { arrow: 'right', lead: 'Due '.length },
  },
  'kept-inline': {
    type: 'keptInline',
    markdown: page('Press <kbd>K</kbd> to find.'),
    find: LINE,
    target: '.kept-inline >> nth=0',
    select: { arrow: 'right', lead: 'Press '.length },
  },
  'line-break': {
    type: 'hard_break',
    markdown: page('A first line,\\\nand a second after a break.'),
    find: LINE,
  },
  emoji: {
    type: 'text',
    markdown: page('Ship it 🚀 today.'),
    find: LINE,
    select: { arrow: 'right', lead: 'Ship it '.length, shift: 1 },
  },
} satisfies Record<string, Subject>;

export type SubjectName = keyof typeof SUBJECTS;

/** The pages pictured whole at rest, by name: the subjects each holds, in order. */
export const DOC_SHEETS = {
  blocks: [
    'paragraph', 'paragraph-coloured', 'heading', 'headings', 'quote', 'divider', 'bullets', 'numbers', 'item', 'todo',
    'callout', 'toggle', 'toggle-summary', 'code', 'equation', 'contents', 'footnotes', 'footnote',
  ],
  media: ['table', 'row', 'cell', 'header-cell', 'image', 'embed', 'video', 'online-video', 'file-card', 'web-card', 'kept'],
  inline: [
    'bold', 'italic', 'underline', 'strike', 'inline-code', 'colour', 'highlight', 'link', 'link-changed', 'page-link',
    'inline-equation', 'footnote-ref', 'date', 'kept-inline', 'line-break', 'emoji',
  ],
} as const satisfies Record<string, readonly SubjectName[]>;

export type DocSheet = keyof typeof DOC_SHEETS | 'errors' | 'empty';

/** What a subject's page holds between its lines before and after. */
const body = (markdown: string) => markdown.replace(/^Before it\.\n\n/, '').replace(/\n\nAfter it\.\n$/, '');

/**
 * A sheet's page, and what shows once it has drawn: the subjects at rest, or
 * every subject that has a page unable to draw (`errors`) or a page holding
 * it empty (`empty`). A body two subjects share (a list and its item) is
 * written once.
 */
export function sheetPage(sheet: DocSheet): { markdown: string; ready: string[] } {
  const subjects = Object.values(SUBJECTS) as Subject[];
  const pages: { markdown: string; ready?: string }[] =
    sheet === 'errors'
      ? subjects.flatMap((subject) => (subject.error ? [subject.error] : []))
      : sheet === 'empty'
        ? subjects.flatMap((subject) => (typeof subject.empty === 'object' ? [subject.empty] : []))
        : DOC_SHEETS[sheet].map((name) => SUBJECTS[name] as Subject);
  const bodies = [...new Set(pages.map((each) => body(each.markdown)))];
  return {
    markdown: ['Before it.', '', ...bodies.flatMap((each) => [each, '']), 'After it.', ''].join('\n'),
    ready: pages.flatMap((each) => (each.ready ? [each.ready] : [])),
  };
}
