// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DocEditor } from './editor';
import { rankPages, typedDates } from './mention';
import { atTextEnd } from './test-caret';

const pages = [
  { name: 'Launch plan', path: 'Marketing/Launch plan.md' },
  { name: 'Roadmap', path: 'Roadmap.md' },
  { name: 'Q4 launch notes', path: 'Notes/Q4 launch notes.md' },
  { name: 'Budget', path: 'Launches/Budget.md' },
  { name: 'Today', path: 'Notes/Today.md' },
];

describe('dates typed after @', () => {
  const today = '2026-09-28';
  const days = (query: string) => typedDates(query, today).map((d) => d.date);

  it('offers today and tomorrow before anything is typed', () => {
    expect(typedDates('', today)).toEqual([
      { date: '2026-09-28', word: 'today' },
      { date: '2026-09-29', word: 'tomorrow' },
    ]);
    expect(days('tom')).toEqual(['2026-09-29']);
    expect(days('TODAY')).toEqual(['2026-09-28']);
    expect(days('yesterday')).toEqual(['2026-09-27']);
  });

  it('reads a day written out', () => {
    expect(days('2026-10-02')).toEqual(['2026-10-02']);
    expect(days('2 Oct')).toEqual(['2026-10-02']);
    expect(days('Oct 2')).toEqual(['2026-10-02']);
    expect(days('2 october 2027')).toEqual(['2027-10-02']);
    expect(days('Oct 2, 2027')).toEqual(['2027-10-02']);
    expect(days('31 Dec 2026')).toEqual(['2026-12-31']);
  });

  it('offers no day for words that are not one', () => {
    expect(days('31 Feb')).toEqual([]);
    expect(days('2026-13-01')).toEqual([]);
    expect(days('launch')).toEqual([]);
    expect(days('2')).toEqual([]);
  });
});

describe('pages after @', () => {
  const found = (query: string, here: string | null = 'Notes/Today.md') => rankPages(pages, query, here).map((p) => p.name);

  it('puts names starting with what was typed first, then a word starting with it, then its folder', () => {
    expect(found('lau')).toEqual(['Launch plan', 'Q4 launch notes', 'Budget']);
    expect(found('ROAD')).toEqual(['Roadmap']);
  });

  it('never offers the page itself, and lists the first pages before anything is typed', () => {
    expect(found('today')).toEqual([]);
    expect(found('')).toEqual(['Launch plan', 'Roadmap', 'Q4 launch notes', 'Budget']);
  });
});

let editor: DocEditor | null = null;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 28, 10, 0));
});

afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = '';
  vi.useRealTimers();
});

function open(markdown: string, here: string | null = 'Notes/Today.md') {
  const host = document.createElement('div');
  document.body.append(host);
  const onMention = vi.fn();
  const onMentionPages = vi.fn();
  editor = new DocEditor();
  editor.mount(host, { onChange: vi.fn(), onMention, onMentionPages });
  editor.setPage(markdown);
  editor.setSpacePages(here, null);
  const view = editor.view!;
  view.dispatch(view.state.tr.setSelection(atTextEnd(view.state.doc)));
  return { onMention, onMentionPages, view };
}

function type(text: string) {
  const view = editor!.view!;
  for (const char of text) {
    const { from, to } = view.state.selection;
    const handled = view.someProp('handleTextInput', (f) => f(view, from, to, char, () => view.state.tr.insertText(char, from, to)));
    if (!handled) view.dispatch(view.state.tr.insertText(char, from, to));
  }
}

function key(name: string) {
  const view = editor!.view!;
  return view.someProp('handleKeyDown', (f) => f(view, new KeyboardEvent('keydown', { key: name, bubbles: true })));
}

const shown = (onMention: ReturnType<typeof vi.fn>) => onMention.mock.calls.at(-1)?.[0] ?? null;

describe('the @ menu in the page', () => {
  it('opens with today and tomorrow, and asks for the pages', () => {
    const { onMention, onMentionPages } = open('Hello');
    type(' @');
    expect(shown(onMention).items.map((i: { kind: string }) => i.kind)).toEqual(['date', 'date']);
    expect(onMentionPages).toHaveBeenCalledTimes(1);
  });

  it('lists pages once they arrive, and puts in a link relative to this page', () => {
    const { onMention, view } = open('See');
    type(' @');
    editor!.setSpacePages('Notes/Today.md', pages);
    type('Launch pl');
    expect(shown(onMention).items[0]).toMatchObject({ kind: 'page', path: 'Marketing/Launch plan.md' });
    key('Enter');
    expect(shown(onMention)).toBeNull();
    expect(editor!.markdown()).toBe('See [Launch plan](../Marketing/Launch%20plan.md)\n');
    type(' next');
    expect(editor!.markdown()).toBe('See [Launch plan](../Marketing/Launch%20plan.md) next\n');
    expect(view.state.doc.textContent).toBe('See Launch plan next');
  });

  it('opens after [[ too, and puts a date chip in', () => {
    const { onMention } = open('Due');
    type(' [[tomor');
    expect(shown(onMention).items).toEqual([{ kind: 'date', date: '2026-09-29', word: 'tomorrow' }]);
    key('Enter');
    expect(editor!.markdown()).toBe('Due <time datetime="2026-09-29">29 Sep 2026</time>\n');
  });

  it('offers only dates outside a Space', () => {
    const { onMention, onMentionPages } = open('On', null);
    type(' @');
    expect(onMentionPages).not.toHaveBeenCalled();
    expect(shown(onMention).items).toHaveLength(2);
  });

  it('stays shut inside a word, in code, and after Escape', () => {
    const { onMention } = open('mail');
    type(' ana@b');
    expect(shown(onMention)).toBeNull();
    type(' @');
    expect(shown(onMention)).not.toBeNull();
    key('Escape');
    expect(shown(onMention)).toBeNull();
    type('t');
    expect(shown(onMention)).toBeNull();
    editor!.destroy();
    const again = open('```\ncode\n```\n');
    type('@');
    expect(shown(again.onMention)).toBeNull();
  });
});
