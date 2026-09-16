/**
 * Keyboard shortcuts, read from the menu spec: the list the Help dialog shows,
 * the shortcuts the frontend handles itself, and the keys the source editor
 * must leave to the menu.
 *
 * Derived rather than written down, so the Help dialog cannot drift from what
 * the menu actually binds. Hints — single keys the canvas handles itself — are
 * listed alongside real accelerators, because to a user they are the same kind
 * of thing.
 */
export type Platform = 'darwin' | 'windows' | 'linux';

type SpecItem = {
  kind: string;
  label?: string;
  id?: string;
  accelerator?: string;
  /** Handled by the frontend, not bound natively: punctuation keys. */
  shortcut?: string;
  /** Platforms where the menu binds `shortcut` natively and the page stands down. */
  nativeOn?: string[];
  hint?: string;
  platforms?: string[];
  items?: SpecItem[];
};

export type MenuSpec = { menus: { label: string; platforms?: string[]; items: SpecItem[] }[] };

export type ShortcutGroup = { title: string; rows: { label: string; keys: string }[] };

const MAC_SYMBOLS: Record<string, string> = { ctrl: '⌃', optionoralt: '⌥', shift: '⇧', cmdorctrl: '⌘' };
const MAC_ORDER = ['ctrl', 'optionoralt', 'shift', 'cmdorctrl'];
const OTHER_NAMES: Record<string, string> = { cmdorctrl: 'Ctrl', ctrl: 'Ctrl', shift: 'Shift', optionoralt: 'Alt' };
const OTHER_ORDER = ['cmdorctrl', 'ctrl', 'shift', 'optionoralt'];

export function formatAccelerator(accelerator: string, platform: Platform): string {
  const parts = accelerator.split('+');
  const key = parts.pop() ?? '';
  const modifiers = parts.map((p) => p.toLowerCase());
  const upper = key.length === 1 ? key.toUpperCase() : key;

  if (platform === 'darwin') {
    const symbols = MAC_ORDER.filter((m) => modifiers.includes(m)).map((m) => MAC_SYMBOLS[m]);
    return symbols.join('') + upper;
  }
  const names = OTHER_ORDER.filter((m) => modifiers.includes(m)).map((m) => OTHER_NAMES[m]);
  return [...names, upper].join('+');
}

function onPlatform(entry: { platforms?: string[] }, platform: Platform): boolean {
  return !entry.platforms || entry.platforms.includes(platform);
}

export function shortcutGroups(spec: MenuSpec, platform: Platform): ShortcutGroup[] {
  return spec.menus
    .filter((menu) => onPlatform(menu, platform))
    .map((menu) => {
      const rows: ShortcutGroup['rows'] = [];
      const walk = (items: SpecItem[] = []) => {
        for (const item of items) {
          if (!onPlatform(item, platform)) continue;
          const combo = item.accelerator ?? item.shortcut;
          if (item.label && combo) {
            rows.push({ label: item.label, keys: formatAccelerator(combo, platform) });
          } else if (item.label && item.hint) {
            rows.push({ label: item.label, keys: item.hint });
          }
          walk(item.items);
        }
      };
      walk(menu.items);
      return { title: menu.label, rows };
    })
    .filter((group) => group.rows.length > 0);
}

/** The platform the webview runs on, for formatting. */
export function currentPlatform(): Platform {
  const agent = globalThis.navigator?.userAgent ?? '';
  if (/Mac/i.test(agent)) return 'darwin';
  if (/Win/i.test(agent)) return 'windows';
  return 'linux';
}

function itemsOn(spec: MenuSpec, platform: Platform): SpecItem[] {
  const out: SpecItem[] = [];
  const walk = (items: SpecItem[] = []) => {
    for (const item of items) {
      if (!onPlatform(item, platform)) continue;
      out.push(item);
      walk(item.items);
    }
  };
  for (const menu of spec.menus) if (onPlatform(menu, platform)) walk(menu.items);
  return out;
}

type Combo = { primary: boolean; ctrl: boolean; shift: boolean; alt: boolean; key: string };

function sameCombo(a: Combo, b: Combo): boolean {
  return a.primary === b.primary && a.ctrl === b.ctrl && a.shift === b.shift && a.alt === b.alt && a.key === b.key;
}

/** Parses accelerator syntax. On macOS the primary modifier is Cmd; elsewhere it is Ctrl. */
function parseAccelerator(accelerator: string, platform: Platform): Combo {
  const parts = accelerator.split('+');
  const key = (parts.pop() ?? '').toLowerCase();
  const mods = new Set(parts.map((m) => m.toLowerCase()));
  const mac = platform === 'darwin';
  return {
    primary: mods.has('cmdorctrl') || (mac && (mods.has('cmd') || mods.has('command'))) || (!mac && mods.has('ctrl')),
    ctrl: mac && mods.has('ctrl'),
    shift: mods.has('shift'),
    alt: mods.has('optionoralt') || mods.has('alt') || mods.has('option'),
    key,
  };
}

// Keys are matched by physical position: Shift+] reports "}" as its key, and
// on some layouts "=" needs Shift at all.
const CODE_KEYS: Record<string, string> = {
  Equal: '=', Minus: '-', BracketLeft: '[', BracketRight: ']', Slash: '/', Backslash: '\\',
  Comma: ',', Period: '.', Semicolon: ';', Quote: "'", Backquote: '`',
};

function keyOf(event: KeyboardEvent): string {
  if (CODE_KEYS[event.code]) return CODE_KEYS[event.code];
  if (/^Key[A-Z]$/.test(event.code)) return event.code.slice(3).toLowerCase();
  if (/^Digit\d$/.test(event.code)) return event.code.slice(5);
  return event.key.toLowerCase();
}

/**
 * The frontend's half of the menu's shortcuts: returns a function giving the
 * command id a key press should dispatch, if any. Only `shortcut` entries not
 * bound natively on this platform — native accelerators dispatch through the
 * menu, and matching them here would take the key first.
 */
export function matchShortcut(spec: MenuSpec, platform: Platform) {
  const entries = itemsOn(spec, platform)
    .filter(
      (item): item is SpecItem & { id: string; shortcut: string } =>
        Boolean(item.id && item.shortcut) && !item.nativeOn?.includes(platform),
    )
    .map((item) => ({ id: item.id, combo: parseAccelerator(item.shortcut, platform) }));
  const mac = platform === 'darwin';

  return (event: KeyboardEvent): string | undefined => {
    const pressed: Combo = {
      primary: mac ? event.metaKey : event.ctrlKey,
      ctrl: mac && event.ctrlKey,
      shift: event.shiftKey,
      alt: event.altKey,
      key: keyOf(event),
    };
    return entries.find((entry) => sameCombo(entry.combo, pressed))?.id;
  };
}

export type EditorBinding = { key?: string; mac?: string; win?: string; linux?: string };

/** CodeMirror's key syntax: `Mod-Shift-z`, `Ctrl-Alt-ArrowUp`. */
function parseEditorKey(name: string, platform: Platform): Combo {
  const parts = name.split(/-(?!$)/);
  const key = (parts.pop() ?? '').toLowerCase();
  const mods = new Set(parts.map((m) => m.toLowerCase()));
  const mac = platform === 'darwin';
  return {
    primary: mods.has('mod') || (mac ? mods.has('cmd') || mods.has('meta') : mods.has('ctrl') || mods.has('control')),
    ctrl: mac && (mods.has('ctrl') || mods.has('control')),
    shift: mods.has('shift'),
    alt: mods.has('alt'),
    key,
  };
}

/**
 * Whether a source-editor key binding collides with anything the menu owns,
 * native accelerator or frontend shortcut. The editor drops those bindings so
 * one key press has one meaning.
 */
export function reservedByMenu(spec: MenuSpec, platform: Platform) {
  const claimed = itemsOn(spec, platform)
    .map((item) => item.accelerator ?? item.shortcut)
    .filter((combo): combo is string => Boolean(combo))
    .map((combo) => parseAccelerator(combo, platform));
  const field = platform === 'darwin' ? 'mac' : platform === 'windows' ? 'win' : 'linux';

  return (binding: EditorBinding): boolean => {
    const name = binding[field] ?? binding.key;
    if (!name) return false;
    const combo = parseEditorKey(name, platform);
    return claimed.some((c) => sameCombo(c, combo));
  };
}
