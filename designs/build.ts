/**
 * Builds the Bava Design System's files from the app's code into
 * `designs/out/project/`: `tokens.json`, `tokens.css`, `components/bundle.css`
 * and the fonts. Run it with `npm run design` in `frontend/` after a token or
 * a component's styles change, then publish the files to the design system.
 */
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundleFrom, type Component } from './bundle.ts';
import { tokensFrom } from './tokens.ts';

const repo = fileURLToPath(new URL('..', import.meta.url));
const out = join(repo, 'designs/out/project');
// The compilers are the frontend's own, at the versions it builds with.
const frontendRequire = createRequire(join(repo, 'frontend/package.json'));
const sass = frontendRequire('sass') as { compile(path: string, options: object): { css: string } };
const lightning = frontendRequire('lightningcss') as { transform(options: object): { warnings: { message: string }[] } };

const styles = join(repo, 'frontend/src/styles');
const global = sass.compile(join(styles, 'index.scss'), { loadPaths: [styles], style: 'expanded' }).css;

// The comment above each token in its source, as its usage note.
const notes = new Map<string, string>();
for (const file of readdirSync(join(styles, 'tokens')).filter((f) => f.endsWith('.scss'))) {
  let pending: string[] = [];
  for (const line of readFileSync(join(styles, 'tokens', file), 'utf8').split('\n')) {
    const text = line.trim();
    if (text.startsWith('//')) {
      pending.push(text.slice(2).trim());
      continue;
    }
    const declared = /^(?:--([\w-]+)|\$l-([\w-]+))\s*:/.exec(text);
    if (declared && pending.length > 0) {
      const name = declared[1] ?? `color-${declared[2]}`;
      if (!notes.has(name)) notes.set(name, pending.join(' '));
    }
    pending = [];
  }
}

const tokens = tokensFrom(global, notes);

const sources = ['frontend/src/components', 'frontend/src/shell', 'frontend/src/settings']
  .flatMap((dir) => readdirSync(join(repo, dir)).filter((f) => f.endsWith('.svelte')).sort().map((f) => join(repo, dir, f)))
  .concat([join(repo, 'frontend/src/docs/DocumentPane.svelte'), join(repo, 'frontend/src/App.svelte')]);
const components: Component[] = sources.map((path) => ({
  name: path.slice(path.lastIndexOf('/') + 1, -'.svelte'.length),
  source: readFileSync(path, 'utf8'),
  path: relative(repo, path),
}));
const bundle = bundleFrom(global, components, tokens.remainder);

const warnings = lightning.transform({ filename: 'bundle.css', code: Buffer.from(bundle.css), errorRecovery: true }).warnings;
if (warnings.length > 0) throw new Error(`bundle.css does not parse cleanly: ${warnings.map((w) => w.message).join('; ')}`);

mkdirSync(join(out, 'components'), { recursive: true });
mkdirSync(join(out, 'fonts'), { recursive: true });
writeFileSync(join(out, 'tokens.json'), `${JSON.stringify(tokens.json, null, 2)}\n`);
writeFileSync(join(out, 'tokens.css'), tokens.css);
writeFileSync(join(out, 'components/bundle.css'), bundle.css);
for (const font of readdirSync(join(repo, 'frontend/public/fonts'))) {
  copyFileSync(join(repo, 'frontend/public/fonts', font), join(out, 'fonts', font));
}
console.log(`${tokens.json.color.tokens.length} colours, ${bundle.wrappers.length} components: ${relative(repo, out)}`);
