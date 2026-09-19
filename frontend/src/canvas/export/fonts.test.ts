import { describe, expect, it, vi } from 'vitest';
import { carriesText, faceFamily, fontCss, FONT_FILE } from './fonts';
import type { SceneElement } from '../scene';

const bytes = new Uint8Array([119, 79, 70, 50]).buffer; // "wOF2"
const reader = () => Promise.resolve(bytes);

const el = (over: Record<string, unknown>): SceneElement =>
  ({ id: 'e', type: 'rect', x: 0, y: 0, w: 10, h: 10, z: 1, ...over }) as SceneElement;

describe('whether an export has any lettering', () => {
  it('sees a text element and a label', () => {
    expect(carriesText([el({ type: 'text', text: 'hi' })])).toBe(true);
    expect(carriesText([el({ label: 'A' })])).toBe(true);
  });

  it('does not count an empty label or blank text', () => {
    expect(carriesText([el({ label: '' }), el({ type: 'text', text: '  ' })])).toBe(false);
    expect(carriesText([el({})])).toBe(false);
  });
});

describe('the font an exported SVG carries', () => {
  it('embeds the bundled file when there is lettering', async () => {
    const css = await fontCss([el({ label: 'A' })], { family: 'Geist', read: reader });
    expect(css).toContain('@font-face');
    expect(css).toContain("font-family: 'Geist'");
    expect(css).toContain('data:font/woff2;base64,d09GMg==');
    expect(css).toContain("format('woff2')");
  });

  // The file is about 93KB of base64: worth carrying for a diagram with
  // labels, not worth carrying for one without.
  it('carries nothing when there is no lettering', async () => {
    const read = vi.fn(reader);
    expect(await fontCss([el({})], { family: 'Geist', read })).toBe('');
    expect(read).not.toHaveBeenCalled();
  });

  // An export that cannot read the font is still a valid picture: the text
  // elements name the family, and a reader that has Geist will use it.
  it('is empty rather than broken when the font cannot be read', async () => {
    const css = await fontCss([el({ label: 'A' })], { family: 'Geist', read: () => Promise.reject(new Error('gone')) });
    expect(css).toBe('');
  });

  it('reads the font from the app bundle, never the network', () => {
    expect(FONT_FILE.startsWith('/')).toBe(true);
    expect(FONT_FILE).not.toMatch(/^https?:/);
  });
});

// `--font-ui` is a stack ("Geist", system-ui, sans-serif). Naming a face after
// the whole stack produces a family nothing matches, so the embedded bytes are
// carried and never used: 93KB of dead weight and the wrong lettering.
describe('the family the face is named after', () => {
  it('is the first family of the stack, unquoted', () => {
    expect(faceFamily(`'Geist', system-ui, sans-serif`)).toBe('Geist');
    expect(faceFamily('"Geist Mono", monospace')).toBe('Geist Mono');
    expect(faceFamily('Geist')).toBe('Geist');
    expect(faceFamily('  ')).toBe('');
  });

  it('names the face so the text elements match it', async () => {
    const css = await fontCss([el({ label: 'A' })], { family: `'Geist', system-ui, sans-serif`, read: reader });
    expect(css).toContain("font-family: 'Geist';");
    expect(css).not.toContain('system-ui');
  });
});
