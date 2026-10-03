// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { render, unmount } from './test/render';

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
    Attachments: vi.fn().mockResolvedValue({ attachments: [], error: '' }),
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

// The app remembers the last Space and page it had open, in storage the
// shared teardown empties, so each test starts as a first launch.
import { SpaceService } from '../bindings/github.com/tenesh/bava/internal/app';
import { PENDING } from './files/tree';

// A native menu click, as Go delivers it.
function menuCommand(id: string) {
  const wails = (window as unknown as { _wails: { dispatchWailsEvent(event: { name: string; data: unknown }): void } })._wails;
  wails.dispatchWailsEvent({ name: 'menu:command', data: { id } });
}

const titleBarButtons = (target: HTMLElement) =>
  [...target.querySelectorAll('header button')].map((b) => b.textContent?.trim());

// Call counts are per test; the module's mocks themselves stay in place.
afterEach(() => vi.clearAllMocks());

describe('App', () => {
  // Mounting is the only way to catch an orphaned $effect: creating one inside
  // onMount type-checks cleanly and throws at runtime. Every test here mounts
  // the app, so each fails if the effects move back into the mount callback.
  it('mounts the Document editor into its pane', () => {
    // onMount runs when effects flush, not during mount() itself.
    const { target } = render(App);

    // ProseMirror creates its own DOM inside the element it was handed.
    expect(target.querySelector('.bava-doc')).not.toBeNull();
  });
});

describe('App shell integration', () => {
  // A view switch must not unmount the editor: ProseMirror owns its own DOM,
  // and remounting it would take the undo history and cursor with it.
  it('keeps the editor mounted when the canvas is hidden', async () => {
    const { target } = render(App);
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
  });

  it('the title bar shows the mark', () => {
    const { target } = render(App);
    const mark = target.querySelector('header .mark svg');
    expect(mark, 'no mark in the title bar').not.toBeNull();
    expect(mark?.getAttribute('aria-label')).toBe('Bava');
  });

  // The status bar names the engine the document is laid out with, which is
  // the configured one, not a literal.
  // The status bar describes the canvas while it is worked on.
  it('names the configured engine in the status bar on the canvas', async () => {
    const { FileService } = await import('../bindings/github.com/tenesh/bava/internal/app');
    vi.mocked(FileService.Settings).mockResolvedValueOnce({ debounceMs: 250, layoutEngine: 'elk', autosave: 'off', autosaveDelayMs: 1000 } as never);
    const { target } = render(App);
    menuCommand('file.new');
    menuCommand('view.canvas');
    await vi.waitFor(() => expect(target.querySelector('footer')?.textContent).toContain('elk'));
    expect(target.querySelector('footer')?.textContent).not.toContain('words');
  });

  // And the document's words while the document is.
  it('counts the document\'s words in the status bar in the document', async () => {
    const { target } = render(App);
    expect(target.querySelector('footer')?.textContent).not.toContain('Errors');
    menuCommand('file.new');
    menuCommand('view.document');
    await vi.waitFor(() => expect(target.querySelector('footer')?.textContent).toContain('0 words'));
    expect(target.querySelector('footer')?.textContent).not.toContain('Engine');
  });
});

describe('launch', () => {
  // Bava launches with nothing open: the regions are hidden, not unmounted,
  // and the way out is on screen.
  it('launches with no file open', () => {
    const { target } = render(App);

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
  });

  it('Open Space opens the chosen folder and lists it in the Files tree', async () => {
    const { target } = render(App);
    menuCommand('file.openSpace');
    await vi.waitFor(() => expect(target.querySelector('[data-path="Roadmap.md"]')).not.toBeNull());
    expect(target.textContent).toContain('Acme');
  });

  // A new page is named in the tree, so the tree has to show.
  it('New Page in a Space shows a hidden Files pane with the row being named', async () => {
    const { target } = render(App);
    menuCommand('file.openSpace');
    await vi.waitFor(() => expect(target.querySelector('[data-path="Roadmap.md"]')).not.toBeNull());
    menuCommand('view.files');
    await vi.waitFor(() => expect(target.querySelector('[data-path="Roadmap.md"]')).toBeNull());
    menuCommand('file.new');
    await vi.waitFor(() => expect(target.querySelector('[data-path="Roadmap.md"]')).not.toBeNull());
    const naming = [...target.querySelectorAll<HTMLElement>('[data-path]')].some((row) => row.dataset.path === PENDING);
    expect(naming).toBe(true);
  });

  // The Files header offers New page and New folder from one menu button.
  it('the Files header opens a menu to make a page or a folder', async () => {
    const { target } = render(App);
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
  });

  // New Space asks for a name and a place, then makes the folder there.
  it('New Space makes a named folder in the chosen place', async () => {
    const { target } = render(App);
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
  });

  // The dialog is modal: a refusal in the status bar sat behind its backdrop.
  it('New Space shows a name Go refuses in the dialog, which stays open', async () => {
    vi.mocked(SpaceService.Create).mockResolvedValueOnce({ root: '', name: '', pageWidth: '', error: 'A folder named Beta is already there.' } as never);
    const { target } = render(App);
    menuCommand('file.openSpace');
    await vi.waitFor(() => expect(target.querySelector('[data-path="Roadmap.md"]')).not.toBeNull());
    target.querySelector<HTMLElement>('.bava-space-switcher')!.click();
    const item = () =>
      [...document.querySelectorAll<HTMLElement>('.bava-menu[data-state="open"] .bava-menu-item')].find((el) => el.textContent?.trim() === 'New Space');
    await vi.waitFor(() => expect(item()).toBeDefined());
    item()!.click();
    const field = () => document.querySelector<HTMLInputElement>('#new-space-name');
    await vi.waitFor(() => expect(field()).not.toBeNull());
    const button = (label: string) => [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === label)!;
    button('Choose').click();
    await vi.waitFor(() => expect(document.querySelector('.bava-dialog-content .path')?.textContent).toBe('/w/Acme'));
    field()!.value = 'Beta';
    field()!.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    button('Create').click();
    await vi.waitFor(() => expect(document.querySelector('.bava-dialog-content [role="alert"]')?.textContent).toBe('A folder named Beta is already there.'));
    expect(field()).not.toBeNull();
    expect(target.querySelector('.status [role="status"]')).toBeNull();
    expect(SpaceService.Open).not.toHaveBeenCalledWith('');
  });

  // A call that fails outright is answered in the dialog too, never left to reject.
  it('New Space shows a failure to make the folder in the dialog, which stays open', async () => {
    vi.mocked(SpaceService.Create).mockRejectedValueOnce(new Error('binding gone'));
    const { target } = render(App);
    menuCommand('file.openSpace');
    await vi.waitFor(() => expect(target.querySelector('[data-path="Roadmap.md"]')).not.toBeNull());
    target.querySelector<HTMLElement>('.bava-space-switcher')!.click();
    const item = () =>
      [...document.querySelectorAll<HTMLElement>('.bava-menu[data-state="open"] .bava-menu-item')].find((el) => el.textContent?.trim() === 'New Space');
    await vi.waitFor(() => expect(item()).toBeDefined());
    item()!.click();
    const field = () => document.querySelector<HTMLInputElement>('#new-space-name');
    await vi.waitFor(() => expect(field()).not.toBeNull());
    const button = (label: string) => [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === label)!;
    button('Choose').click();
    await vi.waitFor(() => expect(document.querySelector('.bava-dialog-content .path')?.textContent).toBe('/w/Acme'));
    field()!.value = 'Beta';
    field()!.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    button('Create').click();
    await vi.waitFor(() => expect(document.querySelector('.bava-dialog-content [role="alert"]')?.textContent).toBe('The Space could not be made.'));
    expect(field()).not.toBeNull();
  });

  // The Files section folds under its header, and a new page unfolds it.
  it('folds the Files section, and unfolds it for a new page', async () => {
    const { target } = render(App);
    menuCommand('file.openSpace');
    await vi.waitFor(() => expect(target.querySelector('[data-path="Roadmap.md"]')).not.toBeNull());
    // The side pane is laid out anew as a section folds: the button is found again.
    const fold = () => target.querySelector<HTMLButtonElement>('.files-fold[data-section="files"]')!;
    expect(fold().getAttribute('aria-expanded')).toBe('true');
    fold().click();
    await vi.waitFor(() => expect(target.querySelector('[data-path="Roadmap.md"]')).toBeNull());
    expect(fold().getAttribute('aria-expanded')).toBe('false');
    await vi.waitFor(() => expect(document.activeElement).toBe(fold()));
    menuCommand('file.new');
    await vi.waitFor(() => expect(target.querySelector('[data-path="Roadmap.md"]')).not.toBeNull());
  });

  // A Space open with no page open is not an untitled page.
  it('says no page is open in the title bar when a Space has none open', async () => {
    const { target } = render(App);
    menuCommand('file.openSpace');
    await vi.waitFor(() => expect(target.querySelector('[data-path="Roadmap.md"]')).not.toBeNull());
    expect(target.querySelector('header')?.textContent).toContain('No page open');
    expect(target.querySelector('header')?.textContent).not.toContain('untitled');
  });

  // The page's text is shown formatted, edited, and saved back as Markdown.
  it('shows a page in the Document editor, and saves what was changed', async () => {
    const { target } = render(App);
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
  });

  // Go answered and wrote nothing: the page stays unsaved, and says why.
  it('says in the status bar why a save was refused', async () => {
    const { FileService } = await import('../bindings/github.com/tenesh/bava/internal/app');
    vi.mocked(FileService.Save).mockResolvedValueOnce({ path: '', stamp: { size: 0, modifiedUnixNano: '0' }, error: 'Roadmap.md could not be written.' } as never);
    const { target } = render(App);
    menuCommand('file.openSpace');
    await vi.waitFor(() => expect(target.querySelector('[data-path="Roadmap.md"]')).not.toBeNull());
    target.querySelector<HTMLElement>('[data-path="Roadmap.md"]')!.click();
    await vi.waitFor(() => expect(target.querySelector('.bava-doc h1')?.textContent).toBe('Hello'));
    (target.querySelector('.bava-doc') as HTMLElement).focus();
    menuCommand('edit.selectAll');
    menuCommand('edit.delete');
    await vi.waitFor(() => expect(target.querySelector('header')?.textContent).toContain('unsaved'));
    menuCommand('file.save');
    await vi.waitFor(() => expect(target.querySelector('.status [role="status"]')?.textContent).toBe('Roadmap.md could not be written.'));
    expect(target.querySelector('header')?.textContent).toContain('unsaved');
  });

  // ⌘F finds in the page.
  it('opens find in the page from the menu', async () => {
    const { target } = render(App);
    menuCommand('file.openSpace');
    await vi.waitFor(() => expect(target.querySelector('[data-path="Roadmap.md"]')).not.toBeNull());
    target.querySelector<HTMLElement>('[data-path="Roadmap.md"]')!.click();
    await vi.waitFor(() => expect(target.querySelector('.bava-doc h1')).not.toBeNull());
    menuCommand('edit.find');
    await vi.waitFor(() => expect(target.querySelector('[role="search"]')).not.toBeNull());
  });

  it('New opens an untitled document', async () => {
    const { target } = render(App);
    menuCommand('file.new');
    await vi.waitFor(() => expect(target.querySelector('.regions')?.classList.contains('hidden')).toBe(false));
    expect(target.querySelector('header')?.textContent).toContain('untitled');
    expect(target.querySelector('.hints')).toBeNull();
  });

  it('covers the window with the splash until settings and fonts have loaded', async () => {
    const { target } = render(App);
    expect(target.querySelector('[data-part="splash"]')).not.toBeNull();
    await vi.waitFor(() => expect(target.querySelector('[data-part="splash"]')).toBeNull());
  });

  // Canvas commands reach the page as shortcuts whatever is on screen. With
  // nothing open, or the canvas hidden, they must not edit or dirty anything:
  // a dirtied absent document asked "save changes?" on the next New.
  it.each(['canvas.bringToFront', 'canvas.sendToBack', 'canvas.group', 'canvas.ungroup'])(
    '%s with no file open leaves nothing to save',
    async (id) => {
      const { target, app } = render(App);
      menuCommand(id);
      menuCommand('file.new');
      await vi.waitFor(() => expect(target.querySelector('header')?.textContent).toContain('untitled'));
      expect(target.querySelector('header')?.textContent).not.toContain('unsaved');
      expect(document.querySelector('[role="alertdialog"]:not([hidden])')).toBeNull();
      unmount(app);
    },
  );

  // Two shapes selected, so grouping them is a real edit when it runs.
  it('a canvas command with the canvas hidden does not dirty the open document', async () => {
    const { FileService } = await import('../bindings/github.com/tenesh/bava/internal/app');
    const rect = (id: string, x: number) => ({ id, type: 'rect', x, y: 0, w: 40, h: 40, z: 1 });
    vi.mocked(FileService.Open).mockResolvedValueOnce({
      path: '/w/Acme/Roadmap.md',
      source: '# Hello\n',
      diagrams: {},
      scene: { version: 1, elements: [rect('a', 0), rect('b', 100)] },
      stamp: { size: 1, modifiedUnixNano: '1' },
      error: '',
    } as never);
    const { target } = render(App);
    const header = () => target.querySelector('header')?.textContent;
    menuCommand('file.openSpace');
    await vi.waitFor(() => expect(target.querySelector('[data-path="Roadmap.md"]')).not.toBeNull());
    target.querySelector<HTMLElement>('[data-path="Roadmap.md"]')!.click();
    menuCommand('view.canvas');
    await vi.waitFor(() => expect(target.querySelector('.bava-doc h1')?.textContent).toBe('Hello'));
    (document.activeElement as HTMLElement | null)?.blur();
    menuCommand('edit.selectAll');
    await vi.waitFor(() => expect(target.querySelector('[aria-label="Align left"]')).not.toBeNull());

    menuCommand('view.document');
    menuCommand('canvas.group');
    // A command runs as it is delivered; flushing shows anything it changed.
    flushSync();
    expect(header()).not.toContain('unsaved');

    // The control: with the canvas shown, the same command is an edit.
    menuCommand('view.canvas');
    menuCommand('canvas.group');
    await vi.waitFor(() => expect(header()).toContain('unsaved'));
  });

  it('the AI button is pressed while the AI pane shows', async () => {
    const { target } = render(App);
    menuCommand('file.new');
    await vi.waitFor(() => expect(target.textContent).toContain('untitled'));
    const ai = [...target.querySelectorAll('header button')].find((b) => b.textContent?.trim() === 'AI')!;
    expect(ai.getAttribute('aria-pressed')).toBe('false');
    menuCommand('view.ai');
    await vi.waitFor(() => expect(ai.getAttribute('aria-pressed')).toBe('true'));
  });

  // Closing the right-click menu once threw: its props were read after the
  // state behind them had been cleared (seen at a running window).
  it('opens the right-click menu on the canvas, and closes it without an error', async () => {
    const { LogService } = await import('../bindings/github.com/tenesh/bava/internal/app');
    const { target } = render(App);
    menuCommand('file.new');
    await vi.waitFor(() => expect(target.textContent).toContain('untitled'));
    // The right-click menu is the canvas's.
    menuCommand('view.canvas');
    const host = target.querySelector('.canvas-region .fill')!;
    host.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 50, clientY: 50 }));
    const menu = () => document.querySelector('.bava-menu[data-state="open"]') as HTMLElement | null;
    // Nothing copied yet, so empty canvas offers Select All and no Paste.
    await vi.waitFor(() => expect(menu()?.textContent).toContain('Select All'));
    menu()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    // Closed, and taken off the page: the throw came as it was taken down.
    await vi.waitFor(() => expect(document.querySelector('.bava-menu')).toBeNull());
    flushSync();
    expect(LogService.Report).not.toHaveBeenCalled();
  });

  // A click that changes nothing is not an edit, and a right-button release is
  // not a tool press: both once marked the document unsaved, and a right-click
  // with Text opened a text box.
  it('a click that changes nothing, or a right-click, leaves the document saved', async () => {
    const { target } = render(App);
    menuCommand('file.new');
    menuCommand('view.canvas');
    await vi.waitFor(() => expect(target.textContent).toContain('untitled'));
    const host = target.querySelector('.canvas-region .fill') as HTMLElement;
    host.setPointerCapture = () => {};
    const pointer = (type: string, button: number) =>
      host.dispatchEvent(new MouseEvent(type, { bubbles: true, button, clientX: 300, clientY: 300 }));

    // A press with Text opens its box a microtask later, so one turn is
    // enough for it to show; the control below proves the turn is enough.
    const settled = async () => {
      await Promise.resolve();
      flushSync();
    };

    pointer('pointerdown', 0);
    pointer('pointerup', 0);
    menuCommand('tool.text');
    pointer('pointerdown', 2);
    pointer('pointerup', 2);
    await settled();

    expect(target.querySelector('header')?.textContent).not.toContain('unsaved');
    expect(target.querySelector('textarea.bava-label-editor')).toBeNull();

    // The control: a left press with Text opens a box within the same wait.
    pointer('pointerdown', 0);
    pointer('pointerup', 0);
    await settled();
    expect(target.querySelector('textarea.bava-label-editor')).not.toBeNull();
  });

  // ⌘D selects the next match in the source editor; the canvas must not also
  // duplicate while the editor has focus.
  it('a canvas-scoped key does nothing to the canvas while the source editor has focus', async () => {
    const { target } = render(App);
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

    // Select All runs as it is delivered, so flushing shows the selection
    // toolbar it produces; the control at the end proves it does.
    const units = () => {
      (document.activeElement as HTMLElement | null)?.blur();
      menuCommand('edit.selectAll');
      flushSync();
      return target.querySelector('[aria-label="Align left"]') ? 'several' : 'one';
    };
    expect(units()).toBe('one');

    const editor = target.querySelector('.bava-doc') as HTMLElement;
    editor.focus();
    editor.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', code: 'KeyD', metaKey: true, ctrlKey: true, bubbles: true }));
    expect(units()).toBe('one');

    // The control: with the canvas as the target, the same key duplicates.
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'd', code: 'KeyD', metaKey: true, ctrlKey: true, bubbles: true }));
    expect(units()).toBe('several');
  });

  // Settings lives in the native menu (Bava or File ▸ Settings…), not the window.
  it('the title bar has no Settings button, open or not', async () => {
    const { target } = render(App);
    expect(titleBarButtons(target)).not.toContain('Settings');
    menuCommand('file.new');
    await vi.waitFor(() => expect(target.textContent).toContain('untitled'));
    expect(titleBarButtons(target)).not.toContain('Settings');
  });

  it('the Settings menu command opens the settings dialog', async () => {
    render(App);
    menuCommand('app.settings');
    await vi.waitFor(() =>
      expect(document.querySelector('[role="dialog"]:not([hidden])')?.textContent).toContain('Appearance'),
    );
  });
});

describe('Media: what is moved to the Trash', () => {
  const files = [
    { name: 'a.png', size: 10, modified: '2026-09-01T00:00:00Z' },
    { name: 'b.png', size: 20, modified: '2026-09-01T00:00:00Z' },
  ];
  const click = (el: Element | undefined | null) => flushSync(() => (el as HTMLElement).click());
  const byText = (text: string) => [...document.querySelectorAll('button')].filter((b) => b.textContent?.trim() === text);

  async function openMedia(pages: { name: string; path: string; text: string; unreadable?: boolean }[]) {
    vi.mocked(SpaceService.Attachments).mockResolvedValue({ attachments: files, error: '' } as never);
    vi.mocked(SpaceService.Index).mockResolvedValue({ pages, error: '' } as never);
    vi.mocked(SpaceService.Apply).mockClear();
    const { target, app } = render(App);
    menuCommand('file.openSpace');
    await vi.waitFor(() => expect(target.querySelector('button[aria-label="Open Media"]')).not.toBeNull());
    click(target.querySelector('button[aria-label="Open Media"]'));
    await vi.waitFor(() => expect(document.querySelectorAll('.media-dialog .media-item')).toHaveLength(2));
    return { target, app };
  }

  const trashed = () =>
    vi.mocked(SpaceService.Apply).mock.calls.filter(([, op]) => (op as { kind: string }).kind === 'trashAttachment').map(([, op]) => (op as { attachment: string }).attachment);

  afterEach(() => {
    vi.mocked(SpaceService.Attachments).mockResolvedValue({ attachments: [], error: '' } as never);
    vi.mocked(SpaceService.Index).mockResolvedValue({ pages: [], backlinks: [], error: '' } as never);
  });

  it('moves only the files no page uses, after asking with how many', async () => {
    await openMedia([{ name: 'P', path: 'P.md', text: '![](.bava/attachments/a.png)\n' }]);
    await vi.waitFor(() => expect(byText('Move unused to Trash')[0]?.hasAttribute('disabled')).toBe(false));
    click(byText('Move unused to Trash')[0]);
    await vi.waitFor(() => expect(document.body.textContent).toContain('Move 1 unused file to the Trash?'));
    click(byText('Move unused to Trash').at(-1));
    await vi.waitFor(() => expect(trashed()).toEqual(['b.png']));
  });

  it('moves nothing when a page could not be read', async () => {
    await openMedia([
      { name: 'P', path: 'P.md', text: '' },
      { name: 'Q', path: 'Q.md', text: '', unreadable: true },
    ]);
    await vi.waitFor(() => expect(document.body.textContent).toContain('Not every page could be read'));
    expect(byText('Move unused to Trash')[0]?.hasAttribute('disabled')).toBe(true);
    expect(document.querySelectorAll('.media-dialog .media-item-meta')[0].textContent).not.toContain('Unused');
    expect(trashed()).toEqual([]);
  });

  it('asks before deleting a file a page uses, naming the page', async () => {
    await openMedia([{ name: 'Plan', path: 'Plan.md', text: '![](.bava/attachments/a.png)\n' }]);
    click(document.querySelector('.media-dialog [data-name="a.png"]'));
    click(byText('Delete').at(-1));
    await vi.waitFor(() => expect(document.body.textContent).toContain('these pages will show it as missing until it is restored: Plan.'));
    expect(trashed()).toEqual([]);
  });
});
