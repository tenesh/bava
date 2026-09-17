// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { markPlatform } from './platform';

describe('markPlatform', () => {
  // Stylesheets key platform chrome (the macOS traffic-light inset) off this
  // attribute, set before the first paint.
  it('records the platform on the root element', () => {
    markPlatform(document, 'darwin');
    expect(document.documentElement.dataset.platform).toBe('darwin');
    markPlatform(document, 'windows');
    expect(document.documentElement.dataset.platform).toBe('windows');
  });
});
