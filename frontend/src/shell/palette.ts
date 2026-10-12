/**
 * What the command palette offers: every menu command by name, with its
 * menu path and its keys, as this platform's menu shows it; what cannot run
 * now left out, by the same `when` the menu enables items from. Matching
 * and the recent commands are here too; the palette itself only shows them.
 */
import { formatAccelerator, type MenuSpec, type Platform, type SpecItem } from './shortcuts';

/** The menu states an item's `when` can name, as the page reports them to the menu. */
export type MenuState = {
  hasSelection: boolean;
  canPasteStyles: boolean;
  hasLocked: boolean;
  hasDocument: boolean;
  showsCanvas: boolean;
  hasSpace: boolean;
};

export type PaletteCommand = {
  id: string;
  label: string;
  /** The menus it sits in: "View", "File ▸ Export". */
  path: string;
  /** Its top menu: the group it is listed under. */
  menu: string;
  /** Its keys as the menu shows them, or "". */
  keys: string;
};

/** The palette's own command. */
const PALETTE = 'view.commandPalette';

/** The kinds of item that run something: a command, a checkbox or a choice. */
const RUNNABLE = new Set(['command', 'checkbox', 'radio']);

const onPlatform = (entry: { platforms?: string[] }, platform: Platform) => !entry.platforms || entry.platforms.includes(platform);

/** Every command the palette can offer now, in menu order. */
export function paletteCommands(spec: MenuSpec, platform: Platform, state: MenuState): PaletteCommand[] {
  const out: PaletteCommand[] = [];
  const canRun = (item: SpecItem) => (item.when ?? []).every((key) => state[key as keyof MenuState] === true);
  const walk = (items: SpecItem[], path: string[], menu: string) => {
    for (const item of items) {
      if (!onPlatform(item, platform)) continue;
      if (item.items) walk(item.items, [...path, item.label ?? ''], menu);
      // The palette never offers itself.
      if (!RUNNABLE.has(item.kind) || !item.id || !item.label || item.id === PALETTE || !canRun(item)) continue;
      const combo = item.accelerator ?? item.shortcut;
      out.push({ id: item.id, label: item.label, path: path.join(' ▸ '), menu, keys: combo ? formatAccelerator(combo, platform) : (item.hint ?? '') });
    }
  };
  for (const menu of spec.menus) if (onPlatform(menu, platform)) walk(menu.items, [menu.label], menu.label);
  return out;
}

/**
 * The commands holding every word typed, in any order, in their label or
 * their path, ignoring case: those whose label holds them all first, then
 * the rest, each in menu order. Nothing typed matches nothing.
 */
export function matchCommands(commands: PaletteCommand[], query: string): PaletteCommand[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const holds = (text: string) => words.every((word) => text.toLowerCase().includes(word));
  const found = commands.filter((command) => holds(`${command.label} ${command.path}`));
  return [...found.filter((command) => holds(command.label)), ...found.filter((command) => !holds(command.label))];
}

/** How many commands run from the palette it lists as recent. */
const RECENT_COMMANDS = 5;

/** The commands last run from the palette, newest first, each once: memory only, for the session. */
export function createRecent() {
  let ids: string[] = [];
  return {
    get ids(): string[] {
      return ids;
    },
    add(id: string): void {
      ids = [id, ...ids.filter((other) => other !== id)].slice(0, RECENT_COMMANDS);
    },
  };
}

export type PaletteGroup = { title: string; commands: PaletteCommand[] };

/**
 * The palette's rows, grouped: before anything is typed, the recent
 * commands (titled `recentTitle`) and then every command under its menu;
 * once something is typed, what matches, in one untitled group.
 */
export function paletteGroups(commands: PaletteCommand[], query: string, recent: string[], recentTitle: string): PaletteGroup[] {
  if (query.trim() !== '') {
    const found = matchCommands(commands, query);
    return found.length > 0 ? [{ title: '', commands: found }] : [];
  }
  const groups: PaletteGroup[] = [];
  const recents = recent.map((id) => commands.find((command) => command.id === id)).filter((command): command is PaletteCommand => command !== undefined);
  if (recents.length > 0) groups.push({ title: recentTitle, commands: recents });
  for (const command of commands) {
    const last = groups[groups.length - 1];
    if (last && last.title === command.menu && last.title !== recentTitle) last.commands.push(command);
    else groups.push({ title: command.menu, commands: [command] });
  }
  return groups;
}
