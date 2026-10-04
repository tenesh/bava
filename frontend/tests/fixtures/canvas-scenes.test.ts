import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ELEMENT_TYPES } from '../../src/canvas/scene';
import { AT_200, ELEMENT_KINDS, ELEMENT_STATES, FAMILIES, LEFT_OUT, pictured, type ElementState, type Family, type Kind } from './canvas-scenes';

const here = dirname(fileURLToPath(import.meta.url));
const REFERENCES = resolve(here, '../../../testdata/visual/canvas-elements');

/** Every element type a scene can hold. */
const sceneTypes = (): string[] => [...ELEMENT_TYPES].sort();

/**
 * How the walk names its pictures: a state that is the scene's is pictured
 * once per family (`<family>--<state>`), a state that is one element's once
 * per kind (`<kind>--<state>`); turned and detached are both. A state is
 * pictured only where `pictured` gives it kinds.
 */
const BY_FAMILY: readonly ElementState[] = ['rest', 'locked', 'turned', 'long', 'erasing', 'detached'];
const BY_KIND: readonly ElementState[] = ['selected', 'handle', 'turned', 'editing', 'detached'];

/** Every reference the walk takes, by the names above, plus the ones at about 200% and the locked menu. */
function references(): string[] {
  const families = Object.entries(FAMILIES) as [Family, readonly Kind[]][];
  return [
    ...BY_FAMILY.flatMap((state) => families.filter(([, members]) => pictured(state, members).length > 0).map(([family]) => `${family}--${state}`)),
    ...BY_KIND.flatMap((state) => pictured(state).map((kind) => `${kind}--${state}`)),
    ...Object.entries(AT_200).flatMap(([state, at]) => at.map((kind) => `${kind}--${state}-200`)),
    'locked--menu',
  ];
}

/** Whether a reference is on disk in both themes. */
const inBothThemes = (name: string) => ['light', 'dark'].every((theme) => existsSync(resolve(REFERENCES, `${name}--${theme}.png`)));

const kinds = Object.keys(ELEMENT_KINDS) as Kind[];
const typeOf = (kind: Kind): string => ELEMENT_KINDS[kind];

describe('the canvas element pictures', () => {
  it('read the element types from the scene', () => {
    // A guard that read nothing would pass every check below.
    expect(sceneTypes()).toEqual(expect.arrayContaining(['rect', 'cloud', 'line', 'arrow', 'stroke', 'text', 'code', 'frame', 'group']));
  });

  it('have a kind for every element type', () => {
    const covered = new Set(kinds.map(typeOf));
    expect(sceneTypes().filter((type) => !covered.has(type))).toEqual([]);
  });

  it('have no kind of a type that is gone', () => {
    const types = new Set(sceneTypes());
    expect(kinds.filter((kind) => !types.has(typeOf(kind)))).toEqual([]);
  });

  it('picture every kind in a family', () => {
    const inFamilies = new Set<string>(Object.values(FAMILIES).flat());
    expect(kinds.filter((kind) => !inFamilies.has(kind))).toEqual([]);
  });

  it('picture every element type in every state, or say why not', () => {
    const missing = ELEMENT_STATES.flatMap((state) => {
      const shown = new Set(pictured(state).map(typeOf));
      return sceneTypes()
        .filter((type) => !shown.has(type) && !(type in LEFT_OUT[state]) && !kinds.some((kind) => typeOf(kind) === type && kind in LEFT_OUT[state]))
        .map((type) => `${type} ${state}`);
    });
    expect(missing).toEqual([]);
  });

  it('leave out only kinds and types that exist', () => {
    const names = new Set<string>([...kinds, ...sceneTypes()]);
    const unknown = ELEMENT_STATES.flatMap((state) => Object.keys(LEFT_OUT[state]).filter((name) => !names.has(name)));
    expect(unknown).toEqual([]);
  });

  it('name every state by family or by kind', () => {
    const named = new Set([...BY_FAMILY, ...BY_KIND]);
    expect(ELEMENT_STATES.filter((state) => !named.has(state))).toEqual([]);
  });

  it('have a reference for every picture, in both themes', () => {
    expect(references().filter((reference) => !inBothThemes(reference))).toEqual([]);
  });
});
