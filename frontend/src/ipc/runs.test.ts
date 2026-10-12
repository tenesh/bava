import { describe, expect, it, vi } from 'vitest';

describe('newRun', () => {
  it('never names two runs alike', async () => {
    const { newRun } = await import('./runs');
    expect(newRun()).not.toBe(newRun());
  });

  // A reloaded page starts its module again: its names still differ from the last page's.
  it('never repeats a name after the page reloads', async () => {
    const before = (await import('./runs')).newRun();
    vi.resetModules();
    const after = (await import('./runs')).newRun();
    expect(after).not.toBe(before);
  });
});
