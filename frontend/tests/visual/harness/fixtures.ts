/**
 * The pretend Space the screen checks open: the one the mockups draw, so a
 * screenshot can be read against them. Fixed content, fixed dates.
 */
export type FakePage = { source: string; scene: { version: number; elements: unknown[] } };
export type FakeTrashItem = { id: string; path: string; kind: 'page' | 'folder'; deletedAt: string; size: number };

export type FakeSpace = {
  root: string;
  pageWidth: string;
  /** Each folder's entries, in the order the Space keeps: "" is the top. */
  folders: Record<string, string[]>;
  pages: Record<string, FakePage>;
  trash: FakeTrashItem[];
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
    '<!-- bava: toggle -->',
    '## A folded section',
    '',
    'Hidden under its heading.',
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

// A locked page: nothing on it can be changed until it is unlocked.
const checklist: FakePage = {
  source: '---\nbava:\n  locked: true\n---\n# Release checklist\n\n- [x] Tag the build\n- [ ] Write the notes\n',
  scene: { version: 1, elements: [] },
};

export function seedSpace(): FakeSpace {
  return {
    root: SPACE_ROOT,
    pageWidth: '',
    folders: {
      '': ['Marketing', 'Engineering', 'Roadmap.md', 'Team handbook.md'],
      Marketing: ['Launch plan.md', 'Brand guide.md', 'Press release.md'],
      Engineering: ['Architecture.md', 'Release checklist.md', 'Blocks.md'],
    },
    pages: {
      'Roadmap.md': blank(),
      'Team handbook.md': handbook,
      'Marketing/Launch plan.md': launchPlan,
      'Marketing/Brand guide.md': blank(),
      'Marketing/Press release.md': blank(),
      'Engineering/Architecture.md': architecture,
      'Engineering/Release checklist.md': checklist,
      'Engineering/Blocks.md': blocks,
    },
    trash: [
      { id: 't1', path: 'Meeting notes/Q3 retro.md', kind: 'page', deletedAt: '2026-09-27T09:00:00Z', size: 2048 },
      { id: 't2', path: 'Marketing/Old drafts', kind: 'folder', deletedAt: '2026-09-21T09:00:00Z', size: 48_000 },
    ],
  };
}
