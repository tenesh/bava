import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const COMPONENTS = resolve(here, '../../src/components');
const DEMOS = resolve(here, 'gallery/demos');
const SPEC = resolve(here, '../visual/components.spec.ts');
const REFERENCES = resolve(here, '../../../testdata/visual/components');

/**
 * Components the gallery does not show, each with why it cannot be shown on
 * its own. Every other component has a demo and pictures.
 */
const NOT_SHOWN: Record<string, string> = {
  Portal: 'draws nothing of its own: the pictures of what it holds (FormatBubble, LinkField, SlashMenu) show it',
};

const svelteNames = (dir: string) =>
  readdirSync(dir)
    .filter((file) => file.endsWith('.svelte'))
    .map((file) => file.replace(/\.svelte$/, ''))
    .sort();

const components = svelteNames(COMPONENTS).filter((name) => !(name in NOT_SHOWN));

/** A component's name as its pictures are named: `MediaDialog` is `media-dialog`. */
const kebab = (name: string) => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

/** Source with its comments taken out, so a call commented out pictures nothing. */
const withoutComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

/** The states a component's references are taken in, read from the file names on disk, per theme. */
function referenceStates(name: string, theme: 'light' | 'dark'): string[] {
  const prefix = `${kebab(name)}--`;
  const suffix = `--${theme}.png`;
  return readdirSync(REFERENCES)
    .filter((file) => file.startsWith(prefix) && file.endsWith(suffix))
    .map((file) => file.slice(prefix.length, -suffix.length))
    .sort();
}

describe('the component gallery', () => {
  it('has a demo for every component', () => {
    const demos = new Set(svelteNames(DEMOS));
    expect(components.filter((name) => !demos.has(name))).toEqual([]);
  });

  it('pictures every component', () => {
    const spec = withoutComments(readFileSync(SPEC, 'utf8'));
    expect(components.filter((name) => !spec.includes(`openGallery(page, '${name}'`))).toEqual([]);
  });

  it('counts a commented-out call as no picture', () => {
    const source = "// await openGallery(page, 'Toggle', theme);\n/* await openGallery(page, 'Mark', theme); */\nawait openGallery(page, 'Icon', theme); // 'Splash'\n";
    expect(withoutComments(source)).toBe("\n\nawait openGallery(page, 'Icon', theme); \n");
  });

  it('has a reference for every component, in both themes', () => {
    expect(components.filter((name) => referenceStates(name, 'light').length === 0)).toEqual([]);
    const lightOnly = components.flatMap((name) =>
      referenceStates(name, 'light')
        .filter((state) => !existsSync(resolve(REFERENCES, `${kebab(name)}--${state}--dark.png`)))
        .map((state) => `${name} ${state}`),
    );
    const darkOnly = components.flatMap((name) =>
      referenceStates(name, 'dark')
        .filter((state) => !existsSync(resolve(REFERENCES, `${kebab(name)}--${state}--light.png`)))
        .map((state) => `${name} ${state}`),
    );
    expect([...lightOnly, ...darkOnly]).toEqual([]);
  });

  it('has no demo for a component that is gone', () => {
    const all = new Set(svelteNames(COMPONENTS));
    expect(svelteNames(DEMOS).filter((name) => !all.has(name))).toEqual([]);
  });

  it('leaves out only components that exist', () => {
    const all = new Set(svelteNames(COMPONENTS));
    expect(Object.keys(NOT_SHOWN).filter((name) => !all.has(name))).toEqual([]);
  });
});
