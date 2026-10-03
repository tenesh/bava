// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render } from '../test/render';
import Splash from './Splash.svelte';

describe('Splash', () => {
  it('says it is busy, with a bar that claims no progress and the status it is given', () => {
    const { target } = render(Splash, { status: 'Starting' });
    expect(target.querySelector('[data-part="splash"]')?.getAttribute('aria-busy')).toBe('true');
    expect(target.querySelector('[role="progressbar"]')?.hasAttribute('aria-valuenow')).toBe(false);
    expect(target.textContent).toContain('Starting');
  });
});
