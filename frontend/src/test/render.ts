/**
 * Mounting for component tests, and the teardown that undoes it.
 *
 * `render` mounts a component into a fresh element on the page and records
 * it; the shared teardown in `src/test-setup.ts` unmounts whatever is still
 * mounted when a test ends, so no test unmounts its own. Anything else a test
 * makes that needs taking down (an editor, a stage) registers it with
 * `onTeardown`.
 */
import { flushSync, mount, unmount as unmountComponent, type Component, type ComponentProps } from 'svelte';

type Mounted = Record<string, unknown>;

const mounted = new Set<Mounted>();
const cleanups: (() => void)[] = [];

/** Mounts `component` with `props` into a new element on the page, effects flushed. */
export function render<C extends Component<any, any, any>>( // eslint-disable-line @typescript-eslint/no-explicit-any
  component: C,
  props?: ComponentProps<C>,
): { target: HTMLDivElement; app: ReturnType<C> } {
  const target = document.createElement('div');
  document.body.append(target);
  const app = flushSync(() =>
    mount(component as Component<Record<string, unknown>, Mounted>, { target, props: (props ?? {}) as Record<string, unknown> }),
  );
  mounted.add(app);
  return { target, app: app as ReturnType<C> };
}

/** Unmounts a component before the test ends, for a test about what follows. */
export function unmount(app: object): void {
  if (!mounted.delete(app as Mounted)) return;
  flushSync(() => void unmountComponent(app as Mounted));
}

/** Runs `cleanup` when the current test ends, before the page is emptied. */
export function onTeardown(cleanup: () => void): void {
  cleanups.push(cleanup);
}

const macrotask = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const frame = () =>
  new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => resolve());
    else resolve();
  });

/**
 * Takes down everything the test left: registered cleanups, then mounted
 * components, newest first. With a page, it then lets deferred work (a dialog's focus
 * restore, a closing animation's timer) run while the page still exists, so
 * nothing it logs lands in a later test, and empties the page.
 */
export async function teardown(): Promise<void> {
  const errors: unknown[] = [];
  for (const cleanup of cleanups.splice(0).reverse()) {
    try {
      cleanup();
    } catch (error) {
      errors.push(error);
    }
  }
  for (const app of [...mounted].reverse()) {
    mounted.delete(app);
    try {
      flushSync(() => void unmountComponent(app));
    } catch (error) {
      errors.push(error);
    }
  }
  if (typeof document !== 'undefined') {
    await macrotask();
    await frame();
    await macrotask();
    document.body.innerHTML = '';
    try {
      localStorage.clear();
    } catch {
      // A page without storage has nothing to clear.
    }
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new AggregateError(errors, `${errors.length} cleanups failed`);
}
