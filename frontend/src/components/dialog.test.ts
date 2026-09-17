// @vitest-environment jsdom
import { describe, expect, it, afterEach } from 'vitest';
import { compile } from 'sass';
import { PORTAL_ROOT_ID, portalRoot } from './portal-root';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('portal root', () => {
  it('lives outside the app root', () => {
    const app = document.createElement('div');
    app.id = 'app';
    document.body.append(app);

    const root = portalRoot();

    expect(root.closest('#app')).toBeNull();
    expect(root.parentElement).toBe(document.body);
  });

  it('is created once and reused', () => {
    expect(portalRoot()).toBe(portalRoot());
    expect(document.querySelectorAll(`#${PORTAL_ROOT_ID}`)).toHaveLength(1);
  });
});

describe('portal stacking', () => {
  // jsdom does not paint, so paint order cannot be asserted here. What can be
  // asserted is that the rule exists and resolves from the token, which is
  // the thing that was missing when the spike found Ark content rendering
  // below ordinary app chrome.
  // Relative to the vitest root, not import.meta.url: under jsdom that is not
  // a file: URL and sass cannot resolve it.
  const css = compile('src/styles/index.scss', { style: 'expanded' }).css;

  it('gives the portal root the portal layer', () => {
    const rule = css.match(new RegExp(`#${PORTAL_ROOT_ID}\\s*\\{[^}]*\\}`));
    expect(rule, 'no stylesheet rule targets the portal root').not.toBeNull();
    expect(rule![0]).toContain('var(--z-portal)');
  });

  // The whole point of the layer: it has to beat app chrome, not merely exist.
  it('stacks the portal layer above every chrome layer', () => {
    const value = (name: string) =>
      Number(css.match(new RegExp(`--z-${name}:\\s*(\\d+)`))![1]);
    expect(value('portal')).toBeGreaterThan(value('floating'));
    expect(value('portal')).toBeGreaterThan(value('chrome'));
    expect(value('portal')).toBeGreaterThan(value('canvas'));
  });
});
