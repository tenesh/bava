/**
 * How a page's breadcrumb fits its row. The name keeps priority: the folders
 * give way first, each down to a few letters and an ellipsis, and when even
 * that leaves the name too little room they fold into one crumb.
 */
export type CrumbFit = 'whole' | 'shorten' | 'fold';

export type CrumbWidths = {
  /** The row's width. */
  available: number;
  /** Each folder crumb's natural width. */
  folders: number[];
  /** The name's natural width. */
  name: number;
  /** The separators and the gaps between crumbs. */
  chrome: number;
  /** The narrowest a folder crumb is cut to. */
  folderMin: number;
};

export function fitCrumbs({ available, folders, name, chrome, folderMin }: CrumbWidths): CrumbFit {
  if (folders.length === 0) return 'whole';
  const sum = (widths: number[]) => widths.reduce((total, width) => total + width, 0);
  if (sum(folders) + name + chrome <= available) return 'whole';
  const shortest = sum(folders.map((width) => Math.min(width, folderMin)));
  return shortest + name + chrome <= available ? 'shorten' : 'fold';
}
