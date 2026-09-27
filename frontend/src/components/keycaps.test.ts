import { describe, expect, it } from 'vitest';
import { keycaps } from './keycaps';

describe('keycaps', () => {
  it.each([
    ['⇧⌘O', ['⇧', '⌘', 'O']],
    ['⌘,', ['⌘', ',']],
    ['⌘Enter', ['⌘', 'Enter']],
    ['⌃⌥⇧⌘Z', ['⌃', '⌥', '⇧', '⌘', 'Z']],
    ['Ctrl+Shift+O', ['Ctrl', 'Shift', 'O']],
    ['Alt+S', ['Alt', 'S']],
    ['Ctrl+-', ['Ctrl', '-']],
    ['Ctrl++', ['Ctrl', '+']],
    ['+', ['+']],
    ['V', ['V']],
    ['⌫', ['⌫']],
    ['', []],
  ])('splits %s into one cap per key', (keys, caps) => {
    expect(keycaps(keys)).toEqual(caps);
  });
});
