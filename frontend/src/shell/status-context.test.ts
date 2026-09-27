import { describe, expect, it } from 'vitest';
import { countText, statusContext } from './status-context';

describe('what the status bar describes', () => {
  it('follows the view when only one side shows', () => {
    expect(statusContext('document', 'canvas')).toBe('document');
    expect(statusContext('canvas', 'document')).toBe('canvas');
  });

  it('follows the side last worked in when both show', () => {
    expect(statusContext('both', 'canvas')).toBe('canvas');
    expect(statusContext('both', 'document')).toBe('document');
  });
});

describe('counting a document', () => {
  it('counts words and characters', () => {
    expect(countText('How we take Bava 1.0 to users.')).toEqual({ words: 7, characters: 30 });
  });

  it('counts nothing in an empty or blank document', () => {
    expect(countText('')).toEqual({ words: 0, characters: 0 });
    expect(countText('  \n ')).toEqual({ words: 0, characters: 4 });
  });

  it('does not count punctuation or Markdown marks as words', () => {
    expect(countText('# Launch plan\n\n- goals - dates').words).toBe(4);
  });
});
