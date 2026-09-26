import { describe, expect, it } from 'vitest';
import { createCurrentStyle } from './current-style';

// 06.15 C13, C14: a new element takes the style last chosen, as Excalidraw's
// `currentItem*`, starting with arrows curved and lines round.
describe('the style a new element takes', () => {
  it('starts with arrows curved and lines round, and nothing for a shape', () => {
    const style = createCurrentStyle();
    expect(style.for('arrow')).toEqual({ arrowType: 'arc' });
    expect(style.for('line')).toEqual({ edges: 'round' });
    expect(style.for('rect')).toEqual({});
  });

  it('carries what was chosen to every kind that takes it', () => {
    const style = createCurrentStyle();
    style.remember('stroke', 'red');
    style.remember('strokeWidth', 4);
    style.remember('endArrowhead', 'triangle');
    expect(style.for('rect')).toEqual({ stroke: 'red', strokeWidth: 4 });
    expect(style.for('arrow')).toEqual({ arrowType: 'arc', stroke: 'red', strokeWidth: 4, endArrowhead: 'triangle' });
  });

  it('writes nothing for a value chosen back to the default', () => {
    const style = createCurrentStyle();
    style.remember('arrowType', 'straight');
    style.remember('edges', 'sharp');
    expect(style.for('arrow')).toEqual({});
    expect(style.for('line')).toEqual({});
  });

  it('forgets a colour cleared back to the theme default', () => {
    const style = createCurrentStyle();
    style.remember('fill', 'blue');
    style.remember('fill', null);
    expect(style.for('rect')).toEqual({});
  });
});

describe('a remembered size across text and code (review of 06.17)', () => {
  it('is carried by its step, never out of range', () => {
    const style = createCurrentStyle();
    style.remember('fontSize', 11, 'code');
    expect(style.for('text')).toEqual({ fontSize: 16 });
    style.remember('fontSize', 36, 'text');
    expect(style.for('code')).toEqual({ fontSize: 20 });
  });
});

describe('a remembered size valid in both scales (review of 06.17)', () => {
  it('is read in the scale it was chosen in', () => {
    const style = createCurrentStyle();
    style.remember('fontSize', 20, 'code');
    expect(style.for('code')).toEqual({ fontSize: 20 });
    expect(style.for('text')).toEqual({ fontSize: 36 });
  });
});
