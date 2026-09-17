import { describe, expect, it, vi } from 'vitest';
import { createReporter, installErrorHandlers, normalise } from './log';

describe('normalise', () => {
  // A message can quote input (a JSON syntax error shows the text it choked
  // on), so only the error's kind and its stack frames leave the page.
  it('keeps the kind and frames of an Error, never its message', () => {
    const error = new SyntaxError('Unexpected token in SECRET-DOC-TEXT');
    error.stack = 'SyntaxError: Unexpected token in SECRET-DOC-TEXT\n    at parse (app.js:1:2)\nparse@app.js:1:2';
    const entry = normalise(error);
    expect(entry.kind).toBe('SyntaxError');
    expect(entry.stack).not.toContain('SECRET-DOC-TEXT');
    expect(entry.stack).toContain('app.js:1:2');
  });

  // Anything can be thrown; its type is recorded, never its value.
  it('records only the type of a non-Error value', () => {
    expect(normalise('SECRET-STRING')).toEqual({ kind: 'string', stack: '' });
    expect(normalise({ secret: 'SECRET' })).toEqual({ kind: 'object', stack: '' });
    expect(normalise(undefined)).toEqual({ kind: 'undefined', stack: '' });
    expect(normalise(null)).toEqual({ kind: 'null', stack: '' });
  });
});

describe('createReporter', () => {
  it('sends the entry with its source', async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    await createReporter(send)(new Error('bad'), 'canvas');
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ level: 'error', kind: 'Error', source: 'canvas' }));
  });

  // If the log itself is broken, reporting that must not loop.
  it('falls back to the console once when sending fails, and never throws', async () => {
    const send = vi.fn().mockRejectedValue(new Error('no backend'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const report = createReporter(send);
    await expect(report(new Error('one'), 'x')).resolves.toBeUndefined();
    await report(new Error('two'), 'x');
    expect(send).toHaveBeenCalledTimes(2);
    expect(consoleError).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });
});

describe('installErrorHandlers', () => {
  it('reports an uncaught error and an unhandled rejection once each', () => {
    const target = new EventTarget();
    const report = vi.fn();
    const onUnexpected = vi.fn();
    const remove = installErrorHandlers(target, { report, onUnexpected });

    const errorEvent = Object.assign(new Event('error'), { error: new Error('thrown') });
    target.dispatchEvent(errorEvent);
    const rejection = Object.assign(new Event('unhandledrejection'), { reason: 'rejected' });
    target.dispatchEvent(rejection);

    expect(report).toHaveBeenCalledTimes(2);
    expect(report).toHaveBeenNthCalledWith(1, expect.any(Error), 'window');
    expect(report).toHaveBeenNthCalledWith(2, 'rejected', 'rejection');
    expect(onUnexpected).toHaveBeenCalledTimes(2);

    remove();
    target.dispatchEvent(errorEvent);
    expect(report).toHaveBeenCalledTimes(2);
  });
});
