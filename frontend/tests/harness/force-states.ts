/**
 * Forced states for the test page. One pointer and one focus can show a
 * single hovered or focused element at a time; a sheet that shows a
 * component at rest, hovered, focused and pressed side by side marks each
 * cell's element with `data-force="hover"`, `"focus"` or `"active"` instead.
 * Every app rule written for one of those states gets a second selector that
 * matches the mark. Used by `vite.visual.config.ts` only: the app's own
 * build never has it.
 */

const STATES: [RegExp, string][] = [
  [/:hover(?![\w-])/g, 'hover'],
  [/:focus-visible(?![\w-])/g, 'focus'],
  [/:active(?![\w-])/g, 'active'],
];

/**
 * `selector` with each state written as its mark, or null when it has none.
 * A state inside `:not(...)` stays: `:not(:hover)` written as a mark would
 * match every element, under the pointer or not.
 */
export function forced(selector: string): string | null {
  let out = '';
  let plain = '';
  // One entry per open parenthesis: whether it, or one around it, is a `:not(`.
  const open: boolean[] = [];
  const flush = () => {
    out += open.includes(true) ? plain : STATES.reduce((text, [state, name]) => text.replace(state, `[data-force~="${name}"]`), plain);
    plain = '';
  };
  for (let i = 0; i < selector.length; i += 1) {
    const char = selector[i];
    if (char === '(') {
      flush();
      open.push(selector.slice(0, i).endsWith(':not'));
      out += char;
    } else if (char === ')' && open.length > 0) {
      flush();
      open.pop();
      out += char;
    } else {
      plain += char;
    }
  }
  flush();
  return out === selector ? null : out;
}

type Rule = { selectors: string[] };

/** A PostCSS plugin: one pass over every rule, adding the marked selectors. */
export const forceStates = {
  postcssPlugin: 'bava-force-states',
  Once(root: { walkRules(visit: (rule: Rule) => void): void }) {
    root.walkRules((rule) => {
      const extra = rule.selectors.map(forced).filter((selector): selector is string => selector !== null);
      if (extra.length > 0) rule.selectors = [...rule.selectors, ...extra];
    });
  },
};
