import { describe, expect, it } from 'vitest';
import { PICTURE_MAX_SIDE, placedPicture } from './add-picture';

describe('a picture added to the canvas', () => {
  it('is at most the largest side, its proportions kept, centred where it lands', () => {
    const e = placedPicture('har gow.png', { w: 2000, h: 1000 }, { x: 500, y: 400 });
    expect(e).toMatchObject({ type: 'image', file: 'har gow.png', w: PICTURE_MAX_SIDE, h: PICTURE_MAX_SIDE / 2 });
    expect(e.x + e.w / 2).toBe(500);
    expect(e.y + e.h / 2).toBe(400);
  });

  it('keeps its own size when smaller', () => {
    expect(placedPicture('icon.png', { w: 64, h: 32 }, { x: 0, y: 0 })).toMatchObject({ w: 64, h: 32 });
  });

  it('is limited by its taller side when it stands upright', () => {
    expect(placedPicture('tall.png', { w: 500, h: 2000 }, { x: 0, y: 0 })).toMatchObject({ w: PICTURE_MAX_SIDE / 4, h: PICTURE_MAX_SIDE });
  });

  it('takes a size when its own is not known, a square', () => {
    const e = placedPicture('unknown.svg', { w: 0, h: 0 }, { x: 0, y: 0 });
    expect(e.w).toBeGreaterThan(0);
    expect(e.w).toBe(e.h);
  });
});
