import { describe, expect, it } from 'vitest';
import { customSvgs, iconEntry, iconPictureAddress, loadSet, parseIconName, setCustomIcons } from './sets';

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

describe("a custom icon's picture", () => {
  it('is made from its SVG as text, its namespace named, never from an address', () => {
    const address = iconPictureAddress('<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>');
    expect(address.startsWith('data:image/svg+xml;charset=utf-8,')).toBe(true);
    expect(decodeURIComponent(address.slice(address.indexOf(',') + 1))).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>',
    );
  });

  it('is either copy of an icon, its dark one when it has one', () => {
    setCustomIcons([{ name: 'acme', svg: '<svg/>', darkSvg: '<svg><g/></svg>' }, { name: 'plain', svg: '<svg/>' }]);
    expect(customSvgs(iconEntry('custom/acme')!)).toEqual(['<svg/>', '<svg><g/></svg>']);
    expect(customSvgs(iconEntry('custom/plain')!)).toEqual(['<svg/>']);
    expect(iconEntry('custom/gone')).toBeNull();
  });
});
