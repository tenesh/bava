import { describe, expect, it } from 'vitest';
import { latestReads } from './reads';

describe('reads of the Space, answered out of order', () => {
  it('keeps only the answer to the latest read', () => {
    const reads = latestReads();
    const first = reads.start(true);
    const second = reads.start(true);
    expect([first.pagesCurrent(), first.backlinksCurrent()]).toEqual([false, false]);
    expect([second.pagesCurrent(), second.backlinksCurrent()]).toEqual([true, true]);
  });

  it('never lets a read of the pages alone overtake "Linked from"', () => {
    const reads = latestReads();
    const full = reads.start(true);
    const pages = reads.start(false);
    expect([full.pagesCurrent(), full.backlinksCurrent()]).toEqual([false, true]);
    expect([pages.pagesCurrent(), pages.backlinksCurrent()]).toEqual([true, false]);
  });
});
