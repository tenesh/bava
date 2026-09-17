import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLaunch } from './launch.svelte';

// A promise the test settles by hand.
function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('launch readiness', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is not ready while settings are loading', async () => {
    const settings = deferred();
    const launch = createLaunch({ settings: settings.promise, fonts: Promise.resolve(), capMs: 2000 });
    await vi.advanceTimersByTimeAsync(10);
    expect(launch.ready).toBe(false);
  });

  it('is ready once settings and fonts settle', async () => {
    const settings = deferred();
    const fonts = deferred();
    const launch = createLaunch({ settings: settings.promise, fonts: fonts.promise, capMs: 2000 });
    settings.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(launch.ready).toBe(false);
    fonts.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(launch.ready).toBe(true);
  });

  it('a failed settings load still finishes', async () => {
    const settings = deferred();
    const launch = createLaunch({ settings: settings.promise, fonts: Promise.resolve(), capMs: 2000 });
    settings.reject(new Error('unreadable'));
    await vi.advanceTimersByTimeAsync(0);
    expect(launch.ready).toBe(true);
  });

  it('is ready after the cap if a promise never settles', async () => {
    const launch = createLaunch({ settings: new Promise(() => {}), fonts: Promise.resolve(), capMs: 2000 });
    await vi.advanceTimersByTimeAsync(1999);
    expect(launch.ready).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(launch.ready).toBe(true);
  });
});
