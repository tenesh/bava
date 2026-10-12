import { describe, expect, it } from 'vitest';
import { d2DiagramStatus } from './d2-diagram-status';

describe('d2DiagramStatus', () => {
  it('names the engine and counts the shapes', () => {
    expect(d2DiagramStatus('tala', 3)).toBe('Laid out by TALA · 3 shapes');
    expect(d2DiagramStatus('elk', 12)).toBe('Laid out by ELK · 12 shapes');
  });

  it('says one shape, not one shapes', () => {
    expect(d2DiagramStatus('dagre', 1)).toBe('Laid out by Dagre · 1 shape');
  });

  // Nothing laid out yet: a count of nothing says nothing useful.
  it('is empty while there are no shapes', () => {
    expect(d2DiagramStatus('tala', 0)).toBe('');
  });
});
