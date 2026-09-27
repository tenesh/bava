/**
 * One keycap per key in a formatted shortcut.
 *
 * macOS writes modifiers as symbols run together before the key ("⇧⌘O");
 * elsewhere they are names joined by "+" ("Ctrl+Shift+O"). A key that is
 * itself "+" survives either way.
 */
const MAC_MODIFIERS = new Set(['⌃', '⌥', '⇧', '⌘']);

export function keycaps(keys: string): string[] {
  if (keys === '') return [];
  if (keys.length > 1 && keys.includes('+')) {
    const plus = keys.endsWith('++');
    const parts = (plus ? keys.slice(0, -2) : keys).split('+').filter((part) => part !== '');
    return plus ? [...parts, '+'] : parts;
  }
  const caps: string[] = [];
  let rest = keys;
  while (rest.length > 1 && MAC_MODIFIERS.has(rest[0])) {
    caps.push(rest[0]);
    rest = rest.slice(1);
  }
  return [...caps, rest];
}
