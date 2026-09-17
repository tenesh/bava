import { describe, expect, it, vi } from 'vitest';
import { createErrorPolicy as create } from './errors.svelte';

// Keys stand in for the translated text, so the tests read what is chosen.
const translate = (key: string) => `<${key}>`;
const createErrorPolicy = (options: { notify: () => void }) => create({ ...options, translate });

describe('error policy', () => {
  // One dialog is information; a dialog per error in a loop is an app nobody
  // can use.
  it('first unexpected error opens the dialog, later ones only notify', () => {
    const notify = vi.fn();
    const errors = createErrorPolicy({ notify });

    errors.unexpected(new TypeError('first failure'));
    expect(errors.current?.kind).toBe('unexpected');
    expect(errors.current?.details).toContain('TypeError');

    errors.unexpected(new RangeError('second failure'));
    expect(notify).toHaveBeenCalledTimes(1);
    expect(errors.current?.details).toContain('TypeError');

    errors.dismiss();
    errors.unexpected(new Error('third failure'));
    expect(errors.current).toBeNull();
    expect(notify).toHaveBeenCalledTimes(2);
  });

  it('an unexpected-exit notice opens with its own wording', () => {
    const errors = createErrorPolicy({ notify: vi.fn() });
    errors.notice({ kind: 'unexpectedExit', session: '2026-09-17T10-00-00-7.log' });
    expect(errors.current?.kind).toBe('unexpectedExit');
    expect(errors.current?.details).toBe('<error.previousLog>: 2026-09-17T10-00-00-7.log');
  });

  it('shows queued notices one after another', () => {
    const errors = createErrorPolicy({ notify: vi.fn() });
    errors.notice({ kind: 'unexpectedExit', session: 'a.log' });
    errors.notice({ kind: 'webviewReloaded', session: '' });
    expect(errors.current?.kind).toBe('unexpectedExit');
    errors.dismiss();
    expect(errors.current?.kind).toBe('webviewReloaded');
    errors.dismiss();
    expect(errors.current).toBeNull();
  });

  it('carries a Go error id into the details', () => {
    const errors = createErrorPolicy({ notify: vi.fn() });
    errors.unexpected({ id: 'a1b2c3d4' });
    expect(errors.current?.details).toContain('<error.id>: a1b2c3d4');
  });

  // The dialog shows no more of an error than the log keeps.
  it('never puts an error message in the details', () => {
    const errors = createErrorPolicy({ notify: vi.fn() });
    errors.unexpected(new SyntaxError('Unexpected token near SECRET-TEXT'));
    expect(errors.current?.details).not.toContain('SECRET-TEXT');
  });
});
