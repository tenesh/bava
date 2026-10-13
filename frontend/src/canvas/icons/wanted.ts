/** The bundled sets a scene's icons need, to load before they can draw. */
import type { SceneElement } from '../scene';
import { loadSet, parseIconName, type BundledSet } from './sets';

export function setsWanted(elements: SceneElement[]): BundledSet[] {
  const sets = new Set<BundledSet>();
  for (const element of elements) {
    if (element.type !== 'icon') continue;
    const set = parseIconName(element.icon)?.set;
    if (set && set !== 'custom') sets.add(set);
  }
  return [...sets];
}

/**
 * Every set the elements need, loaded: for a drawing made away from the open
 * canvas (an export, a page's picture). A set that cannot load leaves its
 * icons drawn as missing rather than stopping the drawing.
 */
export async function iconsReady(elements: SceneElement[]): Promise<void> {
  await Promise.allSettled(setsWanted(elements).map(loadSet));
}
