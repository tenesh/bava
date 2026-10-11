import { describe, expect, it } from 'vitest';
import { usesItsFolder } from './local-files';

describe('usesItsFolder', () => {
  it('is true for a picture, video or file card beside the page', () => {
    expect(usesItsFolder('# Notes\n\n![logo](logo.png)\n')).toBe(true);
    expect(usesItsFolder('# Notes\n\n![demo](media/demo.mp4)\n')).toBe(true);
    expect(usesItsFolder('# Notes\n\n<!-- bava: card -->\n[Contract](contract.pdf)\n')).toBe(true);
  });

  it('is false for a page with only words, web pictures or links to pages', () => {
    expect(usesItsFolder('# Notes\n\nJust words.\n')).toBe(false);
    expect(usesItsFolder('# Notes\n\n![logo](https://example.com/logo.png)\n')).toBe(false);
    expect(usesItsFolder('# Notes\n\nSee [Plan](Plan.md).\n')).toBe(false);
  });
});
