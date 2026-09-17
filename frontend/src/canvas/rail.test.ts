import { describe, expect, it } from 'vitest';
import { RAIL_GROUPS } from './rail';

describe('tool rail layout', () => {
  // The rail holds common tools only; every other shape is in the insert panel.
  it('groups insert, the common tools, then frame and eraser', () => {
    expect(RAIL_GROUPS.map((group) => group.map((item) => item.id))).toEqual([
      ['insert'],
      ['select', 'rect', 'ellipse', 'arrow', 'line', 'pen', 'text'],
      ['frame', 'eraser'],
    ]);
  });

  it('shows each item its key', () => {
    const keys = Object.fromEntries(RAIL_GROUPS.flat().map((item) => [item.id, item.key]));
    expect(keys).toMatchObject({ insert: '/', select: 'V', rect: 'R', ellipse: 'O', eraser: 'E', frame: 'F' });
  });
});
