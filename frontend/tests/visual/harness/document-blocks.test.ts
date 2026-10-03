import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { schema } from '../../../src/docs/schema';
import { BLOCK_STATES, LEFT_OUT, PICTURED_ELSEWHERE, SUBJECTS, statesOf, type Subject } from './document-blocks';

const here = dirname(fileURLToPath(import.meta.url));
const REFERENCES = resolve(here, '../../../../testdata/visual');

/** Every node and mark type the page schema declares. */
const schemaTypes = () => [...Object.keys(schema.nodes), ...Object.keys(schema.marks)].sort();

const subjects = Object.entries(SUBJECTS) as [string, Subject][];

/** Whether a reference is on disk in both themes. */
const inBothThemes = (name: string) => ['light', 'dark'].every((theme) => existsSync(resolve(REFERENCES, `${name}--${theme}.png`)));

describe('the Document block pictures', () => {
  it('read the types from the schema', () => {
    // A guard that read nothing would pass every check below.
    expect(schemaTypes()).toEqual(expect.arrayContaining(['paragraph', 'heading', 'table_cell', 'image', 'card', 'math_inline', 'strong', 'link']));
  });

  it('picture only types the schema has', () => {
    const types = new Set(schemaTypes());
    expect(subjects.filter(([, subject]) => !types.has(subject.type)).map(([name]) => name)).toEqual([]);
  });

  it('picture every type in every state, or say why not', () => {
    const missing = BLOCK_STATES.flatMap((state) => {
      const shown = new Set(
        subjects
          .filter(([, subject]) => statesOf(subject).includes(state) || (state === 'rest' && subject.restAs !== undefined))
          .map(([, subject]) => subject.type),
      );
      return schemaTypes()
        .filter((type) => !shown.has(type) && !(type in LEFT_OUT[state]) && PICTURED_ELSEWHERE[type]?.[state] === undefined)
        .map((type) => `${type} ${state}`);
    });
    expect(missing).toEqual([]);
  });

  it('show a subject at rest as another only where that one is pictured at rest', () => {
    const named = new Map(subjects);
    const wrong = subjects.filter(([, subject]) => subject.restAs !== undefined && !statesOf(named.get(subject.restAs) ?? { type: '', markdown: '', find: '', restAs: '-' }).includes('rest'));
    expect(wrong.map(([name]) => name)).toEqual([]);
  });

  it('leave out only types that exist, and none that are pictured', () => {
    const types = new Set(schemaTypes());
    const wrong = BLOCK_STATES.flatMap((state) =>
      Object.keys(LEFT_OUT[state])
        .filter((type) => !types.has(type) || subjects.some(([, subject]) => subject.type === type && statesOf(subject).includes(state)))
        .map((type) => `${type} ${state}`),
    );
    expect(wrong).toEqual([]);
  });

  it('have a reference for every picture, in both themes', () => {
    const missing = subjects.flatMap(([name, subject]) =>
      statesOf(subject)
        .map((state) => `document-blocks/${name}--${state}`)
        .filter((reference) => !inBothThemes(reference)),
    );
    expect(missing).toEqual([]);
  });

  it('name references in other walks that exist, for types the schema has', () => {
    const types = new Set(schemaTypes());
    const wrong = Object.entries(PICTURED_ELSEWHERE).flatMap(([type, states]) =>
      Object.values(states).filter((reference) => !types.has(type) || !inBothThemes(reference)),
    );
    expect(wrong).toEqual([]);
  });
});
