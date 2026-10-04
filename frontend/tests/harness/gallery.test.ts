import { readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { IN_SCREENS, SHEETS } from './gallery/sheets';

const here = dirname(fileURLToPath(import.meta.url));
const COMPONENTS = resolve(here, '../../src/components');
const DEMOS = resolve(here, 'gallery/demos');
const SPEC = resolve(here, '../visual/components.spec.ts');
const SPECS = [resolve(here, '../visual'), resolve(here, '../integration')];

/**
 * Components the gallery does not show, each with why it cannot be shown on
 * its own. Every other component is on a sheet or in a screen.
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
const onSheets: string[] = Object.values(SHEETS).flat();

/** Source with its comments taken out, so a call commented out pictures nothing. */
const withoutComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

// A component is pictured once: on its family's sheet, or in the screen that
// shows it. New ones join a sheet; nothing is pictured state by state.
describe('the component gallery', () => {
  it('puts every component on a sheet or in a screen', () => {
    expect(components.filter((name) => !onSheets.includes(name) && !(name in IN_SCREENS))).toEqual([]);
  });

  it('puts no component in two places', () => {
    const twice = [...onSheets, ...Object.keys(IN_SCREENS)].filter((name, index, all) => all.indexOf(name) !== index);
    expect(twice).toEqual([]);
  });

  it('has a demo for every component on a sheet', () => {
    const demos = new Set(svelteNames(DEMOS));
    expect(onSheets.filter((name) => !demos.has(name))).toEqual([]);
  });

  it('pictures every sheet', () => {
    const spec = withoutComments(readFileSync(SPEC, 'utf8'));
    expect(Object.keys(SHEETS).filter((name) => !spec.includes(`sheet(page, '${name}'`))).toEqual([]);
  });

  it('keeps a demo only for a component on a sheet, or one a spec opens alone', () => {
    const specs = SPECS.flatMap((dir) => readdirSync(dir).map((file) => withoutComments(readFileSync(resolve(dir, file), 'utf8')))).join('\n');
    const opened = new Set([...specs.matchAll(/openGallery\(page, '([A-Za-z]+)'/g)].map((match) => match[1]));
    expect(svelteNames(DEMOS).filter((name) => !onSheets.includes(name) && !opened.has(name))).toEqual([]);
  });

  it('counts a commented-out call as no picture', () => {
    const source = "// await sheet(page, 'controls', theme);\n/* await sheet(page, 'menus', theme); */\nawait sheet(page, 'fields', theme); // 'feedback'\n";
    expect(withoutComments(source)).toBe("\n\nawait sheet(page, 'fields', theme); \n");
  });

  it('names only components that exist', () => {
    const all = new Set(svelteNames(COMPONENTS));
    const named = [...onSheets, ...Object.keys(IN_SCREENS), ...Object.keys(NOT_SHOWN), ...svelteNames(DEMOS)];
    expect(named.filter((name) => !all.has(name))).toEqual([]);
  });
});
