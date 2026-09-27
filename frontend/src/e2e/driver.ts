/**
 * The smoke test driver's page side: runs a scenario's steps as a person
 * would (click, type, press keys, drag), sends native menu commands, and asks
 * Go for a screenshot at each shot. Loaded only in a -tags e2e build, behind
 * VITE_BAVA_E2E; the app never imports it otherwise.
 */
import { Call } from '@wailsio/runtime';

export type Step = {
  do: 'click' | 'type' | 'key' | 'menu' | 'wait' | 'gone' | 'shot' | 'drag';
  target?: string;
  text?: string;
  name?: string;
  from?: [number, number];
  to?: [number, number];
  timeoutMs?: number;
};

export type DriverEnv = {
  menu(id: string): void;
  shot(name: string): Promise<string>;
  timeoutMs: number;
  /** Whether a found element counts as showing; the page's layout by default. */
  visible?: (el: HTMLElement) => boolean;
};

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

function pointer(el: HTMLElement, type: string, [x, y]: [number, number]) {
  const init = { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, buttons: type === 'pointerup' ? 0 : 1, pointerId: 1, isPrimary: true };
  const Ctor = typeof PointerEvent === 'function' ? PointerEvent : MouseEvent;
  el.dispatchEvent(new Ctor(type, init));
}

function click(el: HTMLElement) {
  const box = el.getBoundingClientRect();
  const at: [number, number] = [box.left + box.width / 2, box.top + box.height / 2];
  pointer(el, 'pointerdown', at);
  el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX: at[0], clientY: at[1] }));
  pointer(el, 'pointerup', at);
  el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX: at[0], clientY: at[1] }));
  el.click();
}

function type(text: string) {
  const el = document.activeElement as HTMLElement | null;
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set;
    setter?.call(el, el.value.slice(0, el.selectionStart ?? el.value.length) + text + el.value.slice(el.selectionEnd ?? el.value.length));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  // An editor that owns its text (the source pane) takes it as typed input.
  document.execCommand('insertText', false, text);
}

function key(name: string) {
  const el = (document.activeElement as HTMLElement | null) ?? document.body;
  el.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
  el.dispatchEvent(new KeyboardEvent('keyup', { key: name, bubbles: true, cancelable: true }));
}

async function step(s: Step, env: DriverEnv): Promise<string> {
  const timeout = s.timeoutMs ?? env.timeoutMs;
  const visible = env.visible ?? laidOut;
  switch (s.do) {
    case 'click': {
      let el: HTMLElement | undefined;
      if (!(await until(() => (el = candidates(s.target!).find(visible)) !== undefined, timeout))) return 'not found';
      click(el!);
      return '';
    }
    case 'type':
      type(s.text!);
      return '';
    case 'key':
      key(s.text!);
      return '';
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
    case 'drag': {
      const el = candidates(s.target!).find(visible);
      if (!el) return 'not found';
      const box = el.getBoundingClientRect();
      const at = ([x, y]: [number, number]): [number, number] => [box.left + x, box.top + y];
      pointer(el, 'pointerdown', at(s.from!));
      for (let i = 1; i <= 8; i += 1) {
        const f = i / 8;
        pointer(el, 'pointermove', at([s.from![0] + (s.to![0] - s.from![0]) * f, s.from![1] + (s.to![1] - s.from![1]) * f]));
      }
      pointer(el, 'pointerup', at(s.to!));
      return '';
    }
  }
}

/** Runs the steps in order; returns '' when all pass, else which step failed and why. */
export async function runScenario(steps: Step[], env: DriverEnv): Promise<string> {
  for (const [index, s] of steps.entries()) {
    const failure = await step(s, env);
    if (failure) return `step ${index + 1} (${s.do}${s.target ? ` ${s.target}` : ''}): ${failure}`;
    // Let the app settle between steps, as a person's pace would.
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return '';
}

/** Asks Go for the scenario, runs it, and reports the result, which quits the app. */
export async function start(): Promise<void> {
  const scenario = (await Call.ByName(`${SERVICE}.Scenario`)) as { steps: Step[] };
  const failure = await runScenario(scenario.steps, {
    menu: (id) =>
      (window as unknown as { _wails: { dispatchWailsEvent(e: { name: string; data: unknown }): void } })._wails.dispatchWailsEvent({
        name: 'menu:command',
        data: { id },
      }),
    shot: async (name) => (await Call.ByName(`${SERVICE}.Shot`, name)) as string,
    timeoutMs: 10_000,
  }).catch((error: unknown) => `the driver failed: ${String(error)}`);
  await Call.ByName(`${SERVICE}.Done`, failure);
}
