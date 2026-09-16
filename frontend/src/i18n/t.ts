import { messages, type MessageKey } from './messages';

/**
 * Look up a user-facing string.
 *
 * The key type is the guard: an unknown key fails to compile rather than
 * rendering itself at runtime, which is how untranslated text ships unnoticed.
 */
export function t(key: MessageKey): string {
  return messages[key];
}
