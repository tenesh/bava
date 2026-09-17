/**
 * Whether the app has finished starting, for the splash.
 *
 * Ready once the settings load and the fonts have both settled, however the
 * settings load ended: a failure is reported elsewhere and must not keep the
 * window covered. The cap is the backstop for a call that never answers.
 */

/** The longest the splash may cover the window. */
export const LAUNCH_CAP_MS = 2000;

export type LaunchOptions = {
  settings: Promise<unknown>;
  fonts: Promise<unknown>;
  /** The longest the splash may cover the window, in milliseconds. */
  capMs: number;
};

export function createLaunch(options: LaunchOptions) {
  let ready = $state.raw(false);
  const finish = () => {
    ready = true;
    clearTimeout(cap);
  };
  const cap = setTimeout(finish, options.capMs);
  void Promise.allSettled([options.settings, options.fonts]).then(finish);

  return {
    get ready() {
      return ready;
    },
  };
}
