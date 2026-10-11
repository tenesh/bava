/**
 * Bava's tokens, read from its compiled global stylesheet, in the design
 * system's format: `tokens.json`, the `tokens.css` built from it, and what the
 * format cannot hold (component sizes, motion, opacity, aliases), kept for
 * the stylesheet per theme.
 */

type Themed = string | { light: string; dark?: string };
type Token = { name: string; value: Themed; usage: string };
type Family = { tokens: Token[] };
type Style = { name: string; fontSize: string; fontWeight: number; lineHeight: number; letterSpacing?: string; family?: string; usage: string; sample: string };

export type Tokens = {
  json: {
    name: string;
    version: number;
    color: { themes: { id: string; name: string }[]; tokens: Token[] };
    type: { fonts: { family: string; file: string; weight: string; style: string }[]; families: Record<string, string>; groups: { name: string; family: string; styles: Style[] }[] };
    spacing: Family;
    radius: Family;
    shadow: Family;
    fontSize: Family;
    lineHeight: Family;
    fontWeight: Family;
    letterSpacing: Family;
    zIndex: Family;
  };
  css: string;
  remainder: string;
};

const COLOR_USAGE: Record<string, string> = {
  'color-surface': 'The window and the page: the ground everything sits on.',
  'color-surface-raised': 'Cards, inputs and anything raised off the surface.',
  'color-surface-sunken': 'Tracks and wells: a segmented control, a quiet field, a code panel.',
  'color-surface-overlay': 'Menus, popovers and dialogs.',
  'color-surface-nav': 'The side panel, the title bar and the status bar.',
  'color-border-subtle': 'Hairline dividers between regions and rows.',
  'color-border-strong': 'Control outlines: buttons, fields, the chosen segment.',
  'color-border-hairline': 'The faintest rule, inside dense lists.',
  'color-text-primary': 'Titles and the strongest text, on every surface.',
  'color-text-secondary': 'Body and control text on surface, surface-nav and surface-overlay.',
  'color-text-muted': 'Meta: sizes, dates, paths, counts, labels, captions.',
  'color-text-faint': 'Idle icons; never for text that must be read.',
  'color-text-prose': "A page's body copy: a step softer than text-primary.",
  'color-accent': 'The ink: the primary button, the chosen tool, handles and guides. Equals text-primary.',
  'color-accent-contrast': 'Text and icons on accent.',
  'color-accent-subtle': 'A row under the pointer.',
  'color-selection': 'A chosen row, selected text and selected cells: a full fill.',
  'color-focus-ring': 'The focus ring: 1px of ink.',
  'color-focus-halo': 'The 2px halo round the focus ring.',
  'color-danger': 'Deletes and errors only.',
  'color-danger-subtle': 'The wash behind a destructive row or message.',
  'color-danger-active': 'A destructive control pressed.',
  'color-control-hover': 'A control under the pointer: a wash of ink over its surface.',
  'color-control-active': 'A control pressed.',
  'color-accent-hover': 'The primary button under the pointer.',
  'color-accent-active': 'The primary button pressed.',
  'color-placeholder': "A field's placeholder.",
  'color-segment-chosen': 'The chosen segment of a segmented control.',
  'color-ok': 'Saved: the title bar state once a page is written.',
  'color-pending': 'Unsaved: the dot before the title bar state.',
  'color-backdrop': 'The scrim behind a dialog.',
  'color-canvas-bg': "The canvas's ground.",
  'color-canvas-dot': "The canvas's dot grid.",
  'color-note-fill': 'A sticky note on the canvas.',
  'color-note-border': "A sticky note's edge.",
  'color-mark': 'The panda mark: paper, always.',
  'color-mark-tile': "The mark's ink tile on a light ground; transparent on dark.",
  'color-diagram-bg': "A diagram's ground (passed to the diagram renderer too).",
  'color-code-surface': "A code block's panel.",
};

const COLOR = /^(?:#[0-9a-fA-F]{3,8}|(?:rgba?|hsla?)\([0-9., %]+\))$/;

/** The custom properties declared under `:root` and under the dark theme. */
function declarations(css: string): { light: Map<string, string>; dark: Map<string, string> } {
  const light = new Map<string, string>();
  const dark = new Map<string, string>();
  for (const block of css.matchAll(/(:root(?:\[data-theme=["']?dark["']?\])?)\s*\{([^{}]*)\}/g)) {
    const into = block[1].includes('dark') ? dark : light;
    for (const decl of block[2].matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
      const value = decl[2].replace(/\s+/g, ' ').trim();
      // The one named colour the stylesheet uses: the format takes no names.
      into.set(decl[1], value === 'transparent' ? 'rgba(0, 0, 0, 0)' : value);
    }
  }
  return { light, dark };
}

/**
 * The tokens in `css`, a compiled stylesheet. `notes` gives each token the
 * comment its source carries, by name; a colour without one has a written
 * usage here.
 */
export function tokensFrom(css: string, notes: Map<string, string> = new Map()): Tokens {
  const { light, dark } = declarations(css);
  const named = (prefix: string) => [...light].filter(([name]) => name.startsWith(prefix));
  const usage = (name: string, fallback: string) => notes.get(name) ?? fallback;

  const colors: Token[] = [];
  for (const [name, value] of light) {
    if (!/^(color|syntax|swatch)-/.test(name) || !COLOR.test(value)) continue;
    const darkValue = dark.get(name);
    let note: string;
    if (name.startsWith('syntax-')) note = `Code: ${name.slice('syntax-'.length)} runs in a code block, on color-code-surface.`;
    else if (name.startsWith('swatch-')) {
      const [, swatch, part] = name.split('-');
      note = `The ${swatch} shape colour's ${part}${part === 'text' ? ': text on its fill.' : '.'}`;
    } else if (name.startsWith('color-diagram-') && !COLOR_USAGE[name]) {
      note = `A diagram's ${name.slice('color-diagram-'.length).replaceAll('-', ' ')}.`;
    } else note = COLOR_USAGE[name] ?? usage(name, name);
    colors.push({ name, value: darkValue && COLOR.test(darkValue) ? { light: value.toLowerCase(), dark: darkValue.toLowerCase() } : { light: value.toLowerCase() }, usage: note });
  }

  const family = (pairs: [string, string][], fallback: string): Family => ({ tokens: pairs.map(([name, value]) => ({ name, value, usage: usage(name, fallback) })) });
  const spacing = family([...named('space-'), ...named('border-width')], 'Gaps and padding on the 4px unit.');
  const radius = family(named('radius-'), 'Corners.');
  const shadow: Family = {
    tokens: named('shadow-')
      .filter(([, value]) => !value.includes('var('))
      .map(([name, value]) => ({ name, value: dark.has(name) ? { light: value, dark: dark.get(name)! } : value, usage: usage(name, 'Only what floats casts a shadow.') })),
  };
  const others = {
    fontSize: family(named('text-'), 'A type size.'),
    lineHeight: family(named('leading-'), 'Line height.'),
    fontWeight: family(named('weight-'), 'Weight.'),
    letterSpacing: family(named('tracking-'), 'Tracking.'),
    zIndex: family(named('z-'), 'A stacking layer; never a raw z-index.'),
  };

  const at = (name: string, fallback: string) => light.get(name) ?? fallback;
  const lead = (name: string, fallback: number) => Number(light.get(name) ?? fallback);
  const style = (name: string, size: string, weight: number, lineHeight: number, note: string, sample: string, extra: Partial<Style> = {}): Style => ({
    name: `type-${name}`, fontSize: at(size, '13px'), fontWeight: weight, lineHeight, usage: note, sample, ...extra,
  });
  const mono = at('font-mono', "'Geist Mono', ui-monospace, monospace");
  const type: Tokens['json']['type'] = {
    fonts: [
      { family: 'Geist', file: 'fonts/Geist-Variable.woff2', weight: '100 900', style: 'normal' },
      { family: 'Geist', file: 'fonts/Geist-Italic-Variable.woff2', weight: '100 900', style: 'italic' },
      { family: 'Geist Mono', file: 'fonts/GeistMono-Variable.woff2', weight: '100 900', style: 'normal' },
    ],
    families: { ui: at('font-ui', "'Geist', system-ui, sans-serif"), mono, label: mono, data: mono },
    groups: [
      { name: 'Chrome', family: 'ui', styles: [
        style('wordmark', 'text-wordmark', 600, 1.2, 'The name beside the mark: the start screen, About.', 'Bava', { letterSpacing: at('tracking-wordmark', '0') }),
        style('title-about', 'text-title-about', 600, 1.2, "The About dialog's title.", 'About Bava'),
        style('title', 'text-title', 600, 1.2, "A dialog's title; the start screen's tagline and recent names; a pane with nothing open.", 'Export Space'),
        style('body', 'text-body', 400, 1.45, 'The base: rows, menus, buttons and messages.', 'Pick a page in Files, or make a new one.'),
        style('control', 'text-control', 400, 1.45, 'Inside compact controls and a small empty state.', 'No results'),
        style('note', 'text-note', 400, 1.45, 'Small print in a dialog: a hint at its foot, a licence line.', 'Pages keep their own folders.'),
        style('meta', 'text-meta', 400, 1.45, 'Secondary lines and counts in the chrome.', 'Saved 2 min ago'),
      ] },
      { name: 'Labels and data', family: 'mono', styles: [
        style('label', 'text-label', 600, 1.2, 'Capital section labels: pane headers, groups, menu headings.', 'RECENT SPACES', { letterSpacing: at('tracking-label', '0') }),
        style('mono-source', 'text-mono-source', 400, 1.45, 'Source text and keys in an empty pane.', 'a -> b: writes'),
        style('mono-status', 'text-mono-status', 400, 1.45, 'The status bar and paths.', '/Users/you/Documents/Acme Product'),
        style('mono-chip', 'text-mono-chip', 400, 1.2, 'Sizes and keys in small chips.', '18.0 KB'),
        style('code', 'text-code', 400, lead('leading-code', 1.5), 'A code block on the canvas.', 'func main() {}'),
      ] },
      { name: 'Page', family: 'ui', styles: [
        style('doc-h1', 'text-doc-h1', 600, 1.2, "A page's title and first heading.", 'Roadmap'),
        style('doc-h2', 'text-doc-h2', 600, 1.2, 'A page heading, level 2.', 'This quarter'),
        style('doc-h3', 'text-doc-h3', 600, 1.2, 'A page heading, level 3.', 'Launch plan'),
        style('doc-h4', 'text-doc-h4', 600, 1.2, 'A page heading, level 4.', 'Risks'),
        style('doc-body', 'text-doc-body', 400, lead('leading-prose', 1.6), "A page's reading type, in color-text-prose.", 'A page is read, not scanned like chrome.'),
        style('doc-code', 'text-doc-code', 400, lead('leading-code', 1.5), 'Code in a page.', 'npm run browser', { family: 'mono' }),
      ] },
    ],
  };

  const json: Tokens['json'] = {
    name: 'Bava Design System',
    version: 1,
    color: { themes: [{ id: 'light', name: 'Light' }, { id: 'dark', name: 'Dark' }], tokens: colors },
    type,
    spacing,
    radius,
    shadow,
    ...others,
  };

  // tokens.css, laid out as the design system compiles it from tokens.json.
  const themed = (token: Token, theme: 'light' | 'dark') => (typeof token.value === 'string' ? token.value : (theme === 'dark' && token.value.dark) || token.value.light);
  const plain = [...spacing.tokens, ...radius.tokens, ...Object.values(others).flatMap((f) => f.tokens)];
  const lines = ['/* Bava Design System — generated from tokens.json */', ':root, [data-theme="light"] {'];
  for (const token of [...colors, ...shadow.tokens]) lines.push(`  --${token.name}: ${themed(token, 'light')};`);
  lines.push('}', '[data-theme="dark"] {');
  for (const token of [...colors, ...shadow.tokens]) if (typeof token.value !== 'string' && token.value.dark) lines.push(`  --${token.name}: ${token.value.dark};`);
  lines.push('}', ':root {');
  for (const token of plain) lines.push(`  --${token.name}: ${token.value as string};`);
  for (const [key, stack] of Object.entries(type.families)) lines.push(`  --font-${key}: ${stack};`);
  lines.push('}');
  for (const group of type.groups) {
    for (const s of group.styles) {
      const decl = [`font-family: var(--font-${s.family ?? group.family})`, `font-size: ${s.fontSize}`, `font-weight: ${s.fontWeight}`, `line-height: ${s.lineHeight}`];
      if (s.letterSpacing) decl.push(`letter-spacing: ${s.letterSpacing}`);
      lines.push(`.${s.name} { ${decl.join('; ')}; }`);
    }
  }
  for (const font of type.fonts) {
    lines.push(`@font-face { font-family: '${font.family}'; src: url('${font.file}') format('woff2'); font-weight: ${font.weight}; font-style: ${font.style}; font-display: block; }`);
  }

  // What tokens.json holds is declared by tokens.css; the rest stays here.
  const declared = new Set([...colors, ...shadow.tokens, ...plain].map((t) => t.name).concat(Object.keys(type.families).map((k) => `font-${k}`)));
  const rest = (from: Map<string, string>) => [...from].filter(([name]) => !declared.has(name)).map(([name, value]) => `  --${name}: ${value};`);
  const remainder = [
    '/* Values tokens.json cannot hold: component sizes, motion, opacity, aliases. */',
    ':root {', '  color-scheme: light;', ...rest(light), '}',
    '[data-theme="dark"] {', '  color-scheme: dark;', ...rest(dark), '}',
  ].join('\n');

  return { json, css: `${lines.join('\n')}\n`, remainder: `${remainder}\n` };
}
