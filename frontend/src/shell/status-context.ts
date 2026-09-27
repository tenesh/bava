/**
 * What the status bar describes: the canvas (its engine and nodes) or the
 * document (its words and characters). With one side showing, that side;
 * with both, the side last worked in.
 */
import type { ViewMode } from './view.svelte';

export type StatusSide = 'document' | 'canvas';

export function statusContext(mode: ViewMode, lastWorkedIn: StatusSide): StatusSide {
  if (mode === 'document') return 'document';
  if (mode === 'canvas') return 'canvas';
  return lastWorkedIn;
}

// A word holds at least one letter or digit; marks and punctuation alone do not count.
const WORD = /[\p{L}\p{N}]/u;

/** A document's words and characters, as a writer counts them. */
export function countText(text: string): { words: number; characters: number } {
  const words = text.split(/\s+/).filter((part) => WORD.test(part)).length;
  return { words, characters: [...text].length };
}
