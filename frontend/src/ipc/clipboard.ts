/**
 * The system clipboard's text, as the app reads and writes it: through
 * Wails, the same on every platform and asking no permission. One place, so
 * the browser tests can stand in for it.
 */
import { Clipboard } from '@wailsio/runtime';

export const systemClipboard = {
  text: (): Promise<string> => Clipboard.Text(),
  setText: (text: string): Promise<void> => Clipboard.SetText(text).then(() => {}),
};
