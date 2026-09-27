/** The five looks a callout can have. */
export type CalloutLook = 'info' | 'note' | 'success' | 'warning' | 'error';

const LOOKS: Record<string, CalloutLook> = {
  info: 'info',
  todo: 'info',
  tip: 'info',
  hint: 'info',
  important: 'info',
  abstract: 'info',
  summary: 'info',
  tldr: 'info',
  success: 'success',
  check: 'success',
  done: 'success',
  warning: 'warning',
  caution: 'warning',
  attention: 'warning',
  error: 'error',
  danger: 'error',
  failure: 'error',
  fail: 'error',
  missing: 'error',
  bug: 'error',
};

/**
 * How a kind written in a file looks: Obsidian's kinds shown as the nearest
 * of Confluence's five, and any other as a note. The kind itself is kept as
 * written.
 */
export function calloutLook(kind: string): CalloutLook {
  return LOOKS[kind.toLowerCase()] ?? 'note';
}
