import { beforeAll, describe, expect, it } from 'vitest';
import { d2IconName, resolveD2Icon } from './d2-names';
import { loadSet, setCustomIcons } from './sets';

describe("a D2 icon's name", () => {
  it('is the value, or an address’s file name, lowercased, its extension and leading number gone', () => {
    expect(d2IconName('server')).toBe('server');
    expect(d2IconName('https://icons.example.com/essentials/112-server.svg')).toBe('server');
    expect(d2IconName('https://example.com/icons/Postgres.SVG?v=2#x')).toBe('postgres');
    expect(d2IconName('icons/Edge%20Node.png')).toBe('edge node');
    expect(d2IconName('file:///Users/you/icons/acme-billing.svg')).toBe('acme-billing');
  });

  it('is nothing for a picture carried as data, or an address that ends in a folder', () => {
    expect(d2IconName('data:image/svg+xml;base64,PHN2Zz4=')).toBe('');
    expect(d2IconName('https://example.com/icons/')).toBe('');
  });

  it('reads a Windows path too', () => {
    expect(d2IconName('C:\\icons\\Server.svg')).toBe('server');
  });

  // Icon packs number their files; a plain name is taken as written.
  it("drops a leading number from an address's file name only", () => {
    expect(d2IconName('7-zip')).toBe('7-zip');
    expect(d2IconName('icons/7-zip.svg')).toBe('zip');
  });
});

describe('looking a D2 icon up', () => {
  beforeAll(async () => {
    await Promise.all([loadSet('line'), loadSet('logo')]);
    setCustomIcons([{ name: 'Server', svg: '<svg/>' }, { name: 'acme-billing', svg: '<svg/>' }]);
  });

  it('looks in the custom library first, then the general icons, then the logos', () => {
    expect(resolveD2Icon('server')).toBe('custom/Server');
    expect(resolveD2Icon('database')).toBe('line/database');
    expect(resolveD2Icon('https://example.com/a/redis.svg')).toBe('logo/redis');
    expect(resolveD2Icon('https://example.com/a/acme-billing.svg')).toBe('custom/acme-billing');
  });

  it("finds a logo by its title or another name the set gives it", () => {
    expect(resolveD2Icon('PostgreSQL')).toBe('logo/postgresql');
    expect(resolveD2Icon('Node.js')).toBe('logo/nodedotjs');
  });

  it('is nothing for a name no set holds, or a picture carried as data', () => {
    expect(resolveD2Icon('no-such-icon')).toBeNull();
    expect(resolveD2Icon('data:image/png;base64,AAAA')).toBeNull();
  });
});
