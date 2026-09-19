import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { LANGUAGES, loadParser, resetLanguageCache } from './languages';

describe('the languages a code block offers', () => {
  it('lists the set that was agreed', () => {
    expect(LANGUAGES.map((language) => language.name)).toEqual([
      'javascript',
      'typescript',
      'python',
      'go',
      'rust',
      'json',
      'yaml',
      'sql',
      'shell',
      'html',
      'css',
      'markdown',
    ]);
  });

  it('gives every language a name to show', () => {
    for (const language of LANGUAGES) expect(language.label.length).toBeGreaterThan(0);
  });
});

describe('loading a language', () => {
  // Asking for one language must not load the other eleven: that is the whole
  // point of loading them one at a time.
  it('loads only the language that was asked for', async () => {
    resetLanguageCache();
    const wanted = vi.fn(async () => (await import('@codemirror/lang-json')).json().language.parser);
    const other = vi.fn();
    await loadParser('json', [
      { name: 'json', label: 'JSON', load: wanted },
      { name: 'python', label: 'Python', load: other },
    ]);
    expect(wanted).toHaveBeenCalledTimes(1);
    expect(other).not.toHaveBeenCalled();
  });

  it('loads a language once, however often it is asked for', async () => {
    resetLanguageCache();
    const load = vi.fn(async () => (await import('@codemirror/lang-json')).json().language.parser);
    const registry = [{ name: 'json', label: 'JSON', load }];
    const first = await loadParser('json', registry);
    const second = await loadParser('json', registry);
    expect(load).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  // A file may name a language this build does not bundle. It is kept and
  // drawn plain (docs/file-format.md), which is what a null parser means.
  it('is null for a language it does not have, and for none at all', async () => {
    expect(await loadParser('a-language-from-later')).toBeNull();
    expect(await loadParser(undefined)).toBeNull();
  });

  it('really parses, for a language it does have', async () => {
    resetLanguageCache();
    const parser = await loadParser('json');
    expect(parser).not.toBeNull();
    expect(parser!.parse('{"a": 1}').length).toBe(8);
  });
});

// No network, ever (CLAUDE.md). Language support is bundled and loaded from
// the app's own files; a URL here would be a fetch at runtime.
describe('where language support comes from', () => {
  it('imports bare package names, never a URL', () => {
    const source = readFileSync(new URL('./languages.ts', import.meta.url), 'utf8');
    const specifiers = [...source.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)].map((match) => match[1]);
    expect(specifiers.length).toBeGreaterThan(0);
    for (const specifier of specifiers) {
      expect(specifier).not.toMatch(/^[a-z]+:\/\//i);
      expect(specifier.startsWith('@codemirror/')).toBe(true);
    }
  });
});
