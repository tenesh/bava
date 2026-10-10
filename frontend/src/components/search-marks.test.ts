import { describe, expect, it } from 'vitest';
import { markWords } from './search-marks';

describe('markWords', () => {
  it('marks each typed word where it starts a word, capitals ignored', () => {
    expect(markWords('The Launch date launches', 'launch date')).toEqual([
      { text: 'The ', marked: false },
      { text: 'Launch', marked: true },
      { text: ' ', marked: false },
      { text: 'date', marked: true },
      { text: ' ', marked: false },
      { text: 'launch', marked: true },
      { text: 'es', marked: false },
    ]);
  });

  it('leaves a word inside another unmarked', () => {
    expect(markWords('relaunch', 'launch')).toEqual([{ text: 'relaunch', marked: false }]);
  });

  it('gives the text whole when nothing is typed', () => {
    expect(markWords('plain', '  ')).toEqual([{ text: 'plain', marked: false }]);
  });
});
