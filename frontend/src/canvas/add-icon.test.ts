import { describe, expect, it } from 'vitest';
import { ICON_SIDE, placedIcon } from './add-icon';

describe('an icon just added', () => {
  it('is a square centred where it lands, in ink, unlabelled', () => {
    expect(ICON_SIDE).toBe(64);
    expect(placedIcon('logo/postgresql', { x: 100, y: 50 })).toEqual({
      id: '',
      type: 'icon',
      icon: 'logo/postgresql',
      x: 68,
      y: 18,
      w: 64,
      h: 64,
      z: 0,
    });
  });
});
