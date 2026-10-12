import { describe, expect, it } from 'vitest';
import { PICTURE_ICON, placeholderLayout } from './picture-placeholder';

const sizes = { name: 13, note: 11.5 };

describe('a picture that cannot be shown', () => {
  it('names the missing file under the icon, all centred in its box', () => {
    const layout = placeholderLayout({ w: 220, h: 140 }, 'logo.png', 'missing', sizes);
    expect(layout.icon).not.toBeNull();
    expect(layout.icon!.x + layout.icon!.w / 2).toBe(110);
    expect(layout.lines.map((l) => l.text)).toEqual(['logo.png is missing', "Not in the Space's attachments"]);
    expect(layout.lines.map((l) => l.kind)).toEqual(['name', 'note']);
    // The block sits in the middle: as much room above the icon as below the last line.
    const top = layout.icon!.y;
    const last = layout.lines[layout.lines.length - 1];
    expect(top).toBeCloseTo(140 - (last.y + last.size));
    expect(layout.lines[0].y).toBeGreaterThan(top + layout.icon!.h);
  });

  it('shows only the icon while the picture loads', () => {
    const layout = placeholderLayout({ w: 220, h: 140 }, 'logo.png', 'loading', sizes);
    expect(layout.icon).not.toBeNull();
    expect(layout.lines).toEqual([]);
  });

  it('drops the words, then the icon, as the box gets too small for them', () => {
    expect(placeholderLayout({ w: 220, h: 40 }, 'logo.png', 'missing', sizes).lines).toEqual([]);
    expect(placeholderLayout({ w: 220, h: 40 }, 'logo.png', 'missing', sizes).icon).not.toBeNull();
    const tiny = placeholderLayout({ w: 12, h: 12 }, 'logo.png', 'missing', sizes);
    expect(tiny.icon).toBeNull();
    expect(tiny.lines).toEqual([]);
  });

  it('draws its icon from one path, for the stage and an export alike', () => {
    expect(PICTURE_ICON.path).toMatch(/^M/);
    expect(PICTURE_ICON.w).toBe(24);
    expect(PICTURE_ICON.h).toBe(20);
  });
});
