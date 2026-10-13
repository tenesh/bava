import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildSet, CREDITED_LICENCES, iconSets, LOGO_CREDITS_FILE, logoCredits, SHIPPABLE_LICENCES } from './icon-sets';

type LogoData = { slug: string; license?: { type?: string } };
const logoData = JSON.parse(
  readFileSync(new URL('../node_modules/simple-icons/data/simple-icons.json', import.meta.url), 'utf8'),
) as LogoData[];

describe("the logos' credits", () => {
  const credited = logoData.filter((logo) => logo.license?.type !== undefined && CREDITED_LICENCES.has(logo.license.type));

  it('name every logo shipped under a licence of its own, with that licence and its source', () => {
    const credits = logoCredits();
    expect(credited.length).toBe(83);
    for (const logo of credited) expect(credits, logo.slug).toContain(`${(logo as { title?: string }).title}: ${logo.license!.type}`);
    expect(credits).toContain('Apache License');
    expect(credits).toContain('Permission is hereby granted, free of charge');
    expect(credits).toContain('Redistribution and use in source and binary forms');
  });

  // The list ships with the app as a file; a set update that changes it fails here until it is written again.
  it('ship as written, the same as the set says', () => {
    expect(readFileSync(new URL(`../public/${LOGO_CREDITS_FILE}`, import.meta.url), 'utf8')).toBe(logoCredits());
  });
});

describe('the bundled icon sets', () => {
  it('hold every general icon, outline and filled', () => {
    expect(buildSet('line')).toHaveLength(5184);
    expect(buildSet('solid')).toHaveLength(1054);
  });

  // A logo under a licence Bava cannot ship never reaches the app.
  it('hold only the logos whose licence Bava can ship', () => {
    const shipped = new Set(buildSet('logo').map((logo) => logo.name));
    const refused = logoData.filter((logo) => logo.license?.type !== undefined && !SHIPPABLE_LICENCES.has(logo.license.type));
    expect(refused.length).toBeGreaterThan(100);
    for (const logo of refused) expect(shipped.has(logo.slug), logo.slug).toBe(false);
    expect(shipped.size).toBe(logoData.length - refused.length);
  });

  it('give each icon its name, its drawing and words to find it by', () => {
    const database = buildSet('line').find((icon) => icon.name === 'database');
    expect(database?.body).toBe(
      '<path d="M4 6a8 3 0 1 0 16 0a8 3 0 1 0 -16 0"/><path d="M4 6v6a8 3 0 0 0 16 0v-6"/><path d="M4 12v6a8 3 0 0 0 16 0v-6"/>',
    );
    expect(database?.keywords.length).toBeGreaterThan(0);
    for (const set of ['line', 'solid', 'logo'] as const) {
      for (const icon of buildSet(set)) expect(icon.body, `${set}/${icon.name}`).toMatch(/^<(path|circle|rect|line|polyline|polygon|ellipse) /);
    }
  });

  it('give a logo its title and its own colour', () => {
    const postgres = buildSet('logo').find((logo) => logo.name === 'postgresql');
    expect(postgres).toMatchObject({ title: 'PostgreSQL', hex: '4169E1' });
    expect(postgres?.keywords).toContain('postgresql');
  });

  it('serve each set as its own module, and no other', () => {
    const plugin = iconSets();
    const resolve = plugin.resolveId as (id: string) => string | undefined;
    const load = plugin.load as (id: string) => string | undefined;
    expect(resolve('virtual:bava-icons/logo')).toBe('\0virtual:bava-icons/logo');
    expect(resolve('./elsewhere')).toBeUndefined();
    expect(load('\0virtual:bava-icons/solid')).toMatch(/^export default \[\{"name":/);
    expect(() => load('\0virtual:bava-icons/cloud')).toThrow();
  });
});
