/**
 * Rendered SVG, with anything that would reach outside the app taken out.
 *
 * Bava makes no network call the user did not configure (`CLAUDE.md`,
 * non-negotiable 1). D2 puts a remote URL straight into its output for
 * `icon:` and `link:`, so injecting a preview into the webview would fetch
 * that icon as the user types, and a click on a linked shape could navigate
 * the app window away from the app.
 *
 * A reference inside the document (`#shape-1`) is what the diagram is made of
 * and stays. What goes is anything with a scheme, and anything
 * protocol-relative: the only references left point at the document itself.
 */

/** `href`, `xlink:href` or `src` whose value is not a fragment. */
const REMOTE_REF = /\s(?:xlink:)?(?:href|src)\s*=\s*(?:"[^"#][^"]*"|'[^'#][^']*')/gi;

/** An anchor wrapping part of the drawing; its contents are kept. */
const LINK_TAGS = /<a\b[^>]*>|<\/a>/gi;

/**
 * `svg` with remote references removed, for injecting into the page.
 *
 * The drawing is untouched: only the attributes that would cause a fetch or a
 * navigation go, and an `<a>` wrapper is unwrapped rather than dropped, so
 * the shape inside it is still drawn.
 */
export function withoutRemoteRefs(svg: string): string {
  return svg.replace(REMOTE_REF, '').replace(LINK_TAGS, '');
}
