import { describe, expect, it } from 'vitest';
import { iconEntry, iconSvg, loadSet, parseIconName, setCustomIcons } from './sets';

describe('icon names', () => {
  it('are a set and a name', () => {
    expect(parseIconName('line/database')).toEqual({ set: 'line', name: 'database' });
    expect(parseIconName('custom/acme billing')).toEqual({ set: 'custom', name: 'acme billing' });
  });

  it('are nothing without a known set or a name', () => {
    for (const value of ['database', 'cloud/aws-lambda', 'line/', '/database', 'line/a/b', 'https://example.com/a.svg']) {
      expect(parseIconName(value), value).toBeNull();
    }
  });
});

describe('the bundled sets', () => {
  it('load once, when first wanted', async () => {
    expect(iconEntry('solid/database')).toBeUndefined();
    const first = loadSet('solid');
    expect(loadSet('solid')).toBe(first);
    expect((await first).length).toBe(1054);
    expect(iconEntry('solid/database')).toMatchObject({ set: 'solid', name: 'database' });
  });

  it('say an icon is missing only once its set has loaded', async () => {
    expect(iconEntry('logo/not-a-product')).toBeUndefined();
    await loadSet('logo');
    expect(iconEntry('logo/not-a-product')).toBeNull();
    expect(iconEntry('logo/postgresql')).toMatchObject({ title: 'PostgreSQL', hex: '4169E1' });
  });
});

describe('drawing an icon', () => {
  it('strokes a line icon in the colour given', async () => {
    await loadSet('line');
    const svg = iconSvg(iconEntry('line/database')!, '#123456', false);
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="0 0 24 24" fill="none" stroke="#123456" stroke-width="2"/);
    expect(svg).toContain('<path d="M4 6v6a8 3 0 0 0 16 0v-6"/>');
  });

  it('fills a filled icon or a logo in the colour given', async () => {
    await loadSet('logo');
    expect(iconSvg(iconEntry('logo/redis')!, '#FF4438', false)).toMatch(/^<svg [^>]*fill="#FF4438" stroke="none"/);
  });

  it("draws a custom icon in its own colours, its dark copy on a dark canvas", () => {
    setCustomIcons([
      { name: 'acme', svg: '<svg viewBox="0 0 10 10"><rect fill="#0f766e" width="10" height="10"/></svg>', darkSvg: '<svg viewBox="0 0 10 10"><rect fill="#5eead4" width="10" height="10"/></svg>' },
      { name: 'plain', svg: '<svg viewBox="0 0 10 10"><circle fill="#111" r="5" cx="5" cy="5"/></svg>' },
    ]);
    const acme = iconEntry('custom/acme')!;
    expect(iconSvg(acme, '#ff0000', false)).toContain('#0f766e');
    expect(iconSvg(acme, '#ff0000', true)).toContain('#5eead4');
    expect(iconSvg(iconEntry('custom/plain')!, '#ff0000', true)).toContain('#111');
    expect(iconEntry('custom/gone')).toBeNull();
  });
});
