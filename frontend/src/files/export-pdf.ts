/**
 * A page's PDF: the paper first offered, which parts of the page may be
 * included, the page setup from the dialog's choices, and the file's name.
 */
import type { MessageKey } from '../i18n/messages';

/** The papers offered: the sizes most apps offer, and Custom for any other. */
export const PAPERS = ['A3', 'A4', 'A5', 'B4', 'B5', 'Letter', 'Legal', 'Tabloid', 'Custom'] as const;
export type Paper = (typeof PAPERS)[number];

/** The named margins, in millimetres all round, and Custom. */
export const MARGINS = { none: 0, narrow: 12, normal: 20, wide: 30 } as const;
export type MarginName = keyof typeof MARGINS | 'custom';

export type Include = 'document' | 'canvas' | 'both';
export type Unit = 'mm' | 'in';
export type Sides = { top: number; right: number; bottom: number; left: number };

/** How a page is printed, as Go reads it: millimetres throughout. */
export type PageSetup = {
  paper: Paper;
  widthMM: number;
  heightMM: number;
  landscape: boolean;
  margins: Sides;
  background: boolean;
};

/** The dialog's choices, in the unit chosen for Custom sizes. */
export type PdfChoices = {
  paper: Paper;
  custom: { width: number; height: number };
  unit: Unit;
  landscape: boolean;
  margins: MarginName;
  customMargins: Sides;
};

/** Each named paper's width and height in millimetres, portrait. */
const SIZES: Record<Exclude<Paper, 'Custom'>, [number, number]> = {
  A3: [297, 420],
  A4: [210, 297],
  A5: [148, 210],
  B4: [250, 353],
  B5: [176, 250],
  Letter: [215.9, 279.4],
  Legal: [215.9, 355.6],
  Tabloid: [279.4, 431.8],
};

/** The paper first offered for a locale: Letter in the US and Canada, A4 elsewhere. */
export function defaultPaper(locale: string): Paper {
  let region: string | undefined;
  try {
    region = locale ? new Intl.Locale(locale).region : undefined;
  } catch {
    region = undefined;
  }
  return region === 'US' || region === 'CA' ? 'Letter' : 'A4';
}

/**
 * Which parts of a page may be included, and the first chosen: the view the
 * page is open in. A page with nothing on its Canvas prints its Document.
 */
export function includeChoice(hasCanvas: boolean, view: Include): { offered: Include[]; initial: Include } {
  if (!hasCanvas) return { offered: ['document'], initial: 'document' };
  return { offered: ['document', 'canvas', 'both'], initial: view };
}

const MM_PER_INCH = 25.4;

/** A4's width and height in millimetres, where a Custom paper starts. */
export const A4_MM = { width: 210, height: 297 } as const;

/** How far a Custom field's arrows move it, in each unit. */
export const UNIT_STEP: Record<Unit, number> = { mm: 1, in: 0.1 };

/** A length in one unit, in another. */
export function inUnit(n: number, from: Unit, to: Unit): number {
  if (from === to) return n;
  return to === 'in' ? n / MM_PER_INCH : n * MM_PER_INCH;
}

/** Why a setup cannot be printed, as a message key; '' when it can. */
export type SetupProblem = Extract<MessageKey, 'export.pdf.noSize' | 'export.pdf.noRoom'> | '';

/**
 * The page setup the choices make, and the message key saying why it cannot
 * be printed ('' when it can): Custom needs a size, and margins must leave
 * room.
 */
export function pageSetup(choices: PdfChoices): { setup: PageSetup; problem: SetupProblem } {
  const mm = (n: number) => inUnit(n, choices.unit, 'mm');
  const custom = choices.paper === 'Custom';
  const margins: Sides =
    choices.margins === 'custom'
      ? {
          top: mm(choices.customMargins.top),
          right: mm(choices.customMargins.right),
          bottom: mm(choices.customMargins.bottom),
          left: mm(choices.customMargins.left),
        }
      : { top: MARGINS[choices.margins], right: MARGINS[choices.margins], bottom: MARGINS[choices.margins], left: MARGINS[choices.margins] };
  const setup: PageSetup = {
    paper: choices.paper,
    widthMM: custom ? mm(choices.custom.width) : 0,
    heightMM: custom ? mm(choices.custom.height) : 0,
    landscape: choices.landscape,
    margins,
    background: true,
  };
  return { setup, problem: problemOf(setup) };
}

function problemOf(setup: PageSetup): SetupProblem {
  const [w, h] = setup.paper === 'Custom' ? [setup.widthMM, setup.heightMM] : SIZES[setup.paper];
  if (!(w > 0 && h > 0)) return 'export.pdf.noSize';
  const [width, height] = setup.landscape ? [h, w] : [w, h];
  const m = setup.margins;
  if (Math.min(m.top, m.right, m.bottom, m.left) < 0) return 'export.pdf.noRoom';
  if (m.left + m.right >= width || m.top + m.bottom >= height) return 'export.pdf.noRoom';
  return '';
}

/** The paper's width and height in millimetres, turned for landscape; null when it has none. */
export function paperSize(setup: PageSetup): { width: number; height: number } | null {
  const [w, h] = setup.paper === 'Custom' ? [setup.widthMM, setup.heightMM] : SIZES[setup.paper];
  if (!(w > 0 && h > 0)) return null;
  return setup.landscape ? { width: h, height: w } : { width: w, height: h };
}

/** A page's PDF's suggested name: the page's own. */
export function pdfName(pagePath: string): string {
  const name = pagePath.split('/').pop() ?? pagePath;
  return `${name.replace(/\.md$/i, '')}.pdf`;
}
