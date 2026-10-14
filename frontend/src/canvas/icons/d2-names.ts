/**
 * A D2 `icon:` found among Bava's own icons, by name: never fetched. The
 * name is the value itself or, for an address, its file name.
 */
import { iconEntry, loadedSet } from './sets';

/** Picture extensions an address's file name may end in. */
const PICTURE_EXTENSION = /\.(svg|png|jpe?g|gif|webp)$/;

/** A leading number and separator, as icon packs number their files ("112-server"). */
const LEADING_NUMBER = /^\d+[-_ ]+/;

/**
 * The name a D2 icon value is looked up by: the value itself, or an address's
 * (or a path's) file name, without its picture extension and, there only, a
 * leading number; '' for a picture carried as data or an address to a folder.
 */
export function d2IconName(value: string): string {
  const trimmed = value.trim();
  if (/^data:/i.test(trimmed)) return '';
  const path = trimmed.replace(/[?#].*$/, '');
  const cut = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  const file = path.slice(cut + 1);
  let name = file;
  try {
    name = decodeURIComponent(file);
  } catch {
    // Not encoded as an address: taken as written.
  }
  name = name.toLowerCase().replace(PICTURE_EXTENSION, '');
  return cut >= 0 ? name.replace(LEADING_NUMBER, '') : name;
}

/**
 * The icon a D2 value names, as an element stores it: the custom library
 * first, then the general icons, then the logos (by name, then by title or
 * another name the set gives one); null when none has it. The sets must
 * have loaded.
 */
export function resolveD2Icon(value: string): string | null {
  const name = d2IconName(value);
  if (!name) return null;
  const custom = (loadedSet('custom') ?? []).find((icon) => icon.name.toLowerCase() === name);
  if (custom) return `custom/${custom.name}`;
  if (iconEntry(`line/${name}`)) return `line/${name}`;
  if (iconEntry(`logo/${name}`)) return `logo/${name}`;
  const logo = (loadedSet('logo') ?? []).find((icon) => icon.keywords.includes(name));
  return logo ? `logo/${logo.name}` : null;
}
