import { describe, expect, it } from 'vitest';
import { t } from './t';
import { messages } from './messages';

describe('t', () => {
  it('returns the message for a key', () => {
    expect(t('pane.source')).toBe('D2 source');
    expect(t('pane.canvas')).toBe('Diagram');
  });

  // The guard is the key type, not a runtime fallback. A missing key must fail
  // to compile, because a string that silently renders its own key is how
  // untranslated text ships.
  it('rejects an unknown key at compile time', () => {
    // @ts-expect-error - 'nope.not.a.key' is not a MessageKey
    expect(() => t('nope.not.a.key')).not.toThrow();
  });

  it('has no empty messages', () => {
    // An empty string renders as nothing and looks like a layout bug.
    expect(Object.entries(messages).filter(([, v]) => v.trim() === '')).toEqual([]);
  });
});
