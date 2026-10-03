import { describe, expect, it } from 'vitest';
import { fitCrumbs } from './crumbs';

describe('fitCrumbs', () => {
  const base = { folders: [80, 90], name: 120, chrome: 30, folderMin: 50 };

  it('shows every crumb whole when they all fit', () => {
    expect(fitCrumbs({ ...base, available: 320 })).toBe('whole');
  });

  it('shortens the folders while the name still fits beside their shortest', () => {
    expect(fitCrumbs({ ...base, available: 319 })).toBe('shorten');
    expect(fitCrumbs({ ...base, available: 250 })).toBe('shorten');
  });

  it('counts a folder shorter than the minimum at its own width', () => {
    expect(fitCrumbs({ ...base, folders: [20, 90], available: 220 })).toBe('shorten');
  });

  it('folds the folders into one when even their shortest leaves the name no room', () => {
    expect(fitCrumbs({ ...base, available: 249 })).toBe('fold');
  });

  it('never folds a page in no folder', () => {
    expect(fitCrumbs({ ...base, folders: [], available: 10 })).toBe('whole');
  });
});
