// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { flushSync, mount, unmount } from 'svelte';

// The binding calls into Go, which does not exist in a test process.
vi.mock('../bindings/github.com/tenesh/bava/internal/app', () => ({
  RenderService: {
    Render: vi.fn().mockResolvedValue({ svg: '<svg id="stub"/>', errors: [], nodeMap: {} }),
  },
  FileService: {
    Open: vi.fn().mockResolvedValue({
      path: '/w/Acme/Roadmap.md',
      source: '# Hello\n\nWorld.\n',
      diagrams: {},
      scene: { version: 1, elements: [] },
      stamp: { size: 1, modifiedUnixNano: '1' },
      error: '',
    }),
    Save: vi.fn().mockResolvedValue({ path: '/w/Acme/Roadmap.md', stamp: { size: 2, modifiedUnixNano: '2' }, error: '' }),
    ChangedOnDisk: vi.fn().mockResolvedValue(false),
    Settings: vi.fn().mockResolvedValue({ debounceMs: 250, layoutEngine: 'tala', autosave: 'off', autosaveDelayMs: 1000 }),
    SaveSettings: vi.fn().mockResolvedValue(''),
  },
  MenuService: {
    SetState: vi.fn().mockResolvedValue(undefined),
  },
  SpaceService: {
    ChooseFolder: vi.fn().mockResolvedValue({ path: '/w/Acme', error: '' }),
    Open: vi.fn().mockResolvedValue({ root: '/w/Acme', name: 'Acme', pageWidth: '', error: '' }),
    List: vi.fn().mockResolvedValue({ entries: [{ name: 'Roadmap.md', path: 'Roadmap.md', kind: 'page' }], error: '' }),
    Apply: vi.fn().mockResolvedValue({ path: '', id: '', root: '', error: '' }),
    Create: vi.fn().mockResolvedValue({ root: '/w/Beta', name: 'Beta', pageWidth: '', error: '' }),
    Index: vi.fn().mockResolvedValue({ pages: [], backlinks: [], error: '' }),
  },
  LogService: {
    Report: vi.fn().mockResolvedValue(undefined),
    TakeNotices: vi.fn().mockResolvedValue([]),
    Diagnostics: vi.fn().mockResolvedValue(''),
    OpenLogsFolder: vi.fn().mockResolvedValue(''),
    SetVerbose: vi.fn().mockResolvedValue(''),
  },
}));

import App from './App.svelte';

// The app remembers the last Space and page it had open; each test starts as
// a first launch, not reopening what the test before it left.
beforeEach(() => localStorage.clear());
import { SpaceService } from '../bindings/github.com/tenesh/bava/internal/app';
import { PENDING } from './files/tree';

// A native menu click, as Go delivers it.
function menuCommand(id: string) {
  const wails = (window as unknown as { _wails: { dispatchWailsEvent(event: { name: string; data: unknown }): void } })._wails;
  wails.dispatchWailsEvent({ name: 'menu:command', data: { id } });
}

function mountApp() {
  const target = document.createElement('div');
  document.body.append(target);
  const app = flushSync(() => mount(App, { target }));
  return { target, app };
}

const titleBarButtons = (target: HTMLElement) =>
  [...target.querySelectorAll('header button')].map((b) => b.textContent?.trim());

describe('App', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });
  afterEach(() => vi.clearAllMocks());

  // Mounting is the only way to catch an orphaned $effect: creating one inside
  // onMount type-checks cleanly and throws at runtime. This test fails if the
  // effects move back into the mount callback.
  it('mounts without orphaning an effect', () => {
    const target = document.createElement('div');
    document.body.append(target);

    const app = mount(App, { target });

    // Panes are labelled from the message catalogue.
    expect(target.querySelector('[aria-label="Document"]')).not.toBeNull();
    expect(target.querySelector('[aria-label="Diagram"]')).not.toBeNull();
    expect(target.querySelector('[aria-label="Files"]')).not.toBeNull();

    unmount(app);
  });

  it('mounts the Document editor into its pane', () => {
    const target = document.createElement('div');
    document.body.append(target);

    // onMount runs when effects flush, not during mount() itself.
    const app = flushSync(() => mount(App, { target }));

    // ProseMirror creates its own DOM inside the element it was handed.
    expect(target.querySelector('.bava-doc')).not.toBeNull();

    unmount(app);
  });
});

describe('App shell integration', () => {
  // A view switch must not unmount the editor: ProseMirror owns its own DOM,
  // and remounting it would take the undo history and cursor with it.
  it('keeps the editor mounted when the canvas is hidden', async () => {
    const { target, app } = mountApp();
    menuCommand('file.new');
    await vi.waitFor(() => expect(target.textContent).toContain('untitled'));

    const editorBefore = target.querySelector('.bava-doc');
    expect(editorBefore).not.toBeNull();

    const documentButton = [...target.querySelectorAll('button, label')].find((el) =>
      el.textContent?.trim().startsWith('Document'),
    );
    expect(documentButton, 'no Document view control found').toBeDefined();
    flushSync(() => (documentButton as HTMLElement).click());

    // Same node, not a replacement.
    expect(target.querySelector('.bava-doc')).toBe(editorBefore);

    unmount(app);
  });

  it('the title bar shows the mark', () => {
    const target = document.createElement('div');
    document.body.append(target);
    const app = flushSync(() => mount(App, { target }));
    const mark = target.querySelector('header .mark svg');
    expect(mark, 'no mark in the title bar').not.toBeNull();
    expect(mark?.getAttribute('aria-label')).toBe('Bava');
    unmount(app);
  });

  // The status bar names the engine the document is laid out with, which is
  // the configured one, not a literal.
  // The status bar describes the canvas while it is worked on.
  it('names the configured engine in the status bar on the canvas', async () => {
    const { FileService } = await import('../bindings/github.com/tenesh/bava/internal/app');
    vi.mocked(FileService.Settings).mockResolvedValueOnce({ debounceMs: 250, layoutEngine: 'elk', autosave: 'off', autosaveDelayMs: 1000 } as never);
    const { target, app } = mountApp();
    menuCommand('file.new');
    menuCommand('view.canvas');
    await vi.waitFor(() => expect(target.querySelector('footer')?.textContent).toContain('elk'));
    expect(target.querySelector('footer')?.textContent).not.toContain('words');
    menuCommand('view.both');
    unmount(app);
  });

  // And the document's words while the document is.
  it('counts the document\'s words in the status bar in the document', async () => {
    const { target, app } = mountApp();
    expect(target.querySelector('footer')?.textContent).not.toContain('Errors');
    menuCommand('file.new');
    menuCommand('view.document');
    await vi.waitFor(() => expect(target.querySelector('footer')?.textContent).toContain('0 words'));
    expect(target.querySelector('footer')?.textContent).not.toContain('Engine');
    menuCommand('view.both');
    unmount(app);
  });
});

describe('launch', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });
  afterEach(() => vi.clearAllMocks());

  // Bava launches with nothing open: the regions are hidden, not unmounted,
  // and the way out is on screen.
  it('launches with no file open', () => {
    const { target, app } = mountApp();

    expect(target.querySelector('header')?.textContent).toContain('No file open');
    expect(target.querySelector('header')?.textContent).not.toContain('saved');
    expect(target.querySelector('.regions')?.classList.contains('hidden')).toBe(true);
    // Still mounted underneath.
    expect(target.querySelector('.bava-doc')).not.toBeNull();
    expect(titleBarButtons(target)).not.toContain('Document');
    expect(target.querySelector('footer')?.textContent).not.toContain('Engine');

    const hints = [...target.querySelectorAll('.hints li')].map((li) => li.textContent);
    expect(hints.some((h) => h?.includes('Open a file'))).toBe(true);
    expect(hints.some((h) => h?.includes('New file'))).toBe(true);
    unmount(app);
  });

  it('Open Space opens the chosen folder and lists it in the Files tree', async () => {
    const { target, app } = mountApp();
    menuCommand('file.openSpace');
    await vi.waitFor(() => expect(target.querySelector('[data-path="Roadmap.md"]')).not.toBeNull());
    expect(target.textContent).toContain('Acme');
    unmount(app);
  });

  // A new page is named in the tree, so the tree has to show.
  it('New Page in a Space shows a hidden Files pane with the row being named', async () => {
    const { target, app } = mountApp();
    menuCommand('file.openSpace');
    await vi.waitFor(() => expect(target.querySelector('[data-path="Roadmap.md"]')).not.toBeNull());
    menuCommand('view.files');
    await vi.waitFor(() => expect(target.querySelector('[data-path="Roadmap.md"]')).toBeNull());
    menuCommand('file.new');
    await vi.waitFor(() => expect(target.querySelector('[data-path="Roadmap.md"]')).not.toBeNull());
    const naming = [...target.querySelectorAll<HTMLElement>('[data-path]')].some((row) => row.dataset.path === PENDING);
    expect(naming).toBe(true);
    unmount(app);
  });

  // The Files header offers New page and New folder from one menu button.
  it('the Files header opens a menu to make a page or a folder', async () => {
    const { target, app } = mountApp();
    menuCommand('file.openSpace');
    await vi.waitFor(() => expect(target.querySelector('[data-path="Roadmap.md"]')).not.toBeNull());
    const more = target.querySelector<HTMLButtonElement>('button[aria-label="Add to Files"]');
    expect(more).not.toBeNull();
    expect(target.querySelector('button[aria-label="New page"]')).toBeNull();
    more!.click();
    await vi.waitFor(() => {
      const labels = [...document.querySelectorAll('.bava-menu[data-state="open"] .bava-menu-item')].map((el) => el.textContent?.trim());
      expect(labels).toEqual(['New page', 'New folder']);
    });
    unmount(app);
  });

  // New Space asks for a name and a place, then makes the folder there.
  it('New Space makes a named folder in the chosen place', async () => {
    const { target, app } = mountApp();
    menuCommand('file.openSpace');
    await vi.waitFor(() => expect(target.querySelector('[data-path="Roadmap.md"]')).not.toBeNull());
    target.querySelector<HTMLElement>('.bava-space-switcher')!.click();
    const item = () =>
      [...document.querySelectorAll<HTMLElement>('.bava-menu[data-state="open"] .bava-menu-item')].find((el) => el.textContent?.trim() === 'New Space');
    await vi.waitFor(() => expect(item()).toBeDefined());
    item()!.click();
    const field = () => document.querySelector<HTMLInputElement>('#new-space-name');
    await vi.waitFor(() => expect(field()).not.toBeNull());
    // Beside the Space open now, until another place is chosen.
    expect(document.body.textContent).toContain('/w');
    const button = (label: string) => [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === label)!;
    button('Choose').click();
    await vi.waitFor(() => expect(document.querySelector('.bava-dialog-content .path')?.textContent).toBe('/w/Acme'));
    field()!.value = 'Beta';
    field()!.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    button('Create').click();
    await vi.waitFor(() => expect(SpaceService.Create).toHaveBeenCalledWith('/w/Acme', 'Beta'));
    await vi.waitFor(() => expect(SpaceService.Open).toHaveBeenCalledWith('/w/Beta'));
    unmount(app);
  });

  // The Files section folds under its header, and a new page unfolds it.
  it('folds the Files section, and unfolds it for a new page', async () => {
    localStorage.clear();
    const { target, app } = mountApp();
    menuCommand('file.openSpace');
    await vi.waitFor(() => expect(target.querySelector('[data-path="Roadmap.md"]')).not.toBeNull());
    const fold = target.querySelector<HTMLButtonElement>('.files-fold')!;
    expect(fold.getAttribute('aria-expanded')).toBe('true');
    fold.click();
    await vi.waitFor(() => expect(target.querySelector('[data-path="Roadmap.md"]')).toBeNull());
    expect(fold.getAttribute('aria-expanded')).toBe('false');
    menuCommand('file.new');
    await vi.waitFor(() => expect(target.querySelector('[data-path="Roadmap.md"]')).not.toBeNull());
    localStorage.clear();
    unmount(app);
  });

  // A Space open with no page open is not an untitled page.
  it('says no page is open in the title bar when a Space has none open', async () => {
    const { target, app } = mountApp();
    menuCommand('file.openSpace');
    await vi.waitFor(() => expect(target.querySelector('[data-path="Roadmap.md"]')).not.toBeNull());
    expect(target.querySelector('header')?.textContent).toContain('No page open');
    expect(target.querySelector('header')?.textContent).not.toContain('untitled');
    unmount(app);
  });

  // The page's text is shown formatted, edited, and saved back as Markdown.
  it('shows a page in the Document editor, and saves what was changed', async () => {
    const { target, app } = mountApp();
    menuCommand('file.openSpace');
    await vi.waitFor(() => expect(target.querySelector('[data-path="Roadmap.md"]')).not.toBeNull());
    target.querySelector<HTMLElement>('[data-path="Roadmap.md"]')!.click();
    await vi.waitFor(() => expect(target.querySelector('.bava-doc h1')?.textContent).toBe('Hello'));
    (target.querySelector('.bava-doc') as HTMLElement).focus();
    menuCommand('edit.selectAll');
    menuCommand('edit.delete');
    await vi.waitFor(() => expect(target.querySelector('header')?.textContent).toContain('unsaved'));
    menuCommand('file.save');
    const { FileService } = await import('../bindings/github.com/tenesh/bava/internal/app');
    await vi.waitFor(() => expect(FileService.Save).toHaveBeenCalledWith('/w/Acme/Roadmap.md', '', { version: 1, elements: [] }));
    unmount(app);
  });

  // ⌘F finds in the page.
  it('opens find in the page from the menu', async () => {
    const { target, app } = mountApp();
    menuCommand('file.openSpace');
    await vi.waitFor(() => expect(target.querySelector('[data-path="Roadmap.md"]')).not.toBeNull());
    target.querySelector<HTMLElement>('[data-path="Roadmap.md"]')!.click();
    await vi.waitFor(() => expect(target.querySelector('.bava-doc h1')).not.toBeNull());
    menuCommand('edit.find');
    await vi.waitFor(() => expect(target.querySelector('[role="search"]')).not.toBeNull());
    unmount(app);
  });

  it('New opens an untitled document', async () => {
    const { target, app } = mountApp();
    menuCommand('file.new');
    await vi.waitFor(() => expect(target.querySelector('.regions')?.classList.contains('hidden')).toBe(false));
    expect(target.querySelector('header')?.textContent).toContain('untitled');
    expect(target.querySelector('.hints')).toBeNull();
    unmount(app);
  });

  it('covers the window with the splash until settings and fonts have loaded', async () => {
    const { target, app } = mountApp();
    expect(target.querySelector('[data-part="splash"]')).not.toBeNull();
    await vi.waitFor(() => expect(target.querySelector('[data-part="splash"]')).toBeNull());
    unmount(app);
  });

  // Canvas commands reach the page as shortcuts whatever is on screen. With
  // nothing open, or the canvas hidden, they must not edit or dirty anything:
  // a dirtied absent document asked "save changes?" on the next New.
  it.each(['canvas.bringToFront', 'canvas.sendToBack', 'canvas.group', 'canvas.ungroup'])(
    '%s with no file open leaves nothing to save',
    async (id) => {
      const { target, app } = mountApp();
      menuCommand(id);
      menuCommand('file.new');
      await vi.waitFor(() => expect(target.querySelector('header')?.textContent).toContain('untitled'));
      expect(target.querySelector('header')?.textContent).not.toContain('unsaved');
      expect(document.querySelector('[role="alertdialog"]:not([hidden])')).toBeNull();
      unmount(app);
    },
  );

  it('a canvas command with the canvas hidden does not dirty the open document', async () => {
    const { target, app } = mountApp();
    menuCommand('file.new');
    await vi.waitFor(() => expect(target.querySelector('header')?.textContent).toContain('untitled'));
    menuCommand('view.document');
    menuCommand('canvas.bringToFront');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(target.querySelector('header')?.textContent).not.toContain('unsaved');
    unmount(app);
  });

  // The AI toggle reads as a button: bordered, with an icon, pressed while
  // the pane shows.
  it('the AI button is a bordered icon button, pressed while the pane shows', async () => {
    const { target, app } = mountApp();
    menuCommand('file.new');
    await vi.waitFor(() => expect(target.textContent).toContain('untitled'));
    const ai = [...target.querySelectorAll('header button')].find((b) => b.textContent?.trim() === 'AI')!;
    // The shared bordered button, not its borderless ghost.
    expect(ai.classList.contains('bava-button')).toBe(true);
    expect(ai.classList.contains('ghost')).toBe(false);
    expect(ai.querySelector('svg')).not.toBeNull();
    expect(ai.getAttribute('aria-pressed')).toBe('false');
    menuCommand('view.ai');
    await vi.waitFor(() => expect(ai.getAttribute('aria-pressed')).toBe('true'));
    unmount(app);
  });

  // Closing the right-click menu once threw: its props were read after the
  // state behind them had been cleared (seen at a running window).
  it('opens the right-click menu on the canvas, and closes it without an error', async () => {
    const { LogService } = await import('../bindings/github.com/tenesh/bava/internal/app');
    const { target, app } = mountApp();
    menuCommand('file.new');
    await vi.waitFor(() => expect(target.textContent).toContain('untitled'));
    // The view mode is remembered; an earlier test may have hidden the canvas.
    menuCommand('view.canvas');
    const host = target.querySelector('.canvas-region .fill')!;
    host.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 50, clientY: 50 }));
    const menu = () => document.querySelector('.bava-menu[data-state="open"]') as HTMLElement | null;
    // Nothing copied yet, so empty canvas offers Select All and no Paste.
    await vi.waitFor(() => expect(menu()?.textContent).toContain('Select All'));
    menu()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await vi.waitFor(() => expect(menu()).toBeNull());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(LogService.Report).not.toHaveBeenCalled();
    unmount(app);
  });

  // A click that changes nothing is not an edit, and a right-button release is
  // not a tool press: both once marked the document unsaved, and a right-click
  // with Text opened a text box.
  it('a click that changes nothing, or a right-click, leaves the document saved', async () => {
    const { target, app } = mountApp();
    menuCommand('file.new');
    menuCommand('view.canvas');
    await vi.waitFor(() => expect(target.textContent).toContain('untitled'));
    const host = target.querySelector('.canvas-region .fill') as HTMLElement;
    host.setPointerCapture = () => {};
    const pointer = (type: string, button: number) =>
      host.dispatchEvent(new MouseEvent(type, { bubbles: true, button, clientX: 300, clientY: 300 }));

    pointer('pointerdown', 0);
    pointer('pointerup', 0);
    menuCommand('tool.text');
    pointer('pointerdown', 2);
    pointer('pointerup', 2);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(target.querySelector('header')?.textContent).not.toContain('unsaved');
    expect(target.querySelector('textarea.bava-label-editor')).toBeNull();
    unmount(app);
  });

  // ⌘D selects the next match in the source editor; the canvas must not also
  // duplicate while the editor has focus.
  it('a canvas-scoped key does nothing to the canvas while the source editor has focus', async () => {
    const { target, app } = mountApp();
    menuCommand('file.new');
    menuCommand('view.both');
    await vi.waitFor(() => expect(target.textContent).toContain('untitled'));
    const host = target.querySelector('.canvas-region .fill') as HTMLElement;
    host.setPointerCapture = () => {};
    const at = (type: string, x: number, y: number) =>
      host.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y }));
    menuCommand('tool.rect');
    at('pointerdown', 100, 100);
    at('pointermove', 200, 180);
    at('pointerup', 200, 180);

    const units = async () => {
      (document.activeElement as HTMLElement | null)?.blur();
      menuCommand('edit.selectAll');
      await new Promise((resolve) => setTimeout(resolve, 10));
      return target.querySelector('[aria-label="Align left"]') ? 'several' : 'one';
    };
    expect(await units()).toBe('one');

    const editor = target.querySelector('.bava-doc') as HTMLElement;
    editor.focus();
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', code: 'KeyD', metaKey: true, ctrlKey: true, bubbles: true }));
    expect(await units()).toBe('one');

    // The control: with the canvas as the target, the same key duplicates.
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', code: 'KeyD', metaKey: true, ctrlKey: true, bubbles: true }));
    expect(await units()).toBe('several');
    unmount(app);
  });

  // Settings lives in the native menu (Bava or File ▸ Settings…), not the window.
  it('the title bar has no Settings button, open or not', async () => {
    const { target, app } = mountApp();
    expect(titleBarButtons(target)).not.toContain('Settings');
    menuCommand('file.new');
    await vi.waitFor(() => expect(target.textContent).toContain('untitled'));
    expect(titleBarButtons(target)).not.toContain('Settings');
    unmount(app);
  });

  it('the Settings menu command opens the settings dialog', async () => {
    const { app } = mountApp();
    menuCommand('app.settings');
    await vi.waitFor(() =>
      expect(document.querySelector('[role="dialog"]:not([hidden])')?.textContent).toContain('Appearance'),
    );
    unmount(app);
  });
});
