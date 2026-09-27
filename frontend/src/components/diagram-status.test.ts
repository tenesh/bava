import { describe, expect, it } from 'vitest';
import { diagramStatus } from './diagram-status';

describe('diagramStatus', () => {
  it('names the engine and counts the shapes', () => {
    expect(diagramStatus('tala', 3)).toBe('Laid out by TALA · 3 shapes');
    expect(diagramStatus('elk', 12)).toBe('Laid out by ELK · 12 shapes');
  });

  it('says one shape, not one shapes', () => {
    expect(diagramStatus('dagre', 1)).toBe('Laid out by Dagre · 1 shape');
  });

  // Nothing laid out yet: a count of nothing says nothing useful.
  it('is empty while there are no shapes', () => {
    expect(diagramStatus('tala', 0)).toBe('');
  });
});
