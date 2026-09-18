/**
 * The canvas's right-click menu, as a tree the component renders.
 *
 * Built from the menu spec, so every entry is a command the native menu also
 * has: same id, same label, same key, same handler. Groups and submenus follow
 * canvas-toolbar.md. Only what works now is listed; Lock, Copy as and Export
 * join with Milestones 6.3 and 6.4.
 */
import menuSpec from '../../../internal/app/menu/spec.json';
import { currentPlatform, formatAccelerator, type MenuSpec, type Platform } from '../shell/shortcuts';
import { isSwatch, SWATCHES } from './palette';
import { PROPERTY_OPTIONS } from './property-options';
import { t } from '../i18n/t';
import type { ToolbarControl } from './toolbar';
import type { PropertyKey, PropertyValue, StyleKey } from './style';

export type MenuNode =
  | { kind: 'item'; id: string; label: string; keys: string }
  | { kind: 'submenu'; id: string; label: string; items: MenuNode[] }
  | { kind: 'separator' };

export type SelectionInfo = {
  /** Selected units: an element, or a group standing for its children. */
  units: number;
  canGroup: boolean;
  canUngroup: boolean;
  /** Whether Paste has elements to paste, and Paste Styles a style. */
  canPaste: boolean;
  canPasteStyles: boolean;
  /** Whether anything in the scene is locked, for Unlock All. */
  hasLocked: boolean;
};

type SpecEntry = { id?: string; label?: string; accelerator?: string; shortcut?: string; hint?: string; items?: SpecEntry[] };

function find(id: string): SpecEntry | undefined {
  const walk = (items: SpecEntry[] = []): SpecEntry | undefined => {
    for (const item of items) {
      if (item.id === id) return item;
      const inner = walk(item.items);
      if (inner) return inner;
    }
    return undefined;
  };
  for (const menu of (menuSpec as MenuSpec).menus) {
    const found = walk(menu.items as SpecEntry[]);
    if (found) return found;
  }
  return undefined;
}

export function contextMenuFor(info: SelectionInfo, platform: Platform = currentPlatform()): MenuNode[] {
  const item = (id: string): MenuNode => {
    const entry = find(id);
    const combo = entry?.accelerator ?? entry?.shortcut;
    return {
      kind: 'item',
      id,
      label: entry?.label ?? id,
      keys: combo ? formatAccelerator(combo, platform) : (entry?.hint ?? ''),
    };
  };
  const submenu = (id: string, children: string[]): MenuNode => ({
    kind: 'submenu',
    id,
    label: find(id)?.label ?? id,
    items: children.map(item),
  });
  const separator: MenuNode = { kind: 'separator' };

  const paste = info.canPaste ? [item('edit.paste')] : [];
  const unlockAll = info.hasLocked ? [item('canvas.unlockAll')] : [];
  if (info.units === 0) return [...paste, item('edit.selectAll'), ...unlockAll];

  const groups: MenuNode[][] = [
    [item('edit.cut'), item('edit.copy'), ...paste],
    [item('canvas.copyStyles'), ...(info.canPasteStyles ? [item('canvas.pasteStyles')] : [])],
    [
      submenu('canvas.arrange', ['canvas.bringToFront', 'canvas.bringForward', 'canvas.sendBackward', 'canvas.sendToBack']),
      ...(info.units >= 2
        ? [
            submenu('canvas.align', [
              'canvas.alignLeft',
              'canvas.alignCenter',
              'canvas.alignRight',
              'canvas.alignTop',
              'canvas.alignMiddle',
              'canvas.alignBottom',
              ...(info.units >= 3 ? ['canvas.distributeHorizontal', 'canvas.distributeVertical'] : []),
            ]),
          ]
        : []),
      submenu('canvas.flip', ['canvas.flipHorizontal', 'canvas.flipVertical']),
    ],
    [...(info.canGroup ? [item('canvas.group')] : []), ...(info.canUngroup ? [item('canvas.ungroup')] : [])],
    [item('canvas.duplicate'), item('canvas.lock'), ...unlockAll],
    [item('edit.delete')],
  ];

  return groups.filter((group) => group.length > 0).flatMap((group, i) => (i === 0 ? group : [separator, ...group]));
}

/** The colour keys an overflow entry may name, as `StyleKey` lists them. */
const COLOUR_KEYS: StyleKey[] = ['fill', 'stroke', 'color'];

/** The opacity steps More offers, where the row would show a slider. */
const OPACITY_STEPS = [100, 75, 50, 25];

/**
 * The controls that did not fit the toolbar row, as submenus of choices, after
 * a separator. Selecting one reports `property:<key>:<value>` for a style
 * property, or `style:<key>:<swatch>` for a colour, with an empty swatch
 * meaning the theme default. Empty when everything fits.
 */
export function overflowMenu(controls: ToolbarControl[]): MenuNode[] {
  if (controls.length === 0) return [];
  const nodes = controls.map((control): MenuNode => {
    if (control.kind === 'colour') {
      return {
        kind: 'submenu',
        id: `style:${control.id}`,
        label: t(`style.${control.id}` as Parameters<typeof t>[0]),
        items: ['', ...SWATCHES].map((swatch) => ({
          kind: 'item',
          id: `style:${control.id}:${swatch}`,
          label: t(swatch ? (`swatch.${swatch}` as Parameters<typeof t>[0]) : 'swatch.default'),
          keys: '',
        })),
      };
    }
    const property = PROPERTY_OPTIONS[control.id as keyof typeof PROPERTY_OPTIONS];
    const options =
      control.kind === 'slider'
        ? OPACITY_STEPS.map((step) => ({ value: step, label: `${step}%` }))
        : property.options.map((option) => ({ value: option.value, label: t(option.labelKey) }));
    return {
      kind: 'submenu',
      id: `property:${control.id}`,
      label: t(property.labelKey),
      items: options.map((option) => ({
        kind: 'item',
        id: `property:${control.id}:${option.value}`,
        label: option.label,
        keys: '',
      })),
    };
  });
  return [{ kind: 'separator' }, ...nodes];
}

/** What an overflow menu entry asks for, once its id is read back. */
export type OverflowChoice =
  | { kind: 'property'; key: PropertyKey; value: PropertyValue }
  | { kind: 'style'; key: StyleKey; swatch: string | null };

/**
 * Read an overflow entry's id back into the change it asks for, or null when
 * the id is an ordinary command (which dispatches as it always did) or names a
 * value this build does not offer.
 */
export function parseOverflowId(id: string): OverflowChoice | null {
  const [prefix, key, ...rest] = id.split(':');
  if (rest.length !== 1) return null;
  const raw = rest[0];
  if (prefix === 'style') {
    if (!COLOUR_KEYS.includes(key as StyleKey)) return null;
    if (raw !== '' && !isSwatch(raw)) return null;
    return { kind: 'style', key: key as StyleKey, swatch: raw === '' ? null : raw };
  }
  if (prefix !== 'property') return null;
  const control = PROPERTY_OPTIONS[key as PropertyKey];
  if (!control) return null;
  if (key === 'opacity') {
    const value = Number(raw);
    return OPACITY_STEPS.includes(value) ? { kind: 'property', key, value } : null;
  }
  const option = control.options.find((candidate) => String(candidate.value) === raw);
  return option ? { kind: 'property', key: key as PropertyKey, value: option.value } : null;
}

/**
 * Positioning for a menu opened at a point, for Ark's `positioning`. The point
 * is read when Ark places the menu, so a menu mounted once and opened at a new
 * point each time lands there; passed as `anchorPoint` it was read at mount.
 */
export function atPoint(read: () => { x: number; y: number } | null) {
  return {
    placement: 'bottom-start' as const,
    getAnchorRect: () => {
      const point = read();
      return point ? { x: point.x, y: point.y, width: 0, height: 0 } : null;
    },
  };
}

/**
 * The selection a right-click acts on. Empty canvas: nothing. A hit already
 * selected, or inside a selected group: the selection as it is. Otherwise the
 * hit's outermost group, or the hit itself, as a left click would select.
 */
export function contextSelection(
  scene: { elements: { id: string; type: string; children?: string[] }[] },
  selected: string[],
  hit: string | undefined,
): string[] {
  if (hit === undefined) return [];
  const parentOf = new Map<string, string>();
  for (const element of scene.elements) {
    if (element.type === 'group') element.children?.forEach((child) => parentOf.set(child, element.id));
  }
  let outermost = hit;
  const chain = [hit];
  while (parentOf.has(outermost)) {
    outermost = parentOf.get(outermost)!;
    chain.push(outermost);
  }
  return chain.some((id) => selected.includes(id)) ? selected : [outermost];
}

