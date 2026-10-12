/**
 * Bava's shapes read back from the system clipboard.
 *
 * Copy on the canvas puts the selection there as an SVG picture, the copied
 * elements inside it as metadata (`export/svg.ts`, `carry`): other apps see
 * the picture, and Bava, in any window or page, the same elements.
 */
import { CARRIED_ID, CARRIED_VERSION } from './export/svg';
import { ELEMENT_TYPES, type SceneElement } from './scene';

const known = new Set<string>(ELEMENT_TYPES);
const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value);

/** Whether an entry is an element Bava can place: an id, a known type, a place and size. */
function isElement(entry: unknown): entry is SceneElement {
  if (typeof entry !== 'object' || entry === null) return false;
  const e = entry as Record<string, unknown>;
  return typeof e.id === 'string' && known.has(e.type as string) && [e.x, e.y, e.w, e.h, e.z].every(finite);
}

const carried = new RegExp(`<metadata id="${CARRIED_ID}">([\\s\\S]*?)</metadata>`);

const ENTITIES: Record<string, string> = { '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&amp;': '&' };

/** The text as written, its XML entities undone. */
function unescapeXml(text: string): string {
  return text.replace(/&(?:lt|gt|quot|#39|apos|amp);/g, (entity) => ENTITIES[entity]);
}

/**
 * The elements a copied picture carries, as they were copied; null for
 * anything else: plain text, a picture without them, data that is not
 * Bava's or not whole.
 */
export function readCanvasClipboard(text: string): SceneElement[] | null {
  const match = carried.exec(text);
  if (!match) return null;
  let data: unknown;
  try {
    data = JSON.parse(unescapeXml(match[1]));
  } catch {
    return null;
  }
  // Whatever any app put there: a later form, or anything half-formed, is not ours to place.
  const { version, elements } = (data ?? {}) as { version?: unknown; elements?: unknown };
  if (version !== CARRIED_VERSION || !Array.isArray(elements) || elements.length === 0) return null;
  return elements.every(isElement) ? elements : null;
}
