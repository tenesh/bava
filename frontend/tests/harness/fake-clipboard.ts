/**
 * Stands in for `src/ipc/clipboard.ts` in the browser tests: the system
 * clipboard's text kept in the stand-in, where a walk can read or fill it
 * (`window.__bava.fakes.harness.clipboard`).
 */
import { fakes } from './bindings-app';

export const systemClipboard = {
  text: async (): Promise<string> => fakes.harness.clipboard,
  setText: async (text: string): Promise<void> => {
    fakes.harness.clipboard = text;
  },
};
