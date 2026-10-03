/**
 * Every block and inline piece the page schema (`src/docs/schema.ts`) holds,
 * each as a small page put into an empty page of the pretend Space before it
 * opens (`openSeeded`), so the Files tree never changes. Each subject is one
 * thing pictured, of one schema type, in the states its fields name.
 * `harness/document-blocks.test.ts` fails on a schema type left without a
 * picture in a state and no reason given.
 */

/**
 * The states a block or an inline piece is pictured in: at rest; with the
 * pointer over it and its block handle showing; selected; being edited (its
 * words selected under the formatting bubble, or its field open); emptied;
 * and drawing an error.
 */
export const BLOCK_STATES = ['rest', 'hovered', 'selected', 'editing', 'empty', 'error'] as const;

export type BlockState = (typeof BLOCK_STATES)[number];

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
  /** The subject whose picture at rest shows it as it would be here: no second, same picture is taken. */
  restAs?: string;
  /** Shown once it has drawn: a picture taken before would catch it loading. */
  ready?: string;
  /** A word in it, for the caret, a double-click, or a selection. */
  word?: string;
  /** Pictured with the pointer over it and its block handle showing. */
  hover?: true;
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
    hover: true,
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
    hover: true,
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
    hover: true,
    edit: 'bubble',
    empty: true,
  },
  divider: {
    type: 'horizontal_rule',
    markdown: page('---'),
    // With the lines either side: a crop of the rule alone would cut through them.
    find: ':scope > :is(p:nth-child(1), hr, p:nth-child(3))',
    target: ':scope > hr',
    hover: true,
    select: { arrow: 'down' },
  },
  bullets: {
    type: 'bullet_list',
    markdown: page('- Ship small\n  - Then smaller\n- Write it down'),
    find: ':scope > ul',
    word: 'Write',
    hover: true,
    edit: 'bubble',
  },
  numbers: {
    type: 'ordered_list',
    markdown: page('1. Plan\n2. Build\n3. Check', '', '<!-- bava: list=a -->\n1. First\n2. Second', '', '<!-- bava: list=i -->\n1. One\n2. Two'),
    find: ':scope > ol',
    word: 'Build',
    hover: true,
    edit: 'bubble',
  },
  item: {
    type: 'list_item',
    markdown: page('- Ship small\n- Write it down'),
    find: ':scope > ul',
    target: ':scope > ul > li >> nth=0',
    restAs: 'bullets',
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
    hover: true,
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
    hover: true,
    edit: 'bubble',
  },
  'toggle-summary': {
    type: 'toggle_summary',
    markdown: page('<details open>\n<summary>An open toggle</summary>\n\nShown inside it.\n\n</details>'),
    find: ':scope > .toggle',
    target: '.toggle-summary',
    restAs: 'toggle',
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
    hover: true,
    edit: 'code-caption',
    empty: { markdown: page('```go\n```'), ready: '.code-block' },
  },
  equation: {
    type: 'math_block',
    markdown: page('$$\n\\int_0^1 x^2\\,dx = \\tfrac{1}{3}\n$$'),
    find: ':scope > .math-block',
    ready: '.katex-display',
    hover: true,
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
    hover: true,
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
    restAs: 'footnotes',
    word: 'second',
    edit: 'bubble',
    empty: true,
  },
  table: {
    type: 'table',
    markdown: page('| Name | Role   |\n|------|--------|\n| Ana  | Design |\n| Ben  | Build  |'),
    find: ':scope > .tableWrapper',
    hover: true,
    select: { drag: ['Name', 'Build'] },
    marked: { selector: '.selectedCell', count: 6 },
  },
  row: {
    type: 'table_row',
    markdown: page('| Name | Role   |\n|------|--------|\n| Ana  | Design |\n| Ben  | Build  |'),
    find: ':scope > .tableWrapper',
    restAs: 'table',
    select: { drag: ['Ana', 'Design'] },
    marked: { selector: '.selectedCell', count: 2 },
  },
  cell: {
    type: 'table_cell',
    markdown: page('| Name | Role   |\n|------|--------|\n| Ana  | Design |\n| Ben  | Build  |'),
    find: ':scope > .tableWrapper',
    restAs: 'table',
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
    restAs: 'table',
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
    hover: true,
    select: { arrow: 'down' },
    edit: 'caption',
  },
  video: {
    type: 'video',
    markdown: page('<!-- bava: width=medium poster="demo poster.png" -->\n![Demo](../.bava/attachments/demo.mp4)'),
    find: ':scope > figure.media',
    ready: 'figure.media video[poster]',
    hover: true,
    select: { arrow: 'down' },
    edit: 'caption',
    error: { markdown: page('![Demo](../.bava/attachments/gone.mp4)'), ready: 'figure.media[data-state="missing"]' },
  },
  'online-video': {
    type: 'image',
    markdown: page('<!-- bava: width=medium caption="The launch demo" -->\n![Launch demo](https://www.youtube.com/watch?v=abc123)'),
    find: ':scope > figure.media',
    ready: 'figure.media[data-kind="online"]',
    hover: true,
    select: { arrow: 'down' },
  },
  'file-card': {
    type: 'card',
    markdown: page('<!-- bava: card -->\n[Q3 report.pdf](../.bava/attachments/Q3%20report.pdf)'),
    find: ':scope > .card',
    ready: '.card[data-state="ready"]',
    hover: true,
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
    hover: true,
    select: { arrow: 'down' },
  },
  kept: {
    type: 'kept',
    markdown: page('<div align="center">\n  <b>raw</b>\n</div>'),
    find: ':scope > .kept-block',
    hover: true,
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
    restAs: 'link',
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

/** The states a subject is pictured in. */
export function statesOf(subject: Subject): BlockState[] {
  return BLOCK_STATES.filter((state) => {
    if (state === 'rest') return subject.restAs === undefined;
    if (state === 'hovered') return subject.hover === true;
    if (state === 'selected') return subject.select !== undefined;
    if (state === 'editing') return subject.edit !== undefined;
    if (state === 'empty') return subject.empty !== undefined;
    return subject.error !== undefined;
  });
}

/**
 * States pictured by an existing walk of the `document` area, by schema type:
 * the reference that shows it.
 */
export const PICTURED_ELSEWHERE: Record<string, Partial<Record<BlockState, string>>> = {
  paragraph: { empty: 'document/page--placeholder' },
  code_block: { editing: 'document/language-menu--open' },
  table: { empty: 'document/table--new-slash' },
  image: { error: 'document/media--bottom' },
  math_inline: { editing: 'document/equation-field--editing' },
  date: { editing: 'document/date-chip--calendar' },
};

const INLINE = ['text', 'hard_break', 'math_inline', 'footnote_ref', 'date', 'keptInline'];
const MARKS = ['color', 'highlight', 'strong', 'em', 'underline', 'strike', 'link', 'code'];
const all = (types: string[], why: string) => Object.fromEntries(types.map((type) => [type, why]));

const NOT_TOP_LEVEL = 'the handle is for a block of the page, and this sits inside one: pictured hovered as the block holding it';
const NOTHING_TO_TYPE = 'nothing in it is typed or set in a field';
const NEVER_EMPTY = 'it has no words to empty';
const CANNOT_FAIL = 'nothing it holds can fail to draw';
const TEXT_SELECTED =
  'a block of text is never selected whole: a click or its handle puts the caret in it, which no picture draws; its words selected are pictured as editing';
const MARK_EDIT = 'a mark is set and cleared from the formatting bubble, pictured as selected';

/**
 * What a state leaves out, by schema type, each with why it cannot be shown.
 * Everything else is pictured in it, here or in `PICTURED_ELSEWHERE`.
 */
export const LEFT_OUT: Record<BlockState, Record<string, string>> = {
  rest: {
    doc: 'the page itself: pictured whole in the document area',
  },
  hovered: {
    doc: 'the page itself has no handle',
    ...all(['list_item', 'toggle_summary', 'table_row', 'table_cell', 'table_header'], NOT_TOP_LEVEL),
    footnotes: 'the notes follow their references: they have no handle',
    footnote: 'the notes follow their references: they have no handle',
    ...all([...INLINE, ...MARKS], NOT_TOP_LEVEL),
  },
  selected: {
    doc: 'Select All selects its text, pictured as any selection of words',
    ...all(
      ['paragraph', 'heading', 'blockquote', 'bullet_list', 'ordered_list', 'list_item', 'callout', 'toggle', 'toggle_summary', 'code_block', 'footnotes', 'footnote'],
      TEXT_SELECTED,
    ),
    hard_break: 'a line break is never selected on its own',
  },
  editing: {
    doc: 'the page itself: each block is pictured being edited',
    horizontal_rule: NOTHING_TO_TYPE,
    contents: 'it is rebuilt from the page\'s headings: nothing in it is typed',
    footnotes: 'each note is edited in its place, pictured as footnote',
    table: 'typing goes into a cell, pictured as table_cell and table_header',
    table_row: 'typing goes into a cell, pictured as table_cell and table_header',
    kept: 'kept byte for byte: Bava cannot edit it',
    text: 'words are edited in their block, pictured with each block',
    hard_break: NOTHING_TO_TYPE,
    footnote_ref: 'its number comes from the page\'s order, and its note is edited at the end, pictured as footnote',
    keptInline: 'kept as written: Bava cannot edit it',
    toggle_summary: 'it takes no marks, so its words selected show no bubble, and the caret in it is never drawn',
    ...all(['color', 'highlight', 'strong', 'em', 'underline', 'strike', 'code'], MARK_EDIT),
  },
  empty: {
    doc: 'an empty page is pictured as page--placeholder in the document area',
    horizontal_rule: NEVER_EMPTY,
    bullet_list: 'a list with nothing in it is one empty item, pictured as list_item',
    ordered_list: 'a list with nothing in it is one empty item, pictured as list_item',
    toggle: 'a toggle with nothing in it is an empty summary line, pictured as toggle_summary',
    footnotes: 'notes nothing cites are kept with their words: there are never notes without one',
    table_row: 'a row with nothing in it is its cells emptied, pictured as table_cell',
    image: 'an image is its file: one whose file is gone is its error',
    video: 'a video is its file: one whose file is gone is its error',
    card: 'a card is its link: one whose file is gone is its error',
    kept: NEVER_EMPTY,
    ...all([...INLINE, ...MARKS], 'an inline piece with nothing in it is not kept on the page'),
  },
  error: {
    ...all(
      [
        'doc', 'paragraph', 'heading', 'blockquote', 'horizontal_rule', 'bullet_list', 'ordered_list', 'list_item',
        'callout', 'toggle', 'toggle_summary', 'code_block', 'contents', 'footnotes', 'footnote', 'table', 'table_row',
        'table_cell', 'table_header', 'text', 'hard_break',
        'color', 'highlight', 'strong', 'em', 'underline', 'strike', 'code',
      ],
      CANNOT_FAIL,
    ),
    kept: 'it is itself what the page shows for what Bava cannot read',
    footnote_ref: 'a reference with no note is read as the words it was written as',
    date: 'a date that is not a day is read as the words it was written as',
    keptInline: 'it is itself what the page shows for what Bava cannot read',
  },
};
