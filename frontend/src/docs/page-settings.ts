/** How wide a page's text runs. */
export type PageWidth = 'narrow' | 'wide' | 'full';

const WIDTHS: readonly string[] = ['narrow', 'wide', 'full'];
const isWidth = (value: string | undefined): value is PageWidth => value !== undefined && WIDTHS.includes(value);

/** The width a page is shown at: its own, else its Space's, else the app's, else wide. */
export function pageWidth(page: string | undefined, space: string | undefined, app: string | undefined): PageWidth {
  return [page, space, app].find(isWidth) ?? 'wide';
}
