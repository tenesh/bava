/**
 * The icons an icon element can name: three sets bundled with the app
 * (`tooling/icon-sets.ts`), each loaded the first time it is wanted, and the
 * user's own library, handed in once it has been read. An element stores
 * `<set>/<name>`, never the drawing (`docs/file-format.md`, "Icons").
 */

export const ICON_SETS = ['line', 'solid', 'logo', 'custom'] as const;
export type IconSet = (typeof ICON_SETS)[number];
export type BundledSet = Exclude<IconSet, 'custom'>;

export type IconRef = { set: IconSet; name: string };

/** The bundled icons' drawing grid, and their line width on it. */
export const ICON_GRID = 24;
export const ICON_STROKE = 2;

/** One icon: a bundled one's drawing on a 24 grid, or a custom one's own SVG. */
export type IconEntry = {
  set: IconSet;
  name: string;
  /** What the picker shows under it. */
  title: string;
  keywords: string[];
  /** A bundled icon's inner drawing. */
  body?: string;
  /** A logo's own colour, `rrggbb`. */
  hex?: string;
  /** A custom icon's SVG, and its copy for a dark canvas. */
  svg?: string;
  darkSvg?: string;
};

export type CustomIcon = { name: string; svg: string; darkSvg?: string };

const NAME = /^(line|solid|logo|custom)\/([^/]+)$/;

/** The set and name an element's `icon` holds, or null when it names neither. */
export function parseIconName(value: string): IconRef | null {
  const match = NAME.exec(value);
  return match ? { set: match[1] as IconSet, name: match[2] } : null;
}

const loaded = new Map<IconSet, Map<string, IconEntry>>();
const loading = new Map<BundledSet, Promise<IconEntry[]>>();

const importers: Record<BundledSet, () => Promise<{ default: { name: string; body: string; keywords: string[]; title?: string; hex?: string }[] }>> = {
  line: () => import('virtual:bava-icons/line'),
  solid: () => import('virtual:bava-icons/solid'),
  logo: () => import('virtual:bava-icons/logo'),
};

/** A bundled set, loaded once; a load that failed is tried again the next time. */
export function loadSet(set: BundledSet): Promise<IconEntry[]> {
  let pending = loading.get(set);
  if (!pending) {
    pending = importers[set]().then((module) => {
      const entries = module.default.map((icon) => ({ set, title: icon.title ?? icon.name, ...icon }));
      loaded.set(set, new Map(entries.map((entry) => [entry.name, entry])));
      return entries;
    });
    pending.catch(() => loading.delete(set));
    loading.set(set, pending);
  }
  return pending;
}

/** A set's icons in name order, or null while it has not loaded. */
export function loadedSet(set: IconSet): IconEntry[] | null {
  const entries = loaded.get(set);
  return entries ? [...entries.values()] : null;
}

/** The user's library, as read from Bava's config folder; it replaces the last one. */
export function setCustomIcons(icons: CustomIcon[]): void {
  const entries = icons.map((icon): IconEntry => ({ set: 'custom', title: icon.name, keywords: [], ...icon }));
  loaded.set('custom', new Map(entries.map((entry) => [entry.name, entry])));
}

/**
 * The icon an element names: undefined while its set has not loaded, null
 * when the set has none by that name (or the name is not an icon's).
 */
export function iconEntry(value: string): IconEntry | null | undefined {
  const ref = parseIconName(value);
  if (!ref) return null;
  const set = loaded.get(ref.set);
  if (!set) return undefined;
  return set.get(ref.name) ?? null;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** An SVG that names its namespace, as a picture made from it must. */
function namespaced(svg: string): string {
  return /^<svg[^>]*\sxmlns=/.test(svg) ? svg : svg.replace(/^<svg/, `<svg xmlns="${SVG_NS}"`);
}

/** A custom icon's SVG as an address a picture is made from: it travels as text, never fetched. */
export function iconPictureAddress(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(namespaced(svg))}`;
}

/** The SVGs a custom icon may draw: its own and its dark copy. */
export function customSvgs(entry: IconEntry): string[] {
  return [entry.svg, entry.darkSvg].filter((svg): svg is string => Boolean(svg));
}
