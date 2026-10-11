import { describe, expect, it } from 'vitest';
import { firstSheet } from './pdf-preview';
import type { PageSetup } from './export-pdf';

const a4: PageSetup = { paper: 'A4', widthMM: 0, heightMM: 0, landscape: false, margins: { top: 20, right: 20, bottom: 20, left: 20 }, background: true };
const page = { html: '<div class="bava-print"><h1>Plan</h1></div>', css: '.x {}', widthPx: 640 };
const wide = { svg: '<svg/>', width: 1600, height: 900 };

describe('firstSheet', () => {
  it('lays the page out at the paper, its width fitted between the margins', () => {
    const sheet = firstSheet({ page, canvas: null, include: 'document', setup: a4, dark: false })!;
    expect(Math.round(sheet.width)).toBe(794);
    expect(sheet.srcdoc).toContain('<h1>Plan</h1>');
    expect(sheet.srcdoc).toContain('zoom: 1.0039');
    expect(sheet.srcdoc).toContain('padding: 20mm 20mm 0 20mm');
    expect(sheet.srcdoc).toContain('data-theme="light"');
  });

  it("shows the Canvas's picture on its own sheet, landscape when wide, when it alone is printed", () => {
    const sheet = firstSheet({ page, canvas: wide, include: 'canvas', setup: a4, dark: true })!;
    expect(sheet.width).toBeGreaterThan(sheet.height);
    expect(sheet.srcdoc).toContain('data:image/svg+xml');
    expect(sheet.srcdoc).toContain('data-theme="dark"');
  });

  it('is nothing for a paper with no size', () => {
    expect(firstSheet({ page, canvas: null, include: 'document', setup: { ...a4, paper: 'Custom' }, dark: false })).toBeNull();
  });
});
