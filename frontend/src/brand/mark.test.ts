import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const MARK = resolve(__dirname, 'panda.svg');
// SHA-256 of the delivered drawing's path data, taken when it was vendored on
// 2026-09-17. The repo is the only copy of the art: nothing here may depend on
// a design folder outside it.
const DELIVERED_PATH_SHA256 = 'd0ffe06e35e82021c1229dc4ed5cd594d0587c1dd17611e0a83e2d7fb3f5387c';

const read = (path: string) => readFileSync(path, 'utf8');
const pathData = (svg: string) => /\sd="([^"]+)"/.exec(svg)?.[1];

describe('the vendored mark', () => {
  it('the mark is one currentColor path with evenodd knockouts', () => {
    const svg = read(MARK);
    expect(svg.match(/<path\b/g)).toHaveLength(1);
    expect(svg).toContain('fill="currentColor"');
    expect(svg).toContain('fill-rule="evenodd"');
    expect(svg).toMatch(/viewBox="0 0 992\.6 1009"/);
  });

  // The export tool embeds a provenance manifest. The app ships the drawing,
  // not seven kilobytes of someone else's metadata, and nothing that could
  // fetch.
  it('the mark carries no metadata, images or external references', () => {
    const svg = read(MARK);
    expect(svg).not.toMatch(/<metadata|c2pa|<image|href=|<script|<style/i);
  });

  // Stripping metadata must not touch the drawing, and nobody redraws the mark
  // by hand: one drawing at every size.
  it('the path data is the delivered drawing, unmodified', () => {
    const d = pathData(read(MARK)) ?? '';
    expect(createHash('sha256').update(d).digest('hex')).toBe(DELIVERED_PATH_SHA256);
  });

  // The path is positioned by its transform inside the viewBox; changing
  // either moves the drawing while the path data stays identical.
  it('the drawing sits where it was delivered', () => {
    const svg = read(MARK);
    expect(svg).toContain('viewBox="0 0 992.6 1009"');
    expect(svg).toContain('transform="translate(-10.6,-19.6)"');
  });
});
