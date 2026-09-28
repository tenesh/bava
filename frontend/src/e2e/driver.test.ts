// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runScenario, type Step } from './driver';

afterEach(() => {
  document.body.innerHTML = '';
});

function env() {
  const calls: string[] = [];
  return {
    calls,
    menu: vi.fn((id: string) => void calls.push(`menu ${id}`)),
    shot: vi.fn(async (name: string) => {
      calls.push(`shot ${name}`);
      return '';
    }),
    timeoutMs: 200,
    // jsdom lays nothing out: every element in the page counts as showing.
    visible: (el: HTMLElement) => el.isConnected,
  };
}

describe('the smoke driver', () => {
  it('clicks, types into the focused field, presses a key, and waits for text', async () => {
    document.body.innerHTML = '<button id="go">Go</button><input id="name" /><header>untitled</header>';
    const e = env();
    const input = document.querySelector<HTMLInputElement>('#name')!;
    document.querySelector('#go')!.addEventListener('click', () => input.focus());
    const keys: string[] = [];
    input.addEventListener('keydown', (event) => {
      keys.push(event.key);
      if (event.key === 'Enter') document.querySelector('header')!.textContent = input.value;
    });
    const steps: Step[] = [
      { do: 'click', target: '#go' },
      { do: 'type', text: 'First page' },
      { do: 'key', text: 'Enter' },
      { do: 'wait', target: 'header', text: 'First page' },
    ];
    expect(await runScenario(steps, e)).toBe('');
    expect(input.value).toBe('First page');
    expect(keys).toEqual(['Enter']);
  });

  // A click focuses what it lands on, as a person's does, so a key pressed
  // next (F2 on a row of the Files tree) goes there.
  it('focuses what a click lands on, before the click runs', async () => {
    document.body.innerHTML = '<div role="tree"><div role="treeitem" tabindex="-1" id="row"><span id="name">Target</span></div></div>';
    const row = document.querySelector<HTMLElement>('#row')!;
    const keys: string[] = [];
    row.addEventListener('keydown', (event) => keys.push(event.key));
    expect(await runScenario([{ do: 'click', target: '#name' }, { do: 'key', text: 'F2' }], env())).toBe('');
    expect(document.activeElement).toBe(row);
    expect(keys).toEqual(['F2']);
  });

  // A key can name what it is pressed on: it is focused, and the key goes
  // there, wherever focus was left.
  it('presses a key on its target when one is named', async () => {
    document.body.innerHTML = '<input id="elsewhere" /><div role="treeitem" tabindex="-1" id="row">Target</div>';
    document.querySelector<HTMLElement>('#elsewhere')!.focus();
    const row = document.querySelector<HTMLElement>('#row')!;
    const keys: string[] = [];
    row.addEventListener('keydown', (event) => keys.push(event.key));
    expect(await runScenario([{ do: 'key', text: 'F2', target: '#row' }], env())).toBe('');
    expect(keys).toEqual(['F2']);
    expect(document.activeElement).toBe(row);
  });

  // A click on an editable page leaves the caret at the end of its text, so
  // what is typed next goes into the page.
  it('clicks into an editable page with the caret at its end', async () => {
    document.body.innerHTML = '<div id="page" contenteditable="true"><p>Hello</p></div>';
    const page = document.querySelector<HTMLElement>('#page')!;
    expect(await runScenario([{ do: 'click', target: '#page' }], env())).toBe('');
    expect(document.activeElement).toBe(page);
    const selection = document.getSelection()!;
    expect(page.contains(selection.anchorNode)).toBe(true);
    expect(selection.isCollapsed).toBe(true);
    expect(selection.anchorOffset).toBe(selection.anchorNode!.nodeType === Node.TEXT_NODE ? 5 : selection.anchorNode!.childNodes.length);
  });

  // A page's typing shortcuts ($x$, ```) react to typing, not to text put in
  // at once as a paste is: the driver types as a person does.
  it('types into an editable page one character at a time', async () => {
    document.body.innerHTML = '<div id="page" contenteditable="true"><p>x</p></div>';
    const typed: string[] = [];
    const exec = vi.fn((_command: string, _ui: boolean, text: string) => {
      typed.push(text);
      return true;
    });
    Object.defineProperty(document, 'execCommand', { value: exec, configurable: true });
    expect(await runScenario([{ do: 'click', target: '#page' }, { do: 'type', text: '$x$' }], env())).toBe('');
    expect(typed).toEqual(['$', 'x', '$']);
  });

  it('clicks an element by its text', async () => {
    document.body.innerHTML = '<button>Cancel</button><button>Create</button>';
    let clicked = '';
    for (const b of document.querySelectorAll('button')) b.addEventListener('click', () => (clicked = b.textContent ?? ''));
    expect(await runScenario([{ do: 'click', target: 'text=Create' }], env())).toBe('');
    expect(clicked).toBe('Create');
  });

  // A closed menu keeps its items in the page, hidden: "New Space" is both a
  // start-screen button and a hidden switcher item, and the button is meant.
  it('clicks the match that is showing, not a hidden one with the same text', async () => {
    document.body.innerHTML = '<button id="start">New Space</button><div hidden><span id="menu">New Space</span></div>';
    let clicked = '';
    for (const el of document.querySelectorAll('#start, #menu')) el.addEventListener('click', () => (clicked = el.id));
    const e = { ...env(), visible: (el: HTMLElement) => el.isConnected && !el.closest('[hidden]') };
    expect(await runScenario([{ do: 'click', target: 'text=New Space' }], e)).toBe('');
    expect(clicked).toBe('start');
  });

  it('pauses for as long as a pause step says, as a page loads', async () => {
    const started = Date.now();
    expect(await runScenario([{ do: 'pause', timeoutMs: 60 }], env())).toBe('');
    expect(Date.now() - started).toBeGreaterThanOrEqual(55);
  });

  it('sends menu commands and takes shots in order', async () => {
    const e = env();
    await runScenario([{ do: 'menu', target: 'file.save' }, { do: 'shot', name: 'saved' }], e);
    expect(e.calls).toEqual(['menu file.save', 'shot saved']);
  });

  it('stops at the first step that fails, and says which', async () => {
    const e = env();
    const failure = await runScenario([{ do: 'shot', name: 'a' }, { do: 'wait', target: '#never' }, { do: 'shot', name: 'b' }], e);
    expect(failure).toMatch(/^step 2 \(wait #never\)/);
    expect(e.calls).toEqual(['shot a']);
  });

  it('drags with the pointer from one point to another on its target', async () => {
    document.body.innerHTML = '<div class="canvas-host"></div>';
    const host = document.querySelector<HTMLElement>('.canvas-host')!;
    const seen: string[] = [];
    for (const type of ['pointerdown', 'pointermove', 'pointerup']) {
      host.addEventListener(type, (event) => seen.push(`${type} ${(event as MouseEvent).clientX},${(event as MouseEvent).clientY}`));
    }
    expect(await runScenario([{ do: 'drag', target: '.canvas-host', from: [10, 20], to: [110, 70] }], env())).toBe('');
    expect(seen[0]).toBe('pointerdown 10,20');
    expect(seen.at(-1)).toBe('pointerup 110,70');
  });
});

// The driver ships only in a smoke test build: the app loads it behind the
// build flag, never unconditionally.
describe('loading the driver', () => {
  it('is only imported behind VITE_BAVA_E2E', async () => {
    const { readFileSync } = await import('node:fs');
    const main = readFileSync('src/main.ts', 'utf8');
    const imports = main.split('\n').filter((line) => line.includes('e2e/driver'));
    expect(imports.length).toBe(1);
    expect(main).toMatch(/if \(import\.meta\.env\.VITE_BAVA_E2E === '1'\)[^\n]*\n?[^\n]*import\('\.\/e2e\/driver'\)/);
    expect(main).not.toMatch(/^import .*e2e\/driver/m);
  });
});
