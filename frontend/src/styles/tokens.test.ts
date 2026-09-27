import { describe, expect, it } from 'vitest';
import { compile } from 'sass';
import { fileURLToPath } from 'node:url';
import { SWATCHES } from '../canvas/palette';
import { RUN_KINDS } from '../canvas/code/highlight';

// Compiled directly rather than read from dist/: the production build minifies
// #ffffff to #fff, and a token test that depends on minifier behaviour tests
// the wrong thing.
const css = compile(fileURLToPath(new URL('./index.scss', import.meta.url)), {
  style: 'expanded',
}).css;

// Every partial emits its own rule, so a selector appears many times and all
// of its blocks have to be collected; reading only the first silently tests
// one file and passes.
function block(selector: string): string {
  const out: string[] = [];
  let from = 0;
  for (;;) {
    const start = css.indexOf(`${selector} {`, from);
    if (start === -1) break;
    const end = css.indexOf('}', start);
    out.push(css.slice(start, end));
    from = end;
  }
  return out.join('\n');
}

function propsIn(selector: string): string[] {
  return [...block(selector).matchAll(/^\s*(--[a-z0-9-]+):/gm)].map((m) => m[1]);
}

// Sass emits the attribute selector unquoted regardless of how it is written.
const light = propsIn(':root');
const dark = propsIn(':root[data-theme=dark]');

describe('token emission', () => {
  it('emits tokens on :root', () => {
    expect(light.length).toBeGreaterThan(50);
  });

  // The most likely mistake here: adding a light value and
  // forgetting the dark one. Every colour token must exist in both themes.
  it('defines every colour token in both themes', () => {
    const lightColours = light.filter((p) => p.startsWith('--color-'));
    const missing = lightColours.filter((p) => !dark.includes(p));
    expect(missing).toEqual([]);
    expect(lightColours.length).toBeGreaterThan(30);
  });

  it('does not define a dark colour token that has no light counterpart', () => {
    const orphans = dark.filter((p) => p.startsWith('--color-') && !light.includes(p));
    expect(orphans).toEqual([]);
  });

  // Names come from the design sheet. Pinning them means a rename is a
  // deliberate act rather than a typo that silently breaks a component.
  it('matches the design sheet token names', () => {
    for (const name of [
      'surface',
      'surface-raised',
      'surface-sunken',
      'surface-overlay',
      'surface-nav',
      'border-subtle',
      'border-strong',
      'border-hairline',
      'text-primary',
      'text-secondary',
      'text-muted',
      'text-faint',
      'accent',
      'accent-contrast',
      'accent-subtle',
      'selection',
      'focus-ring',
      'danger',
      'danger-subtle',
      'ok',
      'backdrop',
      'canvas-bg',
      'canvas-dot',
      'note-fill',
      'note-border',
      'diagram-bg',
      'diagram-container-fill',
      'diagram-node-fill',
      'diagram-node-stroke',
      'diagram-label',
      'diagram-edge',
      'diagram-edge-label',
      'find-match',
      'find-match-active',
    ]) {
      expect(light, `--color-${name} missing`).toContain(`--color-${name}`);
    }
  });

  // The brand rule "paper on ink, always" lives in two values: the mark is
  // paper in both themes, and on a light ground it brings its own ink tile.
  it('the mark is paper in both themes', () => {
    expect(block(':root')).toContain('--color-mark: #e6e6e3');
    expect(block(':root[data-theme=dark]')).toContain('--color-mark: #e6e6e3');
  });

  it('the mark has an ink tile on light and none on dark', () => {
    expect(block(':root')).toContain('--color-mark-tile: #131416');
    expect(block(':root[data-theme=dark]')).toContain('--color-mark-tile: transparent');
  });

  // Fading the tile on a light ground makes a mid-grey ground, which the brand
  // forbids. Only the bare dark-theme mark fades.
  it('fades the empty-state mark only where it has no tile', () => {
    expect(block(':root')).toContain('--opacity-mark-faded: 1');
    expect(block(':root[data-theme=dark]')).toContain('--opacity-mark-faded: 0.32');
  });

  // The hidden-inset title bar draws the traffic lights over the page. On
  // macOS the title bar must start after them; elsewhere it must not.
  it('insets the title bar for the traffic lights on macOS only', () => {
    expect(block(':root')).toMatch(/--size-titlebar-inset-start: 0(px)?;/);
    expect(block(':root[data-platform=darwin]')).toMatch(/--size-titlebar-inset-start: [1-9]\d*px/);
  });

  // Shape colours are stored by swatch name; the values are tokens, so each
  // swatch must resolve in both themes or a shape goes colourless on a switch.
  it('every swatch defines fill, stroke and text in both themes', () => {
    for (const swatch of SWATCHES) {
      for (const part of ['fill', 'stroke', 'text']) {
        const name = `--swatch-${swatch}-${part}`;
        expect(light, `${name} missing in light`).toContain(name);
        expect(dark, `${name} missing in dark`).toContain(name);
      }
    }
  });

  it('defines the default shape colours and the selection handle', () => {
    for (const name of ['--color-shape-fill', '--color-shape-stroke', '--color-shape-text', '--color-selection-handle']) {
      expect(light).toContain(name);
      expect(dark).toContain(name);
    }
  });

  it('carries the design palette values verbatim', () => {
    expect(block(':root')).toContain('--color-surface: #f7f7f5');
    expect(block(':root')).toContain('--color-accent: #2f6ba3');
    expect(block(':root[data-theme=dark]')).toContain('--color-surface: #191a1c');
    expect(block(':root[data-theme=dark]')).toContain('--color-accent: #7fabd9');
  });

  it('emits the non-colour scales', () => {
    for (const p of [
      '--space-1',
      '--space-12',
      '--size-titlebar',
      '--text-body',
      '--radius-md',
      '--shadow-overlay',
      '--duration-base',
      '--z-portal',
    ]) {
      expect(light, `${p} missing`).toContain(p);
    }
  });

  // Ark ships no z-index of its own; portalled content paints below ordinary
  // chrome without one. This is the token that fixes it, so the ordering is
  // asserted rather than left to a reader's care.
  it('stacks portals above chrome', () => {
    const z = (name: string) => Number(block(':root').match(new RegExp(`--z-${name}: (\\d+)`))![1]);
    expect(z('portal')).toBeGreaterThan(z('floating'));
    expect(z('floating')).toBeGreaterThan(z('chrome'));
    expect(z('toast')).toBeGreaterThan(z('portal'));
  });

  it('zeroes durations under prefers-reduced-motion', () => {
    expect(css).toContain('prefers-reduced-motion: reduce');
  });
});

describe('type tokens', () => {
  // Fonts are bundled, not assumed present. A desktop app cannot rely on a
  // system font, and the same rule is what keeps text measurement consistent
  // across platforms.
  it('declares the bundled faces', () => {
    // Sass normalises single quotes to double in its output, so the assertion
    // is quote-agnostic rather than matching how the source happens to be
    // written.
    expect(css).toMatch(/font-family:\s*["']Geist["']/);
    expect(css).toMatch(/font-family:\s*["']Geist Mono["']/);
    expect((css.match(/@font-face/g) ?? []).length).toBe(3);
  });

  it('references the bundled files rather than a remote source', () => {
    const urls = [...css.matchAll(/url\(([^)]+)\)/g)].map((m) => m[1]);
    expect(urls.length).toBeGreaterThan(0);
    for (const u of urls) {
      expect(u, `${u} is not a local font`).toMatch(/^['"]?\/fonts\//);
    }
  });

  it('exposes both family stacks as tokens', () => {
    expect(light).toContain('--font-ui');
    expect(light).toContain('--font-mono');
  });
});

// Every kind the tokeniser can produce has a colour, in both themes: a kind
// without one draws as nothing, which reads as missing code.
describe('syntax colours', () => {
  it('has one for every run kind, light and dark', () => {
    const light = propsIn(':root');
    const dark = propsIn(':root[data-theme=dark]');
    for (const kind of RUN_KINDS) {
      expect(light, `light is missing --syntax-${kind}`).toContain(`--syntax-${kind}`);
      expect(dark, `dark is missing --syntax-${kind}`).toContain(`--syntax-${kind}`);
    }
    expect(light).toContain('--color-code-surface');
    expect(dark).toContain('--color-code-surface');
  });
});

// The app divides these by the zoom and hands them to the pointer; a
// token missing from the stylesheet reads as 0, and 0 turns each feature off
// without a word.
describe('the canvas distances the pointer uses', () => {
  const css = compile('src/styles/index.scss', { style: 'expanded' }).css;
  it.each(['--size-point-handle', '--size-point-hit', '--size-bend-insert', '--size-min-linear', '--size-bend-min-segment', '--size-elbow-margin', '--size-line-confirm', '--size-point-handle-editing', '--size-snap-dot', '--size-bent-box-padding', '--size-point-hover', '--size-focus-point', '--size-point-overlap', '--size-label-drag', '--size-code-language-inset', '--size-code-language-clearance'])(
    '%s has a non-zero length',
    (name) => {
      const match = css.match(new RegExp(`${name}:\\s*([0-9.]+)px`));
      expect(match, `${name} is not defined`).not.toBeNull();
      expect(parseFloat(match![1])).toBeGreaterThan(0);
    },
  );
});

// A line is hit within Excalidraw's 0.85 × 8 = 6.8 screen px
// (`App.tsx:6808-6816`), rounded to a whole pixel.
describe('how near a line counts as on it', () => {
  it("is Excalidraw's 6.8 screen px, rounded to 7", () => {
    const css = compile('src/styles/index.scss', { style: 'expanded' }).css;
    expect(css).toMatch(/--size-hit-tolerance:\s*7px/);
  });
});

// The attach highlight's colour in both themes, and its pulse,
// stilled under reduced motion.
describe('the attach highlight tokens', () => {
  const css = compile('src/styles/index.scss', { style: 'expanded' }).css;
  it('has a colour in each theme', () => {
    expect((css.match(/--color-binding-highlight:/g) ?? []).length).toBe(2);
  });
  it('pulses, but not under reduced motion', () => {
    expect(css).toMatch(/--duration-pulse:\s*1200ms/);
    expect(css).toMatch(/prefers-reduced-motion[\s\S]*--duration-pulse:\s*0ms/);
  });
});

// Snapping to objects, Excalidraw's values.
describe('the snapping tokens', () => {
  const css = compile('src/styles/index.scss', { style: 'expanded' }).css;
  it.each([
    ['--size-snap-distance', 8],
    ['--size-snap-guide', 1],
    ['--size-snap-cross', 4],
    ['--size-snap-gap-tick', 16],
    ['--size-snap-gap-mark', 8],
  ])('%s is %ipx', (name, px) => {
    expect(css).toMatch(new RegExp(`${name}:\\s*${px}px`));
  });
  it('has a guide colour in each theme', () => {
    expect((css.match(/--color-snap-guide:/g) ?? []).length).toBe(2);
  });
});

// The Files tree.
describe('the Files tree tokens', () => {
  const css = compile('src/styles/index.scss', { style: 'expanded' }).css;
  it.each([
    ['--size-tree-indent', 14],
    ['--size-tree-drop-line', 2],
    ['--size-settings-nav', 200],
    ['--size-start-width', 560],
    ['--size-menu-gutter', 4],
  ])('%s is %ipx', (name, px) => {
    expect(css).toMatch(new RegExp(`${name}:\\s*${px}px`));
  });
});

// The mockups' shared values: dialog chrome, fields, the side pane, the dot grid.
describe('the mockup tokens', () => {
  const css = compile('src/styles/index.scss', { style: 'expanded' }).css;
  it.each([
    ['--text-title', 15],
    ['--radius-xl', 8],
    ['--size-field', 30],
    ['--size-field-gap', 6],
    ['--size-field-padding', 10],
    ['--size-button-gap', 6],
    ['--size-keycap', 20],
    ['--size-keycap-padding', 5],
    ['--size-keycap-gap', 3],
    ['--size-keycap-edge', 2],
    ['--size-dialog-about', 380],
    ['--text-note', 12],
    ['--text-title-about', 17],
    ['--text-keycap', 11],
    ['--size-side-pane', 264],
    ['--size-row-gap', 6],
    ['--size-unsaved-dot', 6],
    ['--size-space-tile', 20],
    ['--size-space-menu', 280],
    ['--size-space-menu-row', 30],
    ['--radius-mark-tile-hero', 10],
    ['--text-tile', 14],
    ['--text-tile-sm', 11],
    ['--size-canvas-grid', 20],
    ['--size-canvas-dot', 1],
    ['--space-half', 2],
    ['--size-dialog-trash-height', 600],
    ['--size-trash-row', 44],
    ['--size-trash-col-icon', 24],
    ['--size-trash-col-from', 200],
    ['--size-trash-col-deleted', 110],
    ['--size-trash-col-actions', 190],
    ['--size-trash-search', 260],
    ['--size-canvas-grid-min', 12],
    ['--size-handle-border', 1.5],
    ['--radius-handle', 2],
    ['--size-toolbar-divider', 18],
    ['--size-toolbar-divider-inset', 3],
    ['--size-chip-ring', 3],
    ['--size-picker-padding', 10],
    ['--size-swatch-gap', 6],
    ['--text-menu-keys', 10.5],
  ])('%s is %ipx', (name, px) => {
    expect(css).toMatch(new RegExp(`${name}:\\s*${px}px`));
  });

  it.each([
    ['--size-row-xl', 30],
    ['--size-toggle-track', 28],
    ['--size-toggle-thumb', 16],
    ['--size-toggle-dot', 12],
    ['--size-export-preview', 260],
    ['--size-export-settings', 240],
    ['--size-export-checker', 16],
  ])('%s is %ipx', (name, px) => {
    expect(css).toMatch(new RegExp(`${name}:\\s*${px}px`));
  });

  it('sizes Settings, Export and Diagram from code within the window', () => {
    expect(css).toMatch(/--size-settings-width:\s*min\(780px, 90vw\)/);
    expect(css).toMatch(/--size-settings-height:\s*min\(560px, 90vh\)/);
    expect(css).toMatch(/--size-dialog-export:\s*min\(720px, 90vw\)/);
    expect(css).toMatch(/--size-diagram-dialog-width:\s*min\(1160px, 90vw\)/);
    expect(css).toMatch(/--size-diagram-dialog-height:\s*min\(700px, 90vh\)/);
  });

  it('caps the shortcuts list at the window', () => {
    expect(css).toMatch(/--size-dialog-shortcuts-width:\s*min\(960px, 90vw\)/);
    expect(css).toMatch(/--size-dialog-shortcuts-height:\s*min\(640px, 90vh\)/);
  });

  it('caps a dialog\'s height', () => {
    expect(css).toMatch(/--size-dialog-max-height:\s*90vh/);
  });

  it('has a narrow dialog width', () => {
    expect(css).toMatch(/--size-dialog-narrow:\s*min\(520px, 90vw\)/);
  });

  it('gives floating and overlay surfaces a contact shadow in each theme', () => {
    expect((css.match(/--shadow-floating:[^;]*,[^;]*;/g) ?? []).length).toBe(2);
    expect((css.match(/--shadow-overlay:[^;]*,[^;]*;/g) ?? []).length).toBe(2);
    expect((css.match(/--shadow-raised:/g) ?? []).length).toBe(2);
  });
});

// The launch splash, as the mockup draws it.
describe('the splash tokens', () => {
  const css = compile('src/styles/index.scss', { style: 'expanded' }).css;
  it.each([
    ['--size-progress-splash', 220],
    ['--size-progress-splash-thickness', 4],
    ['--radius-mark-tile-splash', 20],
    ['--size-mark-tile-splash-padding', 14],
    ['--size-error-detail-label', 110],
  ])('%s is %ipx', (name, px) => {
    expect(css).toMatch(new RegExp(`${name}:\\s*${px}px`));
  });
});

// The Document: its type scale and page widths, as the mockups draw them.
describe('the document tokens', () => {
  const css = compile('src/styles/index.scss', { style: 'expanded' }).css;
  it.each([
    ['--text-doc-body', 15],
    ['--text-doc-h1', 32],
    ['--text-doc-h2', 23],
    ['--text-doc-h3', 18],
    ['--text-doc-h4', 16],
    ['--text-doc-h5', 14],
    ['--text-doc-h6', 12.5],
    ['--text-doc-code', 13],
    ['--size-page-narrow', 640],
    ['--size-page-wide', 760],
    ['--size-doc-gutter', 56],
    ['--size-todo-box', 14],
    ['--size-quote-rule', 3],
    ['--size-list-indent', 24],
  ])('%s is %spx', (name, px) => {
    expect(css).toMatch(new RegExp(`${name}:\\s*${px}px`));
  });
});
