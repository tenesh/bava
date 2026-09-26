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
