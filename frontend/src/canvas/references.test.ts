import { describe, expect, it } from 'vitest';
import { REFERENCE_KEYS, remapReferences } from './references';
import type { SceneElement } from './scene';

const el = (over: Record<string, unknown>): SceneElement => ({ z: 1, x: 0, y: 0, w: 1, h: 1, ...over }) as SceneElement;

describe('rewriting the ids an element points at', () => {
  const renamed = new Map([
    ['old-a', 'new-a'],
    ['old-b', 'new-b'],
  ]);

  it('covers every key that holds an id', () => {
    // The list is the contract: a key that holds an id and is missing here is
    // a reference that silently keeps pointing at the original.
    expect([...REFERENCE_KEYS].sort()).toEqual(['endBinding', 'frame', 'startBinding'].sort());
  });

  it('rewrites an arrow bindings and a child frame', () => {
    const [arrow, child] = remapReferences(
      [
        el({ id: 'x', type: 'arrow', startBinding: 'old-a', endBinding: 'old-b' }),
        el({ id: 'y', type: 'rect', frame: 'old-a' }),
      ],
      renamed,
    ) as (SceneElement & Record<string, string>)[];
    expect(arrow.startBinding).toBe('new-a');
    expect(arrow.endBinding).toBe('new-b');
    expect(child.frame).toBe('new-a');
  });

  // A group holds its children as ids too, and this is the one both earlier
  // copies of this logic forgot: a duplicated group pointed at the originals.
  it('rewrites a group children', () => {
    const [group] = remapReferences(
      [el({ id: 'g', type: 'group', children: ['old-a', 'old-b', 'untouched'] })],
      renamed,
    ) as (SceneElement & { children: string[] })[];
    expect(group.children).toEqual(['new-a', 'new-b', 'untouched']);
  });

  it('leaves a reference to something that was not renamed', () => {
    const [arrow] = remapReferences([el({ id: 'x', type: 'arrow', startBinding: 'stays' })], renamed) as (SceneElement &
      Record<string, string>)[];
    expect(arrow.startBinding).toBe('stays');
  });

  it('returns the elements untouched when nothing was renamed', () => {
    const elements = [el({ id: 'x', type: 'arrow', startBinding: 'old-a' })];
    expect(remapReferences(elements, new Map())).toBe(elements);
  });
});
