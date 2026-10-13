import { beforeAll, describe, expect, it } from 'vitest';
import type { IconElement } from '../scene';
import { ICON_LABEL_GAP, ICON_LABEL_WIDTH, customSvg, iconBounds, iconColour, iconLabelLayout, iconLabelSize, iconParts, pictureBox } from './icon-look';
import { iconEntry, loadSet } from './sets';

const LIGHT: Record<string, string> = {
  '--color-shape-text': '#111111',
  '--swatch-blue-text': '#1d4ed8',
  '--color-canvas-bg': '#ffffff',
};
const DARK: Record<string, string> = { ...LIGHT, '--color-shape-text': '#eeeeee', '--color-canvas-bg': '#101010' };
const reader = (theme: Record<string, string>) => (name: string) => theme[name] ?? '';

const icon = (over: Partial<IconElement> = {}): IconElement => ({ id: 'i', type: 'icon', icon: 'line/database', x: 10, y: 20, w: 64, h: 64, z: 1, ...over });

beforeAll(async () => {
  await Promise.all([loadSet('line'), loadSet('solid'), loadSet('logo')]);
});

describe("an icon's colour", () => {
  it("is the theme's ink when none is picked, and a swatch's text colour when one is", () => {
    expect(iconColour(icon(), reader(LIGHT))).toBe('#111111');
    expect(iconColour(icon(), reader(DARK))).toBe('#eeeeee');
    expect(iconColour(icon({ color: 'blue' }), reader(LIGHT))).toBe('#1d4ed8');
  });

  it("is a logo's own colour for Brand, the same in both themes", () => {
    const logo = icon({ icon: 'logo/postgresql', color: 'brand' });
    expect(iconColour(logo, reader(LIGHT))).toBe('#4169E1');
    expect(iconColour(logo, reader(DARK))).toBe('#4169E1');
  });

  it('is ink for Brand on an icon with no brand', () => {
    expect(iconColour(icon({ color: 'brand' }), reader(LIGHT))).toBe('#111111');
  });
});

describe("an icon's parts", () => {
  it('are stroked for a line icon', () => {
    const parts = iconParts(iconEntry('line/database')!);
    expect(parts).toHaveLength(3);
    expect(parts[0]).toEqual({ d: 'M4 6a8 3 0 1 0 16 0a8 3 0 1 0 -16 0', fill: false, stroke: true, opacity: 1 });
  });

  it('keep a line icon part that is filled, or faded, as drawn', () => {
    const dots = iconParts(iconEntry('line/percentage-10')!).find((part) => part.fill);
    expect(dots).toMatchObject({ fill: true, stroke: false });
    expect(iconParts(iconEntry('line/brand-parsinta')!).some((part) => part.opacity === 0.5)).toBe(true);
  });

  it('are filled for a filled icon and a logo', () => {
    for (const name of ['solid/database', 'logo/redis']) {
      for (const part of iconParts(iconEntry(name)!)) expect(part, name).toMatchObject({ fill: true, stroke: false });
    }
  });
});

describe("an icon's label", () => {
  const measure = (line: string) => line.length * 10;

  it('sits centred under the icon', () => {
    const layout = iconLabelLayout(icon({ label: 'API' }), measure);
    expect(layout).toEqual({ lines: ['API'], x: 32 - ICON_LABEL_WIDTH / 2, y: 64 + ICON_LABEL_GAP, width: ICON_LABEL_WIDTH });
  });

  it('wraps at the wider of the icon and the label width', () => {
    expect(iconLabelLayout(icon({ label: 'Orders database primary' }), measure).lines).toEqual(['Orders database', 'primary']);
    const wide = iconLabelLayout(icon({ w: 300, h: 300, label: 'Orders database primary' }), measure);
    expect(wide.lines).toEqual(['Orders database primary']);
    expect(wide.width).toBe(300);
  });

  it('is nothing when there is none', () => {
    expect(iconLabelLayout(icon(), measure).lines).toEqual([]);
  });
});

describe("an icon's label size", () => {
  it('is its widest line and its lines at the font', () => {
    const measure = (line: string) => line.length * 10 + 0.4;
    const font = { size: 20, lineHeight: 1.25 };
    expect(iconLabelSize(icon(), 'Orders database primary', measure, font)).toEqual({ width: 151, height: 50 });
  });
});

describe('a custom icon', () => {
  const entry = { set: 'custom' as const, name: 'acme', title: 'acme', keywords: [], svg: '<svg xmlns="x" viewBox="0 0 20 10" width="20" height="10"/>', darkSvg: '<svg viewBox="0 0 20 10" width="20" height="10"><g/></svg>' };

  it('draws its dark copy on a dark canvas, its own otherwise', () => {
    expect(customSvg(entry, reader(LIGHT))).toBe(entry.svg);
    expect(customSvg(entry, reader(DARK))).toBe(entry.darkSvg);
    expect(customSvg({ ...entry, darkSvg: undefined }, reader(DARK))).toBe(entry.svg);
  });

  it('keeps its proportions, centred in the square', () => {
    expect(pictureBox(entry.svg, 64, 64)).toEqual({ x: 0, y: 16, w: 64, h: 32 });
    expect(pictureBox('<svg viewBox="0 0 10 40" width="10" height="40"/>', 64, 64)).toEqual({ x: 24, y: 0, w: 16, h: 64 });
    expect(pictureBox('<svg/>', 64, 64)).toEqual({ x: 0, y: 0, w: 64, h: 64 });
  });
});

describe("an icon's bounds", () => {
  it('are its square without a label', () => {
    expect(iconBounds(icon())).toEqual({ x: 10, y: 20, w: 64, h: 64 });
  });

  it('take in the label as measured', () => {
    expect(iconBounds(icon({ label: 'Orders DB', measuredWidth: 100, measuredHeight: 18 }))).toEqual({
      x: 10 + 32 - 50,
      y: 20,
      w: 100,
      h: 64 + ICON_LABEL_GAP + 18,
    });
  });
});
