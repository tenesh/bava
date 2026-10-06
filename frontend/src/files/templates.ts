/**
 * Templates on the page side: a page's text moved to another place with its
 * links, images and embeds still reaching what they reached (a page made
 * from a template, a template saved from a page), and Add's "New page from
 * template" submenu.
 */
import { rewritePageLinks } from '../docs/page-links';
import type { MenuNode } from '../canvas/context-menu';

/** One of the Space's templates, as Go lists them. */
export type TemplateRef = { group: string; name: string; path: string };

/** The id a template's menu item reports. */
export const TEMPLATE_ITEM = 'template:';

/** The text of a page at `from` as it reads at `to`: each address rewritten for the new place. */
export function movedText(text: string, from: string, to: string): string {
  return rewritePageLinks(from, text, [{ from, to }])?.text ?? text;
}

/** Add's submenu: each group's templates under the group, then those in no group; null with none. */
export function templateMenu(templates: TemplateRef[], label: string): MenuNode | null {
  if (templates.length === 0) return null;
  const item = (template: TemplateRef): MenuNode => ({ kind: 'item', id: TEMPLATE_ITEM + template.path, label: template.name, keys: '' });
  const groups = [...new Set(templates.filter((each) => each.group !== '').map((each) => each.group))];
  const grouped: MenuNode[] = groups.map((group) => ({
    kind: 'submenu',
    id: `template-group:${group}`,
    label: group,
    items: templates.filter((each) => each.group === group).map(item),
  }));
  const loose = templates.filter((each) => each.group === '').map(item);
  return {
    kind: 'submenu',
    id: 'tree.newFromTemplate',
    label,
    items: [...grouped, ...(grouped.length > 0 && loose.length > 0 ? [{ kind: 'separator' } satisfies MenuNode] : []), ...loose],
  };
}
