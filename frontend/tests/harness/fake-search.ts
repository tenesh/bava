/**
 * Search over the stand-in's Space, answering as Go's `Space.Search` does
 * (`internal/space/search.go`): every word, at the start of a word, capitals
 * ignored, over names, the Document's plain lines and the Canvas's texts;
 * names first (folders before pages), then by count, then the tree's order;
 * at most 50.
 */
import type { FakeSpace } from '../fixtures/space';

type Element = { id?: string; type?: string; label?: string; text?: string; code?: string };
type Match = { where: 'name' | 'document' | 'canvas'; text: string; word: string; occurrence: number; element: string };
export type FakeHit = { kind: 'page' | 'folder'; path: string; name: string; folder: string; count: number; best: Match };
export type FakeOpenPage = { path: string; source: string; scene: { elements?: Element[] } } | null;

const MAX = 50;
const SNIPPET = 80;

const isWordChar = (c: string) => /[\p{L}\p{N}]/u.test(c);

function wordAt(text: string, word: string, from = 0): number {
  for (let at = from; at <= text.length; ) {
    const i = text.indexOf(word, at);
    if (i < 0) return -1;
    if (i === 0 || !isWordChar(text[i - 1])) return i;
    at = i + 1;
  }
  return -1;
}

const holdsAll = (text: string, words: string[]) => words.every((w) => wordAt(text.toLowerCase(), w) >= 0);

function countAll(text: string, words: string[]): number {
  const lower = text.toLowerCase();
  let n = 0;
  for (const w of words) for (let at = wordAt(lower, w); at >= 0; at = wordAt(lower, w, at + w.length)) n += 1;
  return n;
}

function plainLines(prose: string): string[] {
  const body = prose.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '').replace(/<!--[\s\S]*?-->/g, '');
  const out: string[] = [];
  for (const raw of body.split('\n')) {
    let line = raw.trim();
    if (/^(```|~~~)/.test(line) || /^\|?[\s:|-]+\|?$/.test(line)) continue;
    for (let next = line.replace(/^(?:#{1,6}\s+|>\s?|[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+[.)]\s+|[a-zA-Z][.)]\s+)/, ''); next !== line; ) {
      line = next;
      next = line.replace(/^(?:#{1,6}\s+|>\s?|[-*+]\s+\[[ xX]\]\s+|[-*+]\s+|\d+[.)]\s+|[a-zA-Z][.)]\s+)/, '');
    }
    line = line
      .replace(/^\[![A-Za-z]+\]\s*/, '')
      .replace(/<\/?[A-Za-z][^>]*>/g, '')
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/\[\^[^\]]*\]:?/g, '')
      .replace(/\*\*|__|~~|`|\*|\$\$|\$/g, '');
    line = line.replaceAll('|', ' ').split(/\s+/).filter(Boolean).join(' ');
    if (line) out.push(line);
  }
  return out;
}

function best(lines: string[], words: string[]): number {
  let found = -1;
  let most = 0;
  lines.forEach((line, i) => {
    const n = words.filter((w) => wordAt(line.toLowerCase(), w) >= 0).length;
    if (n > most) [found, most] = [i, n];
  });
  return found;
}

function firstWord(line: string, words: string[]): [string, number] {
  const lower = line.toLowerCase();
  let word = '';
  let at = -1;
  for (const w of words) {
    const i = wordAt(lower, w);
    if (i >= 0 && (at < 0 || i < at)) [word, at] = [w, i];
  }
  return [word, at];
}

function cut(line: string, at: number): string {
  const chars = [...line];
  if (chars.length <= SNIPPET) return line;
  const index = [...line.slice(0, at)].length;
  const end = Math.min(chars.length, Math.max(0, index - Math.floor(SNIPPET / 3)) + SNIPPET);
  const start = Math.max(0, end - SNIPPET);
  return `${start > 0 ? '…' : ''}${chars.slice(start, end).join('').trim()}${end < chars.length ? '…' : ''}`;
}

const parent = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');
const base = (path: string) => path.slice(path.lastIndexOf('/') + 1);

export function fakeSearch(space: FakeSpace, query: string, open: FakeOpenPage): { hits: FakeHit[]; more: boolean } {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return { hits: [], more: false };
  type Ranked = FakeHit & { byName: boolean; order: number };
  const hits: Ranked[] = [];
  let order = 0;
  const walk = (folder: string) => {
    for (const entry of space.folders[folder] ?? []) {
      const path = folder ? `${folder}/${entry}` : entry;
      order += 1;
      if (path in space.folders) {
        if (holdsAll(entry, words)) hits.push({ kind: 'folder', path, name: entry, folder: parent(path), count: countAll(entry, words), best: { where: 'name', text: '', word: '', occurrence: 0, element: '' }, byName: true, order });
        walk(path);
        continue;
      }
      const page = open?.path === path ? { source: open.source, scene: open.scene } : space.pages[path];
      if (!page) continue;
      const name = base(path).replace(/\.md$/i, '');
      const lines = plainLines(page.source);
      const texts = ((page.scene?.elements ?? []) as Element[])
        .filter((e) => e.type !== 'line' && e.type !== 'stroke')
        .map((e) => ({ id: e.id ?? '', text: [e.label, e.text, e.code].filter(Boolean).join(' ').split(/\s+/).filter(Boolean).join(' ') }))
        .filter((e) => e.text);
      const all = [name, ...lines, ...texts.map((e) => e.text)].join('\n');
      if (!holdsAll(all, words)) continue;
      const hit: Ranked = { kind: 'page', path, name, folder: parent(path), count: countAll(all, words), best: { where: 'name', text: '', word: '', occurrence: 0, element: '' }, byName: holdsAll(name, words), order };
      const line = best(lines, words);
      if (line >= 0) {
        const [word, at] = firstWord(lines[line], words);
        const before = lines.slice(0, line).join('\n').length + (line > 0 ? 1 : 0);
        const document = lines.join('\n').toLowerCase().slice(0, before + at);
        hit.best = { where: 'document', text: cut(lines[line], at), word, occurrence: document.split(word).length - 1, element: '' };
      } else {
        const element = best(texts.map((e) => e.text), words);
        if (element >= 0) {
          const [word, at] = firstWord(texts[element].text, words);
          hit.best = { where: 'canvas', text: cut(texts[element].text, at), word, occurrence: 0, element: texts[element].id };
        }
      }
      hits.push(hit);
    }
  };
  walk('');
  hits.sort((a, b) => {
    if (a.byName !== b.byName) return a.byName ? -1 : 1;
    if (a.byName) return a.kind !== b.kind ? (a.kind === 'folder' ? -1 : 1) : a.order - b.order;
    return b.count - a.count || a.order - b.order;
  });
  const shown = hits.slice(0, MAX).map(({ byName: _byName, order: _order, ...hit }) => hit);
  return { hits: shown, more: hits.length > MAX };
}
