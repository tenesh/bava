// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import type { Component } from 'svelte';
import { render, unmount } from '../test/render';
import DatePicker from './DatePicker.svelte';
import EmojiPicker from './EmojiPicker.svelte';
import EquationField from './EquationField.svelte';
import LinkCard from './LinkCard.svelte';

const at = { left: 10, top: 40, bottom: 60 };

// Each floating piece the page opens and may close in the same moment: a
// press elsewhere, the caret moving on, the page losing focus.
const PIECES: [string, Component<any>, Record<string, unknown>][] = [ // eslint-disable-line @typescript-eslint/no-explicit-any
  ['.equation-field', EquationField, { at, value: 'x^2', display: true, render: vi.fn(), onSave: vi.fn(), onCancel: vi.fn() }],
  ['.emoji-picker', EmojiPicker, { at, emojis: [], groupLabel: (slug: string) => slug, onPick: vi.fn(), onClose: vi.fn() }],
  [
    '.link-card',
    LinkCard,
    { at, href: 'Roadmap.md', missing: false, relinkName: null, onOpen: vi.fn(), onEdit: vi.fn(), onRemove: vi.fn(), onRelink: vi.fn(), onClose: vi.fn() },
  ],
  ['.date-picker', DatePicker, { at, value: '2026-10-02', onPick: vi.fn(), onClose: vi.fn() }],
];

const settled = () => new Promise<void>((resolve) => setTimeout(resolve, 20));

describe('the floating pieces', () => {
  it.each(PIECES)('%s is drawn above the window while it is open', async (selector, piece, props) => {
    render(piece, props);
    await settled();
    expect(document.querySelectorAll(selector)).toHaveLength(1);
  });

  it.each(PIECES)('%s closed as it opens leaves nothing behind', async (selector, piece, props) => {
    const { app } = render(piece, props);
    unmount(app);
    await settled();
    expect(document.querySelectorAll(selector)).toHaveLength(0);
  });
});
