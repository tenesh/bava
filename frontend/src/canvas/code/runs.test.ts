import { describe, expect, it, vi } from 'vitest';
import { createCodeRuns } from './runs';
import type { SceneData } from '../scene';

const scene = (code: string, language?: string): SceneData => ({
  elements: [
    { id: 'c', type: 'code', x: 0, y: 0, w: 10, h: 10, z: 1, code, language, measuredWidth: 10, measuredHeight: 10 },
  ] as never[],
});

describe('the tokenised code the canvas and the export both read', () => {
  it('colours every block, and hands them to whoever is listening', async () => {
    const onRuns = vi.fn();
    const runs = createCodeRuns({ onRuns });
    await runs.update(scene('const a = 1', 'javascript'));

    expect(onRuns).toHaveBeenCalled();
    expect(runs.forElement('c')[0][0].kind).toBe('keyword');
  });

  it('is plain for a language it does not have', async () => {
    const runs = createCodeRuns();
    await runs.update(scene('const a = 1', 'a-language-from-later'));
    expect(runs.forElement('c')).toEqual([[{ text: 'const a = 1', kind: 'plain' }]]);
  });

  it('is empty for a block it has not seen', () => {
    expect(createCodeRuns().forElement('nobody')).toEqual([]);
  });

  // Two passes can overlap: changing the language then typing. The older one
  // must not land on top of the newer, as with render responses.
  it('drops a pass that a newer one overtook', async () => {
    const runs = createCodeRuns();
    const slow = runs.update(scene('old', undefined));
    const fast = runs.update(scene('new', undefined));
    await Promise.all([slow, fast]);
    expect(runs.forElement('c')).toEqual([[{ text: 'new', kind: 'plain' }]]);
  });

  it('forgets a block that is no longer in the scene', async () => {
    const runs = createCodeRuns();
    await runs.update(scene('gone', undefined));
    await runs.update({ elements: [] });
    expect(runs.forElement('c')).toEqual([]);
  });
});
