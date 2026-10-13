/**
 * Finding an icon by what was typed: names first, then titles, then the
 * sets' own keywords. The picker shows a page at a time and asks for more
 * as it scrolls.
 */
import type { IconEntry } from './sets';

/** Icons the picker shows before it is scrolled. */
export const ICON_RESULTS = 120;

const words = (text: string) => text.toLowerCase().replace(/[\s_]+/g, '-').trim();

function rank(icon: IconEntry, query: string): number {
  const name = icon.name.toLowerCase();
  const title = words(icon.title);
  if (name.startsWith(query) || title.startsWith(query)) return 0;
  if (name.includes(query) || title.includes(query)) return 1;
  if (icon.keywords.some((keyword) => words(keyword).startsWith(query))) return 2;
  if (icon.keywords.some((keyword) => words(keyword).includes(query))) return 3;
  return 4;
}

/** The icons matching `query`, best first, then by name; all of them, by name, when it is blank. */
export function searchIcons(icons: IconEntry[], query: string, limit = ICON_RESULTS): IconEntry[] {
  const q = words(query).replace(/^-+|-+$/g, '');
  const byName = (a: IconEntry, b: IconEntry) => a.name.localeCompare(b.name);
  if (q === '') return [...icons].sort(byName).slice(0, limit);
  return icons
    .map((icon) => ({ icon, rank: rank(icon, q) }))
    .filter((found) => found.rank < 4)
    .sort((a, b) => a.rank - b.rank || byName(a.icon, b.icon))
    .slice(0, limit)
    .map((found) => found.icon);
}
