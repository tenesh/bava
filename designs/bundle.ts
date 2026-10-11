/**
 * Bava's styles as the design system's one stylesheet.
 *
 * The shared styles (the compiled global stylesheet without its token
 * blocks) stay as they are: they already style the `bava-*` classes. Each
 * component's own `<style>`, which the app's compiler scopes, is nested here
 * under a wrapper class `bv-<component>` instead, so a preview or a mockup
 * draws a component by wrapping its markup in that class. The wrapper takes
 * no box. Unlike the app's scoping, a wrapper's rules also reach components
 * nested inside it, and content a parent passes into a dialog keeps the
 * parent's styles, as in the app.
 */

export type Component = { name: string; source: string; path: string };

const kebab = (name: string) => name.replace(/(?<!^)(?=[A-Z])/g, '-').toLowerCase();

/** `:global(x)` becomes `x`, parentheses inside it kept. */
function unwrapGlobal(css: string): string {
  let out = '';
  let i = 0;
  for (;;) {
    const at = css.indexOf(':global(', i);
    if (at < 0) return out + css.slice(i);
    out += css.slice(i, at);
    let k = at + ':global('.length;
    const start = k;
    for (let depth = 1; depth > 0; k += 1) {
      if (css[k] === '(') depth += 1;
      else if (css[k] === ')') depth -= 1;
    }
    out += css.slice(start, k - 1);
    i = k;
  }
}

/** Keyframes cannot sit inside a nested rule: they are lifted out, names freed of `-global-`. */
function liftKeyframes(css: string): { rest: string; frames: string[] } {
  const frames: string[] = [];
  let rest = '';
  let i = 0;
  for (;;) {
    const at = css.indexOf('@keyframes', i);
    if (at < 0) return { rest: rest + css.slice(i), frames };
    rest += css.slice(i, at);
    let k = css.indexOf('{', at) + 1;
    for (let depth = 1; depth > 0; k += 1) {
      if (css[k] === '{') depth += 1;
      else if (css[k] === '}') depth -= 1;
    }
    frames.push(css.slice(at, k).replace('-global-', ''));
    i = k;
  }
}

/** A `:root` block that only declares tokens (and the colour scheme). */
const onlyTokens = (body: string) =>
  body
    .split(';')
    .map((d) => d.trim())
    .filter(Boolean)
    .every((d) => d.startsWith('--') || d.startsWith('color-scheme'));

/**
 * The stylesheet: `remainder` (the values tokens.json cannot hold) first,
 * then the shared styles from `global`, then each component nested under its
 * wrapper. Returns the wrappers' class names too.
 */
export function bundleFrom(global: string, components: Component[], remainder: string): { css: string; wrappers: string[] } {
  const shared = global
    .replace(/:root(?:\[data-theme=["']?dark["']?\])?\s*\{([^{}]*)\}/g, (block, body: string) => (onlyTokens(body) ? '' : block))
    .replaceAll(':root[data-theme=dark]', '[data-theme="dark"]');
  const parts = [remainder.trimEnd(), "/* ---- Shared styles: the app's global stylesheet ---- */", shared];
  const wrappers: string[] = [];
  for (const component of components) {
    const style = /<style>([\s\S]*?)<\/style>/.exec(component.source);
    if (!style) continue;
    const { rest, frames } = liftKeyframes(unwrapGlobal(style[1].replace(/\/\*[\s\S]*?\*\//g, '')));
    const wrapper = `bv-${kebab(component.name)}`;
    wrappers.push(wrapper);
    parts.push(`/* ---- ${component.name} (${component.path}) ---- */`, `.${wrapper} { display: contents; }`, `.${wrapper} {${rest}}`, ...frames);
  }
  const css = parts.join('\n').replaceAll(':root[data-theme=dark]', '[data-theme="dark"]');
  if (/<\/style/i.test(css)) throw new Error('bundle.css would end an inline <style> element');
  return { css, wrappers };
}
