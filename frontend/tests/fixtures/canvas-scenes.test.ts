import { describe, expect, it } from 'vitest';
import { ELEMENT_TYPES } from '../../src/canvas/scene';
import { ELEMENT_KINDS, ELEMENT_STATES, FAMILIES, LEFT_OUT, SCENES } from './canvas-scenes';

/** Every element type a scene can hold. */
const sceneTypes = (): string[] => [...ELEMENT_TYPES].sort();

const kinds = Object.keys(ELEMENT_KINDS) as (keyof typeof ELEMENT_KINDS)[];

// Each element type is drawn in a pictured scene; its states are pictured
// once per kind of chrome (visual/canvas.spec.ts), not type by type.
describe('the canvas scenes', () => {
  it('read the element types from the scene', () => {
    // A guard that read nothing would pass every check below.
    expect(sceneTypes()).toEqual(expect.arrayContaining(['rect', 'cloud', 'line', 'arrow', 'stroke', 'text', 'code', 'frame', 'group']));
  });

  it('draw every element type in a pictured scene', () => {
    const drawn = new Set(Object.values(SCENES).flatMap((scene) => scene().map((element) => element.type)));
    expect(sceneTypes().filter((type) => !drawn.has(type))).toEqual([]);
  });

  it('have a kind for every element type, and none of a type that is gone', () => {
    const covered = new Set<string>(kinds.map((kind) => ELEMENT_KINDS[kind]));
    const types = new Set(sceneTypes());
    expect(sceneTypes().filter((type) => !covered.has(type))).toEqual([]);
    expect(kinds.filter((kind) => !types.has(ELEMENT_KINDS[kind]))).toEqual([]);
  });

  it('put every kind in a family', () => {
    const inFamilies = new Set<string>(Object.values(FAMILIES).flat());
    expect(kinds.filter((kind) => !inFamilies.has(kind))).toEqual([]);
  });

  it('leave out of a state only kinds and types that exist', () => {
    const names = new Set<string>([...kinds, ...sceneTypes()]);
    expect(ELEMENT_STATES.flatMap((state) => Object.keys(LEFT_OUT[state]).filter((name) => !names.has(name)))).toEqual([]);
  });
});
