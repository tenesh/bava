/**
 * What the user is shown when something goes wrong unexpectedly.
 *
 * The first unexpected error in a session opens a dialog; after that, errors
 * are only logged and noted in the status bar, so a failure repeating in a
 * loop cannot stack modals. Notices from Go — the previous session ended
 * unexpectedly, the webview was reloaded — each open the dialog once.
 *
 * Expected errors (a save conflict, a file that will not open) never come
 * here: they have their own plain-language prompts.
 */
export type ErrorKind = 'unexpected' | 'unexpectedExit' | 'webviewReloaded';

export type Shown = { kind: ErrorKind; details: string };

export type GoNotice = { kind: string; session: string };

/** An error Go recovered from, as `app:error` carries it. */
export type GoError = { id: string };

export type Translate = (key: 'error.id' | 'error.kind' | 'error.previousLog' | 'error.webviewReloaded.details') => string;

export function createErrorPolicy(options: { notify: () => void; translate: Translate }) {
  const { translate } = options;

  // The details show no more than the log keeps: an id, or an error's kind.
  // Never a message, which can quote the user's content.
  function describe(error: unknown): string {
    if (error && typeof error === 'object' && 'id' in error) {
      return `${translate('error.id')}: ${(error as GoError).id}`;
    }
    const kind = error instanceof Error ? error.name || 'Error' : error === null ? 'null' : typeof error;
    return `${translate('error.kind')}: ${kind}`;
  }

  let queue = $state.raw<Shown[]>([]);
  let dialogShownThisSession = false;

  function show(item: Shown) {
    queue = [...queue, item];
  }

  return {
    /** What the dialog shows now, or null. */
    get current(): Shown | null {
      return queue[0] ?? null;
    },

    unexpected(error: unknown) {
      if (dialogShownThisSession) {
        options.notify();
        return;
      }
      dialogShownThisSession = true;
      show({ kind: 'unexpected', details: describe(error) });
    },

    notice(notice: GoNotice) {
      if (notice.kind === 'unexpectedExit') {
        show({
          kind: 'unexpectedExit',
          details: notice.session ? `${translate('error.previousLog')}: ${notice.session}` : '',
        });
      } else if (notice.kind === 'webviewReloaded') {
        show({ kind: 'webviewReloaded', details: translate('error.webviewReloaded.details') });
      }
    },

    dismiss() {
      queue = queue.slice(1);
    },
  };
}

export type ErrorPolicy = ReturnType<typeof createErrorPolicy>;
