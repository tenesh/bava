import { describe, expect, it, vi } from 'vitest';
import { createIconPicker, ICON_TABS } from './icon-picker.svelte';
import { GRID_COLUMNS } from './insert.svelte';
import type { BundledSet, IconEntry } from '../canvas/icons/sets';
import { ICON_RESULTS } from '../canvas/icons/search';

const entry = (set: IconEntry['set'], name: string, keywords: string[] = [], title = name): IconEntry => ({ set, name, title, keywords, body: '' });

const SETS: Record<BundledSet, IconEntry[]> = {
  line: ['api', 'cloud', 'database', 'database-export', 'server', 'shield-lock', 'table'].map((name) => entry('line', name)),
  solid: ['database', 'server'].map((name) => entry('solid', name)),
  logo: [entry('logo', 'postgresql', ['postgres'], 'PostgreSQL'), entry('logo', 'redis', [], 'Redis')],
};

function picker(over: { load?: (set: BundledSet) => Promise<IconEntry[]>; custom?: () => Promise<IconEntry[]> } = {}) {
  return createIconPicker({ load: over.load ?? (async (set) => SETS[set]), custom: over.custom ?? (async () => [entry('custom', 'acme-billing')]) });
}

const names = (p: ReturnType<typeof picker>) => p.results.map((icon) => `${icon.set}/${icon.name}`);

describe('the icon picker', () => {
  it('opens on General, the line icons each followed by their filled one', async () => {
    const p = picker();
    expect(p.tab).toBe('general');
    expect(p.status).toBe('loading');
    await vi.waitFor(() => expect(p.status).toBe('ready'));
    expect(names(p).slice(0, 5)).toEqual(['line/api', 'line/cloud', 'line/database', 'solid/database', 'line/database-export']);
  });

  it('searches the tab it is on, and keeps the words when the tab changes', async () => {
    const p = picker();
    await vi.waitFor(() => expect(p.status).toBe('ready'));
    p.setQuery('data');
    expect(names(p)).toEqual(['line/database', 'solid/database', 'line/database-export']);
    p.setTab('logos');
    expect(p.query).toBe('data');
    expect(ICON_TABS).toEqual(['general', 'logos', 'custom']);
    p.setQuery('postgres');
    await vi.waitFor(() => expect(names(p)).toEqual(['logo/postgresql']));
    p.setTab('custom');
    p.setQuery('');
    await vi.waitFor(() => expect(names(p)).toEqual(['custom/acme-billing']));
  });

  it('moves by a row with up and down, and along with left and right while nothing is typed', async () => {
    const p = picker();
    await vi.waitFor(() => expect(p.status).toBe('ready'));
    p.press('ArrowDown');
    expect(p.highlighted).toBe(GRID_COLUMNS);
    p.press('ArrowLeft');
    expect(p.highlighted).toBe(GRID_COLUMNS - 1);
    p.setQuery('s');
    p.press('ArrowRight');
    expect(p.highlighted).toBe(0);
  });

  it('places the highlighted icon on Enter, by its name', async () => {
    const p = picker();
    await vi.waitFor(() => expect(p.status).toBe('ready'));
    p.setQuery('data');
    p.highlight(1);
    expect(p.press('Enter')).toEqual({ type: 'icon', icon: 'solid/database' });
    expect(p.choose(0)).toEqual({ type: 'icon', icon: 'line/database' });
  });

  it('clears the words with Escape, then goes up; Backspace with nothing typed goes up', async () => {
    const p = picker();
    p.setQuery('data');
    expect(p.press('Escape')).toEqual({ type: 'none' });
    expect(p.query).toBe('');
    expect(p.press('Escape')).toEqual({ type: 'up' });
    expect(p.press('Backspace')).toEqual({ type: 'up' });
  });

  it('starts afresh when reset: General, nothing typed, the first page', async () => {
    const p = picker();
    p.setTab('logos');
    p.setQuery('red');
    p.more();
    p.reset();
    expect([p.tab, p.query, p.highlighted]).toEqual(['general', '', 0]);
    await vi.waitFor(() => expect(p.status).toBe('ready'));
    expect(p.results.length).toBeLessThanOrEqual(ICON_RESULTS);
  });

  // The library is a folder anyone can drop files into: it is read again each time Custom opens.
  it('reads the custom library each time its tab opens', async () => {
    let library = [entry('custom', 'acme')];
    const p = picker({ custom: async () => library });
    p.setTab('custom');
    await vi.waitFor(() => expect(names(p)).toEqual(['custom/acme']));
    library = [entry('custom', 'acme'), entry('custom', 'billing')];
    p.setTab('general');
    p.setTab('custom');
    await vi.waitFor(() => expect(names(p)).toEqual(['custom/acme', 'custom/billing']));
  });

  it('shows a page at a time, and more when asked', async () => {
    const many = Array.from({ length: 300 }, (_, n) => entry('line', `box-${String(n).padStart(3, '0')}`));
    const p = picker({ load: async (set) => (set === 'line' ? many : []) });
    await vi.waitFor(() => expect(p.status).toBe('ready'));
    expect(p.results).toHaveLength(ICON_RESULTS);
    p.more();
    expect(p.results).toHaveLength(ICON_RESULTS * 2);
  });

  it('says so when a set cannot load, and tries again when its tab is opened again', async () => {
    let fail = true;
    const p = picker({ load: async (set) => (set === 'logo' && fail ? Promise.reject(new Error('gone')) : SETS[set]) });
    p.setTab('logos');
    await vi.waitFor(() => expect(p.status).toBe('failed'));
    fail = false;
    p.setTab('general');
    p.setTab('logos');
    await vi.waitFor(() => expect(p.status).toBe('ready'));
  });
});
