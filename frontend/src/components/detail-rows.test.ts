import { describe, expect, it } from 'vitest';
import { detailRows } from './detail-rows';

describe('an error\'s details as rows', () => {
  it('splits each line at its first colon into a label and a value', () => {
    expect(detailRows('Error id: e-7f3a91\nPrevious log file: 2026-09-27 10:14:02.log')).toEqual([
      { label: 'Error id', value: 'e-7f3a91' },
      { label: 'Previous log file', value: '2026-09-27 10:14:02.log' },
    ]);
  });

  it('keeps a line with no label as a value on its own, and drops empty lines', () => {
    expect(detailRows('The window stopped responding.\n\n')).toEqual([{ label: '', value: 'The window stopped responding.' }]);
  });
});
