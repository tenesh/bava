import { describe, expect, it } from 'vitest';
import { statusLocation } from './status-location';

describe('statusLocation', () => {
  it('names the Space and the open page as two items', () => {
    expect(statusLocation({ spaceRoot: '/w/Acme', spaceName: 'Acme', pagePath: 'Marketing/Launch plan.md', filePath: '/w/Acme/Marketing/Launch plan.md' })).toEqual({
      space: 'Acme',
      path: 'Marketing/Launch plan.md',
    });
  });

  it('names only the Space when no page is open', () => {
    expect(statusLocation({ spaceRoot: '/w/Acme', spaceName: 'Acme', pagePath: null, filePath: null })).toEqual({ space: 'Acme', path: undefined });
  });

  it('gives a loose file its full path and no Space', () => {
    expect(statusLocation({ spaceRoot: null, spaceName: '', pagePath: null, filePath: '/tmp/notes.md' })).toEqual({ space: undefined, path: '/tmp/notes.md' });
  });

  it('is empty with nothing open', () => {
    expect(statusLocation({ spaceRoot: null, spaceName: '', pagePath: null, filePath: null })).toEqual({ space: undefined, path: undefined });
  });
});
