import { describe, expect, it } from 'vitest';
import { D2_ARROWHEADS, arrowheadFor } from './convert';
import { PROPERTY_OPTIONS } from '../property-options';

// Read from D2 v0.9.0's own constants (d2target/d2target.go): a name that
// does not match is not an error anywhere, it just silently becomes the
// default head, which is how `cf_one` sat here doing nothing.
const V0_9_0 = [
  'none',
  'arrow',
  'unfilled-triangle',
  'triangle',
  'diamond',
  'filled-diamond',
  'circle',
  'filled-circle',
  'cross',
  'box',
  'filled-box',
  'line',
  'cf-one',
  'cf-many',
  'cf-one-required',
  'cf-many-required',
];

describe('D2 arrowheads', () => {
  it('names every one the pinned D2 can produce', () => {
    expect(Object.keys(D2_ARROWHEADS).sort()).toEqual([...V0_9_0].sort());
  });

  it('only ever maps to a head Bava draws', () => {
    const drawable = new Set(PROPERTY_OPTIONS.endArrowhead.options.map((option) => String(option.value)));
    for (const name of V0_9_0) expect(drawable.has(arrowheadFor(name, 'arrow'))).toBe(true);
  });

  // Filled and unfilled are different drawings, and D2 distinguishes them.
  it('keeps whether a head is filled', () => {
    expect(arrowheadFor('diamond', 'arrow')).toBe('diamond-outline');
    expect(arrowheadFor('filled-diamond', 'arrow')).toBe('diamond');
    expect(arrowheadFor('circle', 'arrow')).toBe('circle-outline');
    expect(arrowheadFor('filled-circle', 'arrow')).toBe('circle');
    expect(arrowheadFor('unfilled-triangle', 'arrow')).toBe('triangle-outline');
    expect(arrowheadFor('triangle', 'arrow')).toBe('triangle');
  });

  it('falls back for a name a later D2 might add', () => {
    expect(arrowheadFor('something-new', 'arrow')).toBe('arrow');
    expect(arrowheadFor(undefined, 'none')).toBe('none');
  });
});
