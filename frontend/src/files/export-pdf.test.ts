import { describe, expect, it } from 'vitest';
import { defaultPaper, includeChoice, pageSetup, pdfName, type PdfChoices } from './export-pdf';

describe('defaultPaper', () => {
  it('is Letter in the US and Canada, A4 elsewhere', () => {
    expect(defaultPaper('en-US')).toBe('Letter');
    expect(defaultPaper('fr-CA')).toBe('Letter');
    expect(defaultPaper('en-GB')).toBe('A4');
    expect(defaultPaper('de')).toBe('A4');
    expect(defaultPaper('')).toBe('A4');
  });
});

describe('includeChoice', () => {
  it('offers only the Document when the Canvas holds nothing', () => {
    expect(includeChoice(false, 'canvas')).toEqual({ offered: ['document'], initial: 'document' });
  });

  it('starts at the view the page is open in', () => {
    expect(includeChoice(true, 'document').initial).toBe('document');
    expect(includeChoice(true, 'both').initial).toBe('both');
    expect(includeChoice(true, 'canvas').initial).toBe('canvas');
    expect(includeChoice(true, 'canvas').offered).toEqual(['document', 'canvas', 'both']);
  });
});

const choices: PdfChoices = {
  paper: 'A4',
  custom: { width: 0, height: 0 },
  unit: 'mm',
  landscape: false,
  margins: 'normal',
  customMargins: { top: 0, right: 0, bottom: 0, left: 0 },
};

describe('pageSetup', () => {
  it('turns a named margin into its millimetres', () => {
    expect(pageSetup(choices)).toEqual({
      setup: { paper: 'A4', widthMM: 0, heightMM: 0, landscape: false, margins: { top: 20, right: 20, bottom: 20, left: 20 }, background: true },
      problem: '',
    });
    expect(pageSetup({ ...choices, margins: 'none' }).setup.margins).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it('reads a Custom paper and margins in inches as millimetres', () => {
    const { setup } = pageSetup({ ...choices, paper: 'Custom', unit: 'in', custom: { width: 24, height: 36 }, margins: 'custom', customMargins: { top: 1, right: 0.5, bottom: 1, left: 0.5 } });
    expect(setup.widthMM).toBeCloseTo(609.6);
    expect(setup.heightMM).toBeCloseTo(914.4);
    expect(setup.margins.left).toBeCloseTo(12.7);
  });

  it('says why a Custom paper or margins cannot be printed', () => {
    expect(pageSetup({ ...choices, paper: 'Custom', custom: { width: 0, height: 100 } }).problem).toBe('export.pdf.noSize');
    expect(pageSetup({ ...choices, paper: 'A5', margins: 'custom', customMargins: { top: 0, right: 80, bottom: 0, left: 80 } }).problem).toBe('export.pdf.noRoom');
    expect(pageSetup({ ...choices, margins: 'custom', customMargins: { top: -1, right: 0, bottom: 0, left: 0 } }).problem).toBe('export.pdf.noRoom');
  });
});

describe('pdfName', () => {
  it("is the page's name", () => {
    expect(pdfName('Marketing/Launch plan.md')).toBe('Launch plan.pdf');
  });
});
