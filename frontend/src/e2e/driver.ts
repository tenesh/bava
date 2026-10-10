/**
 * The smoke test driver's page side: runs a scenario's steps as a person
 * would (click, type, press keys, drag), sends native menu commands, and asks
 * Go for a screenshot at each shot. Loaded only in a -tags e2e build, behind
 * VITE_BAVA_E2E; the app never imports it otherwise.
 */
import { Call } from '@wailsio/runtime';

/** Keys held through a key or a drag: `mod` is ⌘ on macOS and Ctrl elsewhere. */
export type Modifier = 'shift' | 'alt' | 'mod';

export type Step = {
  do: 'click' | 'type' | 'key' | 'menu' | 'wait' | 'gone' | 'shot' | 'drag' | 'pause' | 'paste' | 'file' | 'pdf';
  /**
   * What a click, wait or drag acts on; for a key, what it is pressed on (else
   * whatever has focus); for a file, its path in the scratch folder.
   */
  target?: string;
  text?: string;
  name?: string;
  from?: [number, number];
  to?: [number, number];
  timeoutMs?: number;
  modifiers?: Modifier[];
};

export type DriverEnv = {
  menu(id: string): void;
  shot(name: string): Promise<string>;
  /** A file in the scratch folder, read by the host: its text, or why it could not be. */
  readFile?(path: string): Promise<{ text: string; error: string }>;
  /** The host prints a sample page to a PDF and reads it back: '' when it holds what it must, else why not. */
  printSample?(file: string, setup: string, expect: string): Promise<string>;
  timeoutMs: number;
  /** Whether a found element counts as showing; the page's layout by default. */
  visible?: (el: HTMLElement) => boolean;
  /** What the page raised so far, named in a failed step's report. */
  errors?: () => string[];
};

/** A thrown value in words: an error's name and message, anything else as it is. */
const described = (value: unknown) => (value instanceof Error ? `${value.name}: ${value.message}` : String(value));

/**
 * Every uncaught error and unhandled rejection on `target`, message and all:
 * a run's report says what the page raised, which the app's own log leaves
 * out. A driver build only; nothing here reaches a user's log.
 */
export function watchErrors(target: EventTarget) {
  const seen: string[] = [];
  const onError = (event: Event) => {
    const { error, message } = event as ErrorEvent;
    seen.push(`error: ${error ? described(error) : message}`);
  };
  const onRejection = (event: Event) => void seen.push(`rejection: ${described((event as PromiseRejectionEvent).reason)}`);
  target.addEventListener('error', onError);
  target.addEventListener('unhandledrejection', onRejection);
  return {
    seen: () => [...seen],
    stop() {
      target.removeEventListener('error', onError);
      target.removeEventListener('unhandledrejection', onRejection);
    },
  };
}

const SERVICE = 'github.com/tenesh/bava/internal/e2e.Service';

/**
 * Everything a target names: a CSS selector's matches, or for `text=…` the
 * innermost elements showing exactly that text. A closed menu keeps its items
 * in the page, hidden, so a step always takes the first match that shows.
 */
function candidates(target: string): HTMLElement[] {
  if (!target.startsWith('text=')) return [...document.querySelectorAll<HTMLElement>(target)];
  const text = target.slice('text='.length);
  const all = [...document.querySelectorAll<HTMLElement>('button, a, [role], li, span, div, label')];
  const exact = all.filter((el) => el.textContent?.trim() === text);
  // Innermost: drop any match that contains another match.
  return exact.filter((el) => !exact.some((other) => other !== el && el.contains(other)));
}

/** Laid out and in the page: what a person could see. */
const laidOut = (el: HTMLElement) => el.isConnected && el.getClientRects().length > 0;

async function until(check: () => boolean, timeoutMs: number): Promise<boolean> {
  const end = Date.now() + timeoutMs;
  for (;;) {
    if (check()) return true;
    if (Date.now() > end) return false;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

const onMac = () => /Mac/.test(navigator.platform);

/** The event flags for the keys held. */
function held(modifiers: Modifier[] = []) {
  const mod = modifiers.includes('mod');
  return { shiftKey: modifiers.includes('shift'), altKey: modifiers.includes('alt'), metaKey: mod && onMac(), ctrlKey: mod && !onMac() };
}

function pointer(el: HTMLElement, type: string, [x, y]: [number, number], modifiers?: Modifier[]) {
  const init = {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button: 0,
    buttons: type === 'pointerup' ? 0 : 1,
    pointerId: 1,
    isPrimary: true,
    ...held(modifiers),
  };
  const Ctor = typeof PointerEvent === 'function' ? PointerEvent : MouseEvent;
  el.dispatchEvent(new Ctor(type, init));
}

function click(el: HTMLElement) {
  const box = el.getBoundingClientRect();
  const at: [number, number] = [box.left + box.width / 2, box.top + box.height / 2];
  pointer(el, 'pointerdown', at);
  el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: at[0], clientY: at[1] }));
  // A press focuses what it lands on, as a person's does: the nearest element
  // that takes focus. The click's own handlers may move focus on from there.
  el.closest<HTMLElement>('button, a[href], input, select, textarea, [tabindex]')?.focus();
  pointer(el, 'pointerup', at);
  el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: at[0], clientY: at[1] }));
  el.click();
  // A synthetic click places no caret; an editable page gets one at its end.
  const editable = el.closest<HTMLElement>('[contenteditable="true"]');
  if (editable) {
    editable.focus();
    const range = document.createRange();
    range.selectNodeContents(editable);
    range.collapse(false);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);
  }
}

async function type(text: string) {
  const el = document.activeElement as HTMLElement | null;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set;
    setter?.call(el, el.value.slice(0, el.selectionStart ?? el.value.length) + text + el.value.slice(el.selectionEnd ?? el.value.length));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  // An editor that owns its text takes it as typed input, a character at a
  // time as a person types: its typing shortcuts react to typing, and read
  // text put in at once as a paste. The editor reads each change a moment
  // later, so each character waits for the one before.
  for (const char of text) {
    document.execCommand('insertText', false, char);
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

/** A key pressed on `on` (focused first), or on whatever has focus. */
function key(name: string, on?: HTMLElement, modifiers?: Modifier[]) {
  on?.focus();
  const el = on ?? (document.activeElement as HTMLElement | null) ?? document.body;
  el.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...held(modifiers) }));
  el.dispatchEvent(new KeyboardEvent('keyup', { key: name, bubbles: true, cancelable: true, ...held(modifiers) }));
}

/** Whether the control holding `el` cannot be used now. */
function disabled(el: HTMLElement): boolean {
  const control = el.closest<HTMLButtonElement | HTMLInputElement>('button, input, select, textarea');
  return (control?.disabled ?? false) || el.closest('[aria-disabled="true"]') !== null;
}

async function step(s: Step, env: DriverEnv): Promise<string> {
  const timeout = s.timeoutMs ?? env.timeoutMs;
  const visible = env.visible ?? laidOut;
  switch (s.do) {
    case 'click': {
      let el: HTMLElement | undefined;
      if (!(await until(() => (el = candidates(s.target!).find(visible)) !== undefined, timeout))) return 'not found';
      // A disabled control is waited for, as a person waits for it to light up.
      if (!(await until(() => !disabled(el!), timeout))) return 'never enabled';
      click(el!);
      return '';
    }
    case 'type':
      await type(s.text!);
      return '';
    case 'key': {
      if (!s.target) {
        key(s.text!, undefined, s.modifiers);
        return '';
      }
      let el: HTMLElement | undefined;
      if (!(await until(() => (el = candidates(s.target!).find(visible)) !== undefined, timeout))) return 'not found';
      key(s.text!, el!.closest<HTMLElement>('button, a[href], input, select, textarea, [tabindex]') ?? el!, s.modifiers);
      return '';
    }
    case 'menu':
      env.menu(s.target!);
      return '';
    case 'wait': {
      const ok = await until(
        () => candidates(s.target!).some((el) => visible(el) && (!s.text || (el.textContent ?? '').includes(s.text))),
        timeout,
      );
      return ok ? '' : s.text ? `never showed "${s.text}"` : 'never showed';
    }
    case 'gone':
      return (await until(() => !candidates(s.target!).some(visible), timeout)) ? '' : 'still there';
    case 'shot':
      return env.shot(s.name!);
    // Text pasted into what has focus, as ⌘V over the page gives it.
    case 'paste': {
      // The clipboard given as the event's own: a script cannot fill the real one.
      const event = new Event('paste', { bubbles: true, cancelable: true });
      const text = s.text!;
      Object.defineProperty(event, 'clipboardData', {
        value: { types: ['text/plain'], files: [], items: [], getData: (type: string) => (type === 'text/plain' ? text : '') },
      });
      (document.activeElement ?? document.body).dispatchEvent(event);
      return '';
    }
    // Time for what cannot be waited on from the page, such as a web player loading.
    case 'pause':
      await new Promise((resolve) => setTimeout(resolve, s.timeoutMs));
      return '';
    case 'drag': {
      const el = candidates(s.target!).find(visible);
      if (!el) return 'not found';
      const box = el.getBoundingClientRect();
      const at = ([x, y]: [number, number]): [number, number] => [box.left + x, box.top + y];
      pointer(el, 'pointerdown', at(s.from!), s.modifiers);
      for (let i = 1; i <= 8; i += 1) {
        const f = i / 8;
        pointer(el, 'pointermove', at([s.from![0] + (s.to![0] - s.from![0]) * f, s.from![1] + (s.to![1] - s.from![1]) * f]), s.modifiers);
      }
      pointer(el, 'pointerup', at(s.to!), s.modifiers);
      return '';
    }
    // A saved file, read back until it holds the text: a save lands a moment
    // after it is asked for.
    case 'file': {
      if (!env.readFile) return 'no way to read files';
      const end = Date.now() + timeout;
      for (;;) {
        const last = await env.readFile(s.target!);
        if (last.error) return last.error;
        if (last.text.includes(s.text!)) return '';
        if (Date.now() > end) return `never held "${s.text}"`;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    // The system's own printing, proven: the host prints and checks the file.
    case 'pdf': {
      if (!env.printSample) return 'no way to print';
      return env.printSample(s.target!, s.name!, s.text!);
    }
  }
}

/**
 * Runs the steps in order; returns '' when all pass, else which step failed
 * and why. A failed step first has the window pictured as it found it,
 * `failure` among the run's screenshots; a picture that cannot be taken
 * leaves the report as it is.
 */
export async function runScenario(steps: Step[], env: DriverEnv): Promise<string> {
  for (const [index, s] of steps.entries()) {
    const failure = await step(s, env);
    if (failure) {
      await env.shot('failure').catch(() => '');
      const raised = env.errors?.() ?? [];
      const also = raised.length > 0 ? `; the page raised: ${raised.join('; ')}` : '';
      return `step ${index + 1} (${s.do}${s.target ? ` ${s.target}` : ''}): ${failure}${also}`;
    }
    // Let the app settle between steps, as a person's pace would.
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return '';
}

/** Asks Go for the scenario, runs it, and reports the result, which quits the app. */
export async function start(): Promise<void> {
  const scenario = (await Call.ByName(`${SERVICE}.Scenario`)) as { steps: Step[] };
  const watch = watchErrors(window);
  const failure = await runScenario(scenario.steps, {
    errors: watch.seen,
    menu: (id) =>
      (window as unknown as { _wails: { dispatchWailsEvent(e: { name: string; data: unknown }): void } })._wails.dispatchWailsEvent({
        name: 'menu:command',
        data: { id },
      }),
    shot: async (name) => (await Call.ByName(`${SERVICE}.Shot`, name)) as string,
    readFile: async (path) => (await Call.ByName(`${SERVICE}.ReadFile`, path)) as { text: string; error: string },
    printSample: async (file, setup, expect) => (await Call.ByName(`${SERVICE}.PrintSample`, file, setup, expect)) as string,
    timeoutMs: 10_000,
  }).catch((error: unknown) => `the driver failed: ${String(error)}`);
  await Call.ByName(`${SERVICE}.Done`, failure);
}
