// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NodeSelection, TextSelection } from 'prosemirror-state';
import { DocEditor } from './editor';
import { classifyLink, followAction, followBeside, joinFile, missingTarget, relinkCandidate } from './links';
import { atTextEnd } from './test-caret';

const pages = [
  { name: 'Launch plan', path: 'Marketing/Launch plan.md' },
  { name: 'Roadmap', path: 'Roadmap.md' },
  { name: 'Brief', path: 'Archive/Brief.md' },
  { name: 'Notes', path: 'Notes.md' },
  { name: 'Notes', path: 'Old/Notes.md' },
];

describe('what a link is', () => {
  it('is a heading on this page, the web, mail, or a file beside it', () => {
    expect(classifyLink('#goals')).toBe('anchor');
    expect(classifyLink('https://example.com')).toBe('web');
    expect(classifyLink('HTTP://example.com')).toBe('web');
    expect(classifyLink('mailto:ana@example.com')).toBe('mail');
    expect(classifyLink('../Roadmap.md#goals')).toBe('relative');
    expect(classifyLink('javascript:alert(1)')).toBe('other');
    expect(classifyLink('file:///etc/passwd')).toBe('other');
  });

  it('is missing when its page is not in the Space', () => {
    const paths = new Set(pages.map((p) => p.path));
    expect(missingTarget('Roadmap.md', 'Marketing/Launch%20plan.md', paths)).toBeNull();
    expect(missingTarget('Roadmap.md', 'Brief.md#x', paths)).toBe('Brief.md');
    expect(missingTarget('Roadmap.md', 'notes.txt', paths)).toBeNull();
    expect(missingTarget('Roadmap.md', 'https://x.md', paths)).toBeNull();
  });

  it('can be relinked to the one page with its name', () => {
    expect(relinkCandidate('Brief.md', pages)).toEqual({ name: 'Brief', path: 'Archive/Brief.md' });
    expect(relinkCandidate('Gone.md', pages)).toBeNull();
    expect(relinkCandidate('Notes.md', pages.slice(0, 3))).toBeNull();
    expect(relinkCandidate('New/Notes.md', pages)).toBeNull();
  });
});

describe('following a link', () => {
  it('goes to a heading here, the browser, or a page of the Space', () => {
    expect(followAction('Notes/Today.md', '#goals')).toEqual({ kind: 'anchor', anchor: '#goals' });
    expect(followAction('Notes/Today.md', 'https://example.com/a b')).toEqual({ kind: 'external', url: 'https://example.com/a b' });
    expect(followAction('Notes/Today.md', 'mailto:ana@example.com')).toEqual({ kind: 'external', url: 'mailto:ana@example.com' });
    expect(followAction('Notes/Today.md', '../Marketing/Launch%20plan.md#goals')).toEqual({ kind: 'page', path: 'Marketing/Launch plan.md', anchor: '#goals' });
    expect(followAction('Notes/Today.md', 'diagram.png')).toEqual({ kind: 'file', path: 'Notes/diagram.png' });
  });

  it('opens nothing for an address Bava does not open, or one leaving the Space', () => {
    expect(followAction('Notes/Today.md', 'javascript:alert(1)')).toBeNull();
    expect(followAction('Notes/Today.md', '../../outside.md')).toBeNull();
    expect(followAction('Notes/Today.md', '/etc/hosts')).toBeNull();
  });
});

describe('following a link from a page opened on its own', () => {
  it('reaches files beside it and in the folders around it', () => {
    expect(followBeside('../Plans/Launch%20plan.md#goals')).toEqual({ kind: 'page', path: '../Plans/Launch plan.md', anchor: '#goals' });
    expect(followBeside('notes.txt')).toEqual({ kind: 'file', path: 'notes.txt' });
    expect(followBeside('#goals')).toEqual({ kind: 'anchor', anchor: '#goals' });
    expect(followBeside('https://example.com')).toEqual({ kind: 'external', url: 'https://example.com' });
    expect(followBeside('javascript:x')).toBeNull();
  });

  it("joins a path to the page's folder, on any platform", () => {
    expect(joinFile('/Users/ana/Notes', '../Plans/Launch plan.md')).toBe('/Users/ana/Plans/Launch plan.md');
    expect(joinFile('/Users/ana/Notes', './a/b.md')).toBe('/Users/ana/Notes/a/b.md');
    expect(joinFile('C:\\Users\\ana\\Notes', '../Plans/x.md')).toBe('C:\\Users\\ana\\Plans\\x.md');
  });
});

let editor: DocEditor | null = null;

afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
});

function open(markdown: string, here: string | null = 'Roadmap.md') {
  const host = document.createElement('div');
  document.body.append(host);
  const options = { onChange: vi.fn(), onLinkCard: vi.fn(), onFollow: vi.fn(), onDateChip: vi.fn(), onCopy: vi.fn() };
  editor = new DocEditor();
  editor.mount(host, options);
  editor.setPage(markdown);
  editor.setSpacePages(here, pages);
  return { ...options, view: editor.view!, host };
}

/** The position inside the first run of text reading `text`. */
function at(text: string): number {
  let found = -1;
  editor!.view!.state.doc.descendants((node, pos) => {
    if (found < 0 && node.isText && node.text!.includes(text)) found = pos + node.text!.indexOf(text) + 1;
  });
  return found;
}

function click(pos: number, init: MouseEventInit = {}) {
  const view = editor!.view!;
  const event = new MouseEvent('click', { bubbles: true, cancelable: true, ...init });
  view.someProp('handleClick', (f) => f(view, pos, event));
  return event;
}

const card = (spy: ReturnType<typeof vi.fn>) => spy.mock.calls.at(-1)?.[0] ?? null;

describe('a click on a link', () => {
  it('shows its card, and places the caret as usual', () => {
    const { onLinkCard, onFollow } = open('See the [plan](Marketing/Launch%20plan.md).\n');
    click(at('plan'));
    expect(card(onLinkCard)).toMatchObject({ href: 'Marketing/Launch%20plan.md', missing: false, relink: null });
    expect(onFollow).not.toHaveBeenCalled();
  });

  it('with ⌘ or Ctrl, follows it at once', () => {
    const { onFollow, onLinkCard } = open('See [the web](https://example.com).\n');
    const event = click(at('web'), { metaKey: true });
    expect(onFollow).toHaveBeenCalledWith('https://example.com');
    expect(event.defaultPrevented).toBe(true);
    click(at('web'), { ctrlKey: true });
    expect(onFollow).toHaveBeenCalledTimes(2);
    expect(card(onLinkCard)).toBeNull();
  });

  it('closes its card when the caret leaves the link', () => {
    const { onLinkCard, view } = open('See the [plan](Roadmap.md) now.\n');
    click(at('plan'));
    expect(card(onLinkCard)).not.toBeNull();
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, at('now') + 2)));
    expect(card(onLinkCard)).toBeNull();
  });

  it('marks a link to a missing page, and relinks it to the page with its name', () => {
    const { onLinkCard, host } = open('Read the [Brief](Brief.md#scope).\n');
    expect(host.querySelector('.link-missing')?.textContent).toBe('Brief');
    click(at('Brief'));
    const shown = card(onLinkCard);
    expect(shown).toMatchObject({ missing: true, relink: { name: 'Brief', path: 'Archive/Brief.md' } });
    editor!.relink(shown.from, shown.to, 'Archive/Brief.md');
    expect(editor!.markdown()).toBe('Read the [Brief](Archive/Brief.md#scope).\n');
    expect(host.querySelector('.link-missing')).toBeNull();
  });

  it('marks nothing missing before the pages are read, or outside a Space', () => {
    const first = open('Read the [Brief](Brief.md).\n');
    editor!.setSpacePages('Roadmap.md', null);
    expect(first.host.querySelector('.link-missing')).toBeNull();
    editor!.destroy();
    const loose = open('Read the [Brief](Brief.md).\n', null);
    expect(loose.host.querySelector('.link-missing')).toBeNull();
  });

  it('is removed from the card, keeping its text', () => {
    const { onLinkCard } = open('See the [plan](Roadmap.md).\n');
    click(at('plan'));
    const shown = card(onLinkCard);
    editor!.removeLink(shown.from, shown.to);
    expect(editor!.markdown()).toBe('See the plan.\n');
  });
});

describe('links to headings', () => {
  it('copies a link from the Space top to a heading, which a paste in another page makes relative', () => {
    const { onCopy } = open('# Launch\n\n## Time line\n\nText.\n', 'Marketing/Launch plan.md');
    let heading = -1;
    editor!.view!.state.doc.descendants((node, pos) => {
      if (node.type.name === 'heading' && node.textContent === 'Time line') heading = pos;
    });
    editor!.copyHeadingLink(heading);
    const copied = onCopy.mock.calls.at(-1)![0] as string;
    expect(copied).toBe('[Time line](Marketing/Launch%20plan.md#time-line)');
    editor!.destroy();
    open('Paste:\n', 'Notes/Today.md');
    editor!.view!.dispatch(editor!.view!.state.tr.setSelection(atTextEnd(editor!.view!.state.doc)));
    editor!.paste(' ' + copied);
    expect(editor!.markdown()).toBe('Paste: [Time line](../Marketing/Launch%20plan.md#time-line)\n');
  });

  it('pastes a link to a heading on the same page as its anchor', () => {
    const { onCopy, view } = open('# Launch\n\n## Goals\n\nSee\n', 'Launch.md');
    let heading = -1;
    view.state.doc.descendants((node, pos) => {
      if (node.type.name === 'heading' && node.textContent === 'Goals') heading = pos;
    });
    editor!.copyHeadingLink(heading);
    view.dispatch(view.state.tr.setSelection(atTextEnd(view.state.doc)));
    editor!.paste(' ' + onCopy.mock.calls.at(-1)![0]);
    expect(editor!.markdown()).toBe('# Launch\n\n## Goals\n\nSee [Goals](#goals)\n');
  });

  it('goes to a heading by its anchor', () => {
    const { view } = open('# Launch\n\n## Goals\n\nText.\n\n## Time line\n\nMore.\n');
    expect(editor!.goToAnchor('#time-line')).toBe(true);
    expect(view.state.selection.$from.parent.textContent).toBe('Time line');
    expect(editor!.goToAnchor('#nothing')).toBe(false);
  });
});

describe('a date chip', () => {
  it('opens the calendar when clicked, and a new day replaces it as one step', () => {
    const { onDateChip, view } = open('Due <time datetime="2026-10-02">next Friday</time>.\n');
    let chip = -1;
    view.state.doc.descendants((node, pos) => {
      if (node.type.name === 'date') chip = pos;
    });
    const event = new MouseEvent('click', { bubbles: true });
    view.someProp('handleClickOn', (f) => f(view, chip + 1, view.state.doc.nodeAt(chip)!, chip, event, true));
    expect(onDateChip).toHaveBeenCalledWith(chip, expect.any(Object), '2026-10-02');
    editor!.setDate(chip, '2026-11-05');
    expect(editor!.markdown()).toBe('Due <time datetime="2026-11-05">5 Nov 2026</time>.\n');
    expect(view.state.selection).toBeInstanceOf(NodeSelection);
    editor!.undo();
    expect(editor!.markdown()).toBe('Due <time datetime="2026-10-02">next Friday</time>.\n');
  });
});

describe('the open page after a rename or move', () => {
  it('has its links rewritten as one edit, as the closed pages are', () => {
    const { onChange } = open('See [Launch plan](Marketing/Launch%20plan.md), [the plan](Marketing/Launch%20plan.md#goals) and `[Launch plan](Marketing/Launch%20plan.md)`.\n');
    editor!.followMoves('Roadmap.md', [{ from: 'Marketing/Launch plan.md', to: 'Marketing/Q4 launch.md' }]);
    expect(editor!.markdown()).toBe('See [Q4 launch](Marketing/Q4%20launch.md), [the plan](Marketing/Q4%20launch.md#goals) and `[Launch plan](Marketing/Launch%20plan.md)`.\n');
    expect(onChange).toHaveBeenCalled();
    editor!.undo();
    expect(editor!.markdown()).toBe('See [Launch plan](Marketing/Launch%20plan.md), [the plan](Marketing/Launch%20plan.md#goals) and `[Launch plan](Marketing/Launch%20plan.md)`.\n');
  });

  it('keeps its own links reaching the same pages when it moved itself', () => {
    open('Back to [Roadmap](../Roadmap.md), on to [Plan](Plan.md).\n', 'Marketing/Brief.md');
    editor!.followMoves('Marketing/Brief.md', [{ from: 'Marketing', to: 'Archive/Marketing' }]);
    expect(editor!.markdown()).toBe('Back to [Roadmap](../../Roadmap.md), on to [Plan](Plan.md).\n');
  });

  it('changes nothing, and marks nothing unsaved, when no link reaches what moved', () => {
    const { onChange } = open('See [Other](Other.md).\n');
    editor!.followMoves('Roadmap.md', [{ from: 'Plan.md', to: 'Q4.md' }]);
    expect(onChange).not.toHaveBeenCalled();
    expect(editor!.markdown()).toBe('See [Other](Other.md).\n');
  });
});

describe("the open page's images and videos after a rename or move", () => {
  it('follow an attachment renamed, address and poster, as one edit', () => {
    const page = '<!-- bava: poster="logo.png" -->\n![Demo](.bava/attachments/demo.mp4)\n\n![Logo](.bava/attachments/logo.png)\n';
    open(page, 'Page.md');
    editor!.followMoves('Page.md', [{ from: '.bava/attachments/logo.png', to: '.bava/attachments/brand.png' }]);
    expect(editor!.markdown()).toBe('<!-- bava: poster="brand.png" -->\n![Demo](.bava/attachments/demo.mp4)\n\n![Logo](.bava/attachments/brand.png)\n');
    editor!.undo();
    expect(editor!.markdown()).toBe(page);
  });

  it('keep reaching their files when the page moved', () => {
    open('![Logo](.bava/attachments/logo.png)\n', 'Page.md');
    editor!.followMoves('Page.md', [{ from: 'Page.md', to: 'Notes/Page.md' }]);
    expect(editor!.markdown()).toBe('![Logo](../.bava/attachments/logo.png)\n');
  });
});

describe('the open page and formatted link text', () => {
  it('keeps a link whose words are formatted as written, as the closed pages do', () => {
    const { view } = open('See [**Launch** plan](Launch%20plan.md).\n');
    editor!.followMoves('Roadmap.md', [{ from: 'Launch plan.md', to: 'Q4 launch.md' }]);
    expect(view.state.doc.textContent).toBe('See Launch plan.');
    const hrefs = new Set<string>();
    view.state.doc.descendants((node) => {
      for (const mark of node.marks) if (mark.type.name === 'link') hrefs.add(mark.attrs.href);
    });
    expect([...hrefs]).toEqual(['Q4%20launch.md']);
  });
});

describe('links and chips from the keyboard', () => {
  it('opens the calendar with Enter on a selected date chip', () => {
    const { onDateChip, view } = open('Due <time datetime="2026-10-02">2 Oct 2026</time>.\n');
    let chip = -1;
    view.state.doc.descendants((node, pos) => {
      if (node.type.name === 'date') chip = pos;
    });
    view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, chip)));
    view.someProp('handleKeyDown', (f) => f(view, new KeyboardEvent('keydown', { key: 'Enter' })));
    expect(onDateChip).toHaveBeenCalledWith(chip, expect.any(Object), '2026-10-02');
  });

  it('opens the card of the link at the caret with ⌥Enter, asking for focus in it', () => {
    const { onLinkCard, view } = open('See the [plan](Roadmap.md).\n');
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, at('plan') + 1)));
    view.someProp('handleKeyDown', (f) => f(view, new KeyboardEvent('keydown', { key: 'Enter', altKey: true })));
    expect(card(onLinkCard)).toMatchObject({ href: 'Roadmap.md', focus: true });
  });
});

describe('a heading link outside a Space', () => {
  it("escapes brackets in the heading's words", () => {
    const { onCopy, view } = open('# A [draft] plan\n', null);
    editor!.copyHeadingLink(0);
    expect(onCopy).toHaveBeenLastCalledWith('[A \\[draft\\] plan](#a-draft-plan)');
    void view;
  });
});
