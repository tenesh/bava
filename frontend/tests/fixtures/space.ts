/**
 * The pretend Space the browser tests open: the one the mockups draw, so a
 * screenshot can be read against them. Fixed content, fixed dates.
 */
export type FakePage = { source: string; scene: { version: number; elements: unknown[] } };
export type FakeTrashItem = { id: string; path: string; kind: 'page' | 'folder' | 'attachment'; deletedAt: string; size: number };
export type FakeAttachment = { name: string; size: number; modified: string };

export type FakeSpace = {
  root: string;
  pageWidth: string;
  /** Each folder's entries, in the order the Space keeps: "" is the top. */
  folders: Record<string, string[]>;
  pages: Record<string, FakePage>;
  trash: FakeTrashItem[];
  /** The files of `.bava/attachments`, testdata/fixtures/media's where the route serves them. */
  attachments: FakeAttachment[];
};

export const SPACE_ROOT = '/Users/you/Documents/Acme Product';
export const PARENT = '/Users/you/Documents';

const blank = (): FakePage => ({ source: '', scene: { version: 1, elements: [] } });

// Three shapes and an arrow, as the Canvas mockup has them.
const architecture: FakePage = {
  source: '',
  scene: {
    version: 1,
    elements: [
      { id: 'editor', type: 'rect', z: 1, x: 120, y: 120, w: 160, h: 70, label: 'Editor' },
      { id: 'check', type: 'rect', z: 2, x: 420, y: 120, w: 170, h: 70, label: 'Stamp check', fill: '#e6eef7', stroke: '#4a7fb5' },
      { id: 'write', type: 'ellipse', z: 3, x: 420, y: 300, w: 220, h: 90, label: 'Write file', fill: '#e7f2ea', stroke: '#4f8a5e' },
      { id: 'save', type: 'arrow', z: 4, x: 280, y: 155, w: 140, h: 0, points: [0, 0, 140, 0], startBinding: 'editor', endBinding: 'check', label: 'save' },
    ],
  },
};

// Links to other pages (one of them missing), to a heading on another page, and dates.
const roadmap: FakePage = {
  source: [
    '# Roadmap',
    '',
    'The look is in the [Brand guide](Marketing/Brand%20guide.md); how we work is in [Lists](Team%20handbook.md#lists).',
    '',
    'The [Brief](Brief.md) was never written.',
    '',
    'Beta on <time datetime="2026-10-02">2 Oct 2026</time>, review <time datetime="2026-10-09">next Friday</time>.',
    '',
  ].join('\n'),
  scene: { version: 1, elements: [] },
};

const launchPlan: FakePage = {
  source: '# Launch plan\n\nHow we take Bava 1.0 to the first thousand users: goals, dates, and who owns what.\n',
  scene: { version: 1, elements: [] },
};

// Every construct of the Document's format, to see each drawn.
const handbook: FakePage = {
  source: [
    '# Team handbook',
    '',
    'How we work: **bold**, *italic*, <u>underlined</u>, ~~struck~~, `code`, a [link](https://example.com), <span data-color="blue">blue text</span> and <span data-highlight="yellow">a highlight</span>.',
    '',
    '## Lists',
    '',
    '- Ship small\n  - Then smaller\n- Write it down',
    '',
    '<!-- bava: list=a -->\n1. Plan\n2. Build\n3. Check',
    '',
    '<!-- bava: list=i -->\n1. First\n2. Second',
    '',
    '- [x] Set up the Space\n- [ ] Invite the team',
    '',
    '### A quote',
    '',
    '> Files are the source of truth. Everything else is a cache.',
    '',
    '<!-- bava: color=red background=yellow -->\nA coloured paragraph, on a background.',
    '',
    '---',
    '',
    '```go\nfunc main() {}\n```',
    '',
    '| Who | What |\n|---|---|\n| Ana | Design |',
    '',
  ].join('\n'),
  scene: { version: 1, elements: [] },
};

// Every block that is more than text: callouts, toggles, code, equations,
// footnotes, contents and emoji.
const blocks: FakePage = {
  source: [
    '# Blocks',
    '',
    '<!-- bava: contents -->',
    '',
    '<!-- bava: /contents -->',
    '',
    '> [!info]',
    '> An info callout. Ship it 🚀',
    '',
    '> [!warning] Heads up',
    '> A warning with a title from another app.',
    '',
    '<!-- bava: color=purple icon=🌱 -->',
    '> [!note]',
    '> A custom callout, in its own colour.',
    '',
    '<details open>',
    '<summary>An open toggle</summary>',
    '',
    'Shown inside it.',
    '',
    '</details>',
    '',
    '<details>',
    '<summary>A folded toggle</summary>',
    '',
    'Hidden inside it.',
    '',
    '</details>',
    '',
    '## Code',
    '',
    '<!-- bava: caption="Start the server" -->',
    '```go',
    'func main() {',
    '\thttp.ListenAndServe(":8080", nil) // serve',
    '}',
    '```',
    '',
    '## Equations',
    '',
    'The area is $\\pi r^2$, as claimed.[^1]',
    '',
    '$$',
    '\\int_0^1 x^2\\,dx = \\tfrac{1}{3}',
    '$$',
    '',
    '$$\\frac{1$$',
    '',
    '[^1]: The source of the claim.',
    '',
  ].join('\n'),
  scene: { version: 1, elements: [] },
};

// Both table forms: a Markdown table, and an HTML one with a merge, colours,
// a width and a header column.
const tablesPage: FakePage = {
  source: [
    '# Tables',
    '',
    '| Name | Role   | Hours |',
    '|------|:------:|------:|',
    '| Ana  | Design | 12    |',
    '| Ben  | Build  | 30    |',
    '',
    '<table>',
    '<colgroup><col width="140"><col><col></colgroup>',
    '<tr><th>Quarter</th><th>Plan</th><th>Status</th></tr>',
    '<tr><th>Q1</th><td colspan="2" data-background="yellow"><strong>Beta</strong><br>and review</td></tr>',
    '<tr><th>Q2</th><td>Launch</td><td data-background="green">On track</td></tr>',
    '</table>',
    '',
  ].join('\n'),
  scene: { version: 1, elements: [] },
};

// Images at each width, shape and alignment, a captioned one, a video with
// its poster, and one whose file is missing (a file of its name is in the
// attachments, so relinking is offered). The files are testdata/fixtures/media's.
const mediaPage: FakePage = {
  source: [
    '# Media',
    '',
    '<!-- bava: width=small align=left caption="Small, on the left" -->',
    '![Logo](../.bava/attachments/logo.png)',
    '',
    '<!-- bava: width=medium ratio=1:1 align=right -->',
    '![Landscape](../.bava/attachments/landscape.png)',
    '',
    '<!-- bava: width=large ratio=16:9 caption="Large, wide" -->',
    '![Landscape](../.bava/attachments/landscape.png)',
    '',
    '![Landscape at its own size](../.bava/attachments/landscape.png)',
    '',
    '<!-- bava: width=full poster="demo poster.png" -->',
    '![Demo](../.bava/attachments/demo.mp4)',
    '',
    'Typed after the video.',
    '',
    '![Old logo](images/logo.png)',
    '',
    '## Cards',
    '',
    '<!-- bava: card -->',
    '[Q3 report.pdf](../.bava/attachments/Q3%20report.pdf)',
    '',
    '<!-- bava: card=extended -->',
    '[Q3 report.pdf](../.bava/attachments/Q3%20report.pdf)',
    '',
    '<!-- bava: card icon="example.com icon.png" -->',
    '[Release notes](https://www.example.com/notes)',
    '',
    '<!-- bava: card=extended description="How we ship each week, and what went out." icon="example.com icon.png" image="example.com picture.png" -->',
    '[Release notes](https://www.example.com/notes)',
    '',
    '<!-- bava: card -->',
    '[Budget.xlsx](Budget.xlsx)',
    '',
    '<!-- bava: width=large caption="The launch demo" -->',
    '![Launch demo](https://www.youtube.com/watch?v=abc123)',
    '',
  ].join('\n'),
  scene: { version: 1, elements: [] },
};

// A locked page: nothing on it can be changed until it is unlocked.
const checklist: FakePage = {
  source: '---\nbava:\n  locked: true\n---\n# Release checklist\n\n- [x] Tag the build\n- [ ] Write the notes\n',
  // A frame other pages embed.
  scene: { version: 1, elements: [{ id: 'f1', type: 'frame', z: 1, x: 0, y: 0, w: 400, h: 240, label: 'Release flow' }] },
};

export function seedSpace(): FakeSpace {
  return {
    root: SPACE_ROOT,
    pageWidth: '',
    folders: {
      '': ['Marketing', 'Engineering', 'Roadmap.md', 'Team handbook.md'],
      Marketing: ['Launch plan.md', 'Brand guide.md', 'Press release.md'],
      Engineering: ['Architecture.md', 'Release checklist.md', 'Blocks.md', 'Tables.md', 'Media.md'],
    },
    pages: {
      'Roadmap.md': roadmap,
      'Team handbook.md': handbook,
      'Marketing/Launch plan.md': launchPlan,
      'Marketing/Brand guide.md': blank(),
      'Marketing/Press release.md': blank(),
      'Engineering/Architecture.md': architecture,
      'Engineering/Release checklist.md': checklist,
      'Engineering/Blocks.md': blocks,
      'Engineering/Tables.md': tablesPage,
      'Engineering/Media.md': mediaPage,
    },
    attachments: [
      { name: 'Budget draft.xlsx', size: 18_400, modified: '2026-09-04T09:00:00Z' },
      { name: 'Q3 report.pdf', size: 248_000, modified: '2026-09-21T09:00:00Z' },
      { name: 'demo poster.png', size: 4_120, modified: '2026-09-12T09:00:00Z' },
      { name: 'demo.mp4', size: 3_400_000, modified: '2026-09-12T09:00:00Z' },
      { name: 'example.com icon.png', size: 380, modified: '2026-09-20T09:00:00Z' },
      { name: 'example.com picture.png', size: 2_900, modified: '2026-09-20T09:00:00Z' },
      { name: 'landscape.png', size: 4_085, modified: '2026-09-10T09:00:00Z' },
      { name: 'logo.png', size: 1_058, modified: '2026-09-08T09:00:00Z' },
      { name: 'old diagram.png', size: 12_600, modified: '2026-08-02T09:00:00Z' },
    ],
    trash: [
      { id: 't1', path: 'Meeting notes/Q3 retro.md', kind: 'page', deletedAt: '2026-09-27T09:00:00Z', size: 2048 },
      { id: 't2', path: 'Marketing/Old drafts', kind: 'folder', deletedAt: '2026-09-21T09:00:00Z', size: 48_000 },
    ],
  };
}
