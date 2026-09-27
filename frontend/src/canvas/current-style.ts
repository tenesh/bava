/**
 * The style a new element takes: what was last chosen in the toolbar, as
 * Excalidraw's `currentItem*` (`excalidraw/appState.ts:33-45`). Per viewer and
 * per session, held in memory: it is not document state, and nothing of it is
 * written anywhere but into the elements it styles.
 *
 * It starts with arrows curved and lines round, as Excalidraw's do. A value
 * equal to its file-format default is written as
 * nothing, so an element carries only what differs from an absent key.
 */
import type { SceneElement } from './scene';
import { defaultFor, fontSizeFor, propertyKeysFor, styleKeysFor, type PropertyKey, type PropertyValue, type SizeScale, type StyleKey } from './style';

type Key = StyleKey | PropertyKey;
type ElementType = SceneElement['type'];

/** What each kind starts with before anything is chosen. */
const INITIAL: Partial<Record<ElementType, Partial<Record<Key, PropertyValue>>>> = {
  arrow: { arrowType: 'arc' },
  line: { edges: 'round' },
};

/**
 * Keys never carried to a new element: a code block's language is its own,
 * and a label's direction means nothing on an arrow drawn without one.
 */
const OWN: Key[] = ['language', 'labelDirection'];

export function createCurrentStyle() {
  // A key chosen back to the theme's default is remembered as null, so the
  // initial value does not return.
  const chosen = new Map<Key, PropertyValue | null>();
  // The scale a remembered size was chosen from (code sizes or text sizes).
  let sizeScale: SizeScale = 'text';

  return {
    /** A choice made in the toolbar; null clears a colour back to the theme's. */
    remember(key: Key, value: PropertyValue | null, scale: SizeScale = 'text'): void {
      if (key === 'fontSize') sizeScale = scale;
      if (OWN.includes(key)) return;
      // Turning something into a line says nothing about the next arrow.
      if (key === 'arrowType' && value === 'line') return;
      chosen.set(key, value);
    },

    /** The keys a new element of `type` is written with. */
    for(type: ElementType): Record<string, PropertyValue> {
      const takes = new Set<Key>([...styleKeysFor(type), ...propertyKeysFor(type)]);
      // A line has no kind of its own to write: its picker entry converts it.
      if (type === 'line') takes.delete('arrowType');
      const values = new Map<Key, PropertyValue | null>(Object.entries(INITIAL[type] ?? {}) as [Key, PropertyValue][]);
      for (const [key, value] of chosen) values.set(key, value);
      const out: Record<string, PropertyValue> = {};
      for (const [key, raw] of values) {
        if (!takes.has(key) || raw === null) continue;
        // A size by its step on this kind's scale (text or code).
        const value = key === 'fontSize' ? fontSizeFor(type, raw, sizeScale) : raw;
        if (defaultFor(key as PropertyKey, type) === value) continue;
        out[key] = value;
      }
      return out;
    },
  };
}

export type CurrentStyle = ReturnType<typeof createCurrentStyle>;
