// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';
import Mark from './Mark.svelte';

let mounted: ReturnType<typeof mount> | undefined;

function render(props: { size: 'chrome' | 'brand' | 'hero' | 'about'; label?: string }) {
  const target = document.createElement('div');
  document.body.append(target);
  mounted = flushSync(() => mount(Mark, { target, props }));
  return target;
}

afterEach(() => {
  if (mounted) unmount(mounted);
  mounted = undefined;
  document.body.innerHTML = '';
});

describe('Mark', () => {
  // Inlined, never loaded by URL: an <img> cannot take its colour from a
  // token, and the mark's colour is the brand rule.
  it('renders one svg path and no img', () => {
    const target = render({ size: 'brand' });
    expect(target.querySelectorAll('svg path')).toHaveLength(1);
    expect(target.querySelector('path')?.getAttribute('fill')).toBe('currentColor');
    expect(target.querySelector('path')?.getAttribute('fill-rule')).toBe('evenodd');
    expect(target.querySelector('img')).toBeNull();
  });

  it('is hidden from assistive tech without a label, named with one', () => {
    const decorative = render({ size: 'brand' });
    expect(decorative.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    unmount(mounted!);
    mounted = undefined;

    const named = render({ size: 'chrome', label: 'Bava' });
    const svg = named.querySelector('svg');
    expect(svg?.getAttribute('role')).toBe('img');
    expect(svg?.getAttribute('aria-label')).toBe('Bava');
    expect(svg?.hasAttribute('aria-hidden')).toBe(false);
  });

  // The drawing is not square. Setting both dimensions would stretch it,
  // which the handover lists first among misuses.
  it('does not stretch: height is set, width is not', () => {
    const target = render({ size: 'hero' });
    const svg = target.querySelector('svg')!;
    expect(svg.getAttribute('viewBox')).toBe('0 0 992.6 1009');
    expect(svg.hasAttribute('width')).toBe(false);
    expect(svg.getAttribute('preserveAspectRatio')).toBeNull();
    expect(target.querySelector('.mark')?.getAttribute('data-size')).toBe('hero');
    // Width follows from the drawing's own ratio. Without it a flex item's
    // SVG can take the 300px default width and the tile becomes a bar.
    expect(svg.style.aspectRatio.replace(/\s/g, '')).toBe('992.6/1009');
  });
});
