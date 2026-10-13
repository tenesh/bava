import { describe, expect, it } from 'vitest';
import type { SceneElement } from '../scene';
import { setsWanted } from './wanted';

describe('the sets a scene needs', () => {
  it('are the bundled sets its icons name, once each', () => {
    const icon = (name: string) => ({ id: name, type: 'icon', icon: name, x: 0, y: 0, w: 1, h: 1, z: 1 }) as SceneElement;
    const elements = [icon('logo/redis'), icon('line/database'), icon('logo/postgresql'), icon('custom/acme'), icon('nonsense')];
    expect(setsWanted([...elements, { id: 'r', type: 'rect', x: 0, y: 0, w: 1, h: 1, z: 2 } as SceneElement])).toEqual(['logo', 'line']);
    expect(setsWanted([])).toEqual([]);
  });
});
