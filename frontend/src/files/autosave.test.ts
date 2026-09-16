import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAutosave, type AutosaveMode } from './autosave.svelte';

function setup(mode: AutosaveMode, over: { path?: string | null; conflict?: boolean } = {}) {
  const doc = { path: over.path === undefined ? '/w/notes.md' : over.path, dirty: false };
  const save = vi.fn(async () => {
    if (over.conflict) return { conflict: true, saved: false };
    doc.dirty = false;
    return { conflict: false, saved: true };
  });
  const autosave = createAutosave({
    settings: () => ({ mode, delayMs: 1000 }),
    document: doc,
    save,
  });
  const edit = () => {
    doc.dirty = true;
    autosave.changed();
  };
  return { doc, save, autosave, edit };
}

describe('autosave', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('TestAfterDelaySavesOnceAfterTheLastChange', async () => {
    const { save, edit } = setup('afterDelay');
    edit();
    await vi.advanceTimersByTimeAsync(600);
    edit();
    await vi.advanceTimersByTimeAsync(600);
    // Still typing: the first timer was replaced, not left to fire.
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(400);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('TestOnFocusChangeSavesWhenTheWindowLosesFocus', async () => {
    const { save, edit, autosave } = setup('onFocusChange');
    edit();
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).not.toHaveBeenCalled();
    await autosave.focusLost();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('does not save on focus loss with nothing to save', async () => {
    const { save, autosave } = setup('onFocusChange');
    await autosave.focusLost();
    expect(save).not.toHaveBeenCalled();
  });

  // Autosaving an untitled document would mean opening a save dialog nobody
  // asked for, or inventing a path. Neither.
  it('TestNeverAutosavesAnUntitledDocument', async () => {
    for (const mode of ['afterDelay', 'onFocusChange'] as const) {
      const { save, edit, autosave } = setup(mode, { path: null });
      edit();
      await vi.advanceTimersByTimeAsync(5000);
      await autosave.focusLost();
      expect(save).not.toHaveBeenCalled();
    }
  });

  // A dialog popping up while someone types, because a background save found
  // a conflict, is worse than no autosave. It stops and says so quietly.
  it('TestAConflictPausesAutosaveWithoutPrompting', async () => {
    const { save, edit, autosave } = setup('afterDelay', { conflict: true });
    edit();
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledTimes(1);
    expect(autosave.paused).toBe(true);
    expect(autosave.pauseReason).toBe('conflict');

    edit();
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).toHaveBeenCalledTimes(1);

    autosave.resume();
    expect(autosave.paused).toBe(false);
  });

  it('TestOffNeverSaves', async () => {
    const { save, edit, autosave } = setup('off');
    edit();
    await vi.advanceTimersByTimeAsync(60_000);
    await autosave.focusLost();
    expect(save).not.toHaveBeenCalled();
  });

  // A change landing while a save is in flight must get a save of its own, not
  // be swallowed by the one already running.
  it('saves again for a change made during a save', async () => {
    const doc = { path: '/w/notes.md' as string | null, dirty: false };
    let finish: () => void = () => {};
    const save = vi.fn(
      () =>
        new Promise<{ conflict: boolean; saved: boolean }>((resolve) => {
          finish = () => resolve({ conflict: false, saved: true });
        }),
    );
    const autosave = createAutosave({ settings: () => ({ mode: 'afterDelay', delayMs: 1000 }), document: doc, save });

    doc.dirty = true;
    autosave.changed();
    await vi.advanceTimersByTimeAsync(1000);
    expect(save).toHaveBeenCalledTimes(1);

    // The user edits while the first write is still going.
    autosave.changed();
    await vi.advanceTimersByTimeAsync(1000);
    finish();
    await vi.advanceTimersByTimeAsync(0);

    expect(save).toHaveBeenCalledTimes(2);
  });

  it('pauses, rather than throwing from a timer, when a save fails outright', async () => {
    const { save, edit, autosave } = setup('afterDelay');
    save.mockRejectedValueOnce(new Error('disk gone'));
    edit();
    await vi.advanceTimersByTimeAsync(1000);
    expect(autosave.paused).toBe(true);
    expect(autosave.pauseReason).toBe('error');
  });

  it('stops a pending save when destroyed', async () => {
    const { save, edit, autosave } = setup('afterDelay');
    edit();
    autosave.destroy();
    await vi.advanceTimersByTimeAsync(5000);
    expect(save).not.toHaveBeenCalled();
  });

  it('keeps going after a save that failed for another reason', async () => {
    const { save, edit, autosave } = setup('afterDelay');
    save.mockResolvedValueOnce({ conflict: false, saved: false });
    edit();
    await vi.advanceTimersByTimeAsync(1000);
    expect(autosave.paused).toBe(false);
  });
});
