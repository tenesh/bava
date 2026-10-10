// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render } from '../test/render';
import TagChip from './TagChip.svelte';

describe('TagChip', () => {
  // A tag reads #launch, but the # is drawn, not part of its name: the file
  // keeps `launch`, and a screen reader says "launch".
  it('shows a # before the tag, hidden from screen readers', () => {
    const { target } = render(TagChip, { tag: 'launch' });
    const chip = target.querySelector<HTMLElement>('.tag-chip')!;
    expect(chip.textContent?.trim()).toBe('#launch');
    const hash = chip.querySelector('.hash')!;
    expect(hash.textContent).toBe('#');
    expect(hash.getAttribute('aria-hidden')).toBe('true');
  });
});
