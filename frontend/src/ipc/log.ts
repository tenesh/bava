/**
 * Frontend errors, into Bava's log.
 *
 * Everything goes to Go's `LogService.Report`, which writes the session log on
 * the user's machine. Nothing is sent anywhere else — there is nowhere else.
 */
import { LogService } from '../../bindings/github.com/tenesh/bava/internal/app';

export type LogEntry = { level: 'error' | 'warn'; kind: string; stack: string; source: string };

/**
 * What of a thrown value may be logged: its kind and its stack frames, never
 * its message or its value. JavaScript messages quote input — a JSON syntax
 * error shows the text it choked on — and a thrown value can be anything.
 */
export function normalise(value: unknown): { kind: string; stack: string } {
  if (value instanceof Error) {
    return { kind: value.name || 'Error', stack: framesOnly(value.stack ?? '', value.message) };
  }
  if (value === null) return { kind: 'null', stack: '' };
  return { kind: typeof value, stack: '' };
}

/**
 * Frame lines only. V8 puts "Name: message" on the first line of a stack;
 * WebKit does not. Any line carrying the message is dropped either way.
 */
function framesOnly(stack: string, message: string): string {
  return stack
    .split('\n')
    .filter((line) => !(message && line.includes(message)))
    .join('\n');
}

export type Report = (error: unknown, source: string) => Promise<void>;

/**
 * A reporter over `send`. It never throws: a failure to log must not become a
 * second error. When sending fails it says so on the console once, rather than
 * reporting its own failure in a loop.
 */
export function createReporter(send: (entry: LogEntry) => Promise<unknown>): Report {
  let warned = false;
  return async (error, source) => {
    const { kind, stack } = normalise(error);
    try {
      await send({ level: 'error', kind, stack, source });
    } catch (sendError) {
      if (warned) return;
      warned = true;
      console.error('Bava could not write to its log', sendError);
    }
  };
}

/** The app's reporter, over the Go binding. */
export const report: Report = createReporter((entry) => LogService.Report(entry));

/**
 * Catch what nothing else caught: uncaught exceptions and unhandled promise
 * rejections. Each is reported, then `onUnexpected` decides what the user sees.
 * Returns a remover.
 */
export function installErrorHandlers(
  target: EventTarget,
  handlers: { report: (error: unknown, source: string) => unknown; onUnexpected: (error: unknown) => void },
): () => void {
  const onError = (event: Event) => {
    const error = (event as ErrorEvent).error ?? (event as ErrorEvent).message;
    void handlers.report(error, 'window');
    handlers.onUnexpected(error);
  };
  const onRejection = (event: Event) => {
    const reason = (event as PromiseRejectionEvent).reason;
    void handlers.report(reason, 'rejection');
    handlers.onUnexpected(reason);
  };
  target.addEventListener('error', onError);
  target.addEventListener('unhandledrejection', onRejection);
  return () => {
    target.removeEventListener('error', onError);
    target.removeEventListener('unhandledrejection', onRejection);
  };
}
