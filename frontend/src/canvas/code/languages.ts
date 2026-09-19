/**
 * The languages a code block can be highlighted as, and how each one is
 * loaded.
 *
 * Every language's support is a separate package, and loading them all at
 * startup would make the app slower for everyone to give most people nothing.
 * Each is `import()`ed the first time someone picks it, which the bundler
 * turns into a chunk of the app's own files: nothing is fetched from a
 * network, here or ever (`CLAUDE.md`, non-negotiable 1).
 *
 * What a language gives us is its Lezer parser. The colouring that follows is
 * CodeMirror's own (`highlight.ts`), not a second set of rules.
 */
import type { Parser } from '@lezer/common';
import type { Extension } from '@codemirror/state';

export type LanguageEntry = {
  /** Stored in the file, as `language`. */
  name: string;
  /** Shown in the toolbar. Not a message key: these are proper nouns. */
  label: string;
  load: () => Promise<Parser>;
  /** The same language as a CodeMirror extension, for the editor. */
  support?: () => Promise<Extension>;
};

/**
 * The set agreed on 2026-09-19. A language that is not here is still kept in
 * the file and drawn as plain text.
 */
export const LANGUAGES: LanguageEntry[] = [
  {
    name: 'javascript',
    label: 'JavaScript',
    load: async () => (await import('@codemirror/lang-javascript')).javascript().language.parser,
    support: async () => (await import('@codemirror/lang-javascript')).javascript(),
  },
  {
    name: 'typescript',
    label: 'TypeScript',
    load: async () =>
      (await import('@codemirror/lang-javascript')).javascript({ typescript: true }).language.parser,
    support: async () => (await import('@codemirror/lang-javascript')).javascript({ typescript: true }),
  },
  { name: 'python', label: 'Python', load: async () => (await import('@codemirror/lang-python')).python().language.parser, support: async () => (await import('@codemirror/lang-python')).python() },
  { name: 'go', label: 'Go', load: async () => (await import('@codemirror/lang-go')).go().language.parser, support: async () => (await import('@codemirror/lang-go')).go() },
  { name: 'rust', label: 'Rust', load: async () => (await import('@codemirror/lang-rust')).rust().language.parser, support: async () => (await import('@codemirror/lang-rust')).rust() },
  { name: 'json', label: 'JSON', load: async () => (await import('@codemirror/lang-json')).json().language.parser, support: async () => (await import('@codemirror/lang-json')).json() },
  { name: 'yaml', label: 'YAML', load: async () => (await import('@codemirror/lang-yaml')).yaml().language.parser, support: async () => (await import('@codemirror/lang-yaml')).yaml() },
  { name: 'sql', label: 'SQL', load: async () => (await import('@codemirror/lang-sql')).sql().language.parser, support: async () => (await import('@codemirror/lang-sql')).sql() },
  {
    name: 'shell',
    label: 'Shell',
    load: async () => {
      // Shell has no Lezer grammar; CodeMirror ships it as a stream mode,
      // which `StreamLanguage` wraps into a parser like any other.
      const { StreamLanguage } = await import('@codemirror/language');
      const { shell } = await import('@codemirror/legacy-modes/mode/shell');
      return StreamLanguage.define(shell).parser;
    },
    support: async () => {
      const { StreamLanguage } = await import('@codemirror/language');
      const { shell } = await import('@codemirror/legacy-modes/mode/shell');
      return StreamLanguage.define(shell);
    },
  },
  { name: 'html', label: 'HTML', load: async () => (await import('@codemirror/lang-html')).html().language.parser, support: async () => (await import('@codemirror/lang-html')).html() },
  { name: 'css', label: 'CSS', load: async () => (await import('@codemirror/lang-css')).css().language.parser, support: async () => (await import('@codemirror/lang-css')).css() },
  {
    name: 'markdown',
    label: 'Markdown',
    load: async () => (await import('@codemirror/lang-markdown')).markdown().language.parser,
    support: async () => (await import('@codemirror/lang-markdown')).markdown(),
  },
];

/** Loaded parsers, so picking a language twice loads it once. */
const loaded = new Map<string, Promise<Parser>>();
/** The same, for the editor's own support extension. */
const loadedSupport = new Map<string, Promise<Extension>>();

/** For tests: forget what has been loaded. */
export function resetLanguageCache(): void {
  loaded.clear();
  loadedSupport.clear();
}

/**
 * The parser for a language name, or null for plain text and for a language
 * this build does not bundle. A null parser is not an error: the file names a
 * language Bava cannot colour, and the code is drawn plain.
 */
export async function loadParser(
  name: string | undefined,
  registry: LanguageEntry[] = LANGUAGES,
): Promise<Parser | null> {
  if (!name) return null;
  const entry = registry.find((language) => language.name === name);
  if (!entry) return null;

  const existing = loaded.get(name);
  if (existing) return existing;
  const loading = entry.load();
  loaded.set(name, loading);
  try {
    return await loading;
  } catch {
    // A chunk that will not load must not wedge the language: the block draws
    // plain, and picking it again tries once more.
    loaded.delete(name);
    return null;
  }
}

/**
 * A language as a CodeMirror extension, for the editor that opens over a
 * block. Null for plain text and for a language this build does not bundle,
 * which the editor treats as no language rather than an error.
 */
export async function loadLanguageSupport(
  name: string | undefined,
  registry: LanguageEntry[] = LANGUAGES,
): Promise<Extension | null> {
  if (!name) return null;
  const entry = registry.find((language) => language.name === name);
  if (!entry?.support) return null;

  const existing = loadedSupport.get(name);
  if (existing) return existing;
  const loading = entry.support();
  loadedSupport.set(name, loading);
  try {
    return await loading;
  } catch {
    loadedSupport.delete(name);
    return null;
  }
}
