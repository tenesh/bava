import { describe, expect, it } from 'vitest';
import { slugger } from './slug';

describe("GitHub's heading anchors", () => {
  it('lower-cases, turns spaces into hyphens and drops punctuation', () => {
    const slug = slugger();
    expect(slug('Launch Plan')).toBe('launch-plan');
    expect(slug('Risks & costs!')).toBe('risks--costs');
    expect(slug('snake_case and kebab-case')).toBe('snake_case-and-kebab-case');
  });

  it('keeps letters of every script', () => {
    const slug = slugger();
    expect(slug('Café Überblick')).toBe('café-überblick');
    expect(slug('日本語 見出し')).toBe('日本語-見出し');
  });

  it('numbers a repeated heading', () => {
    const slug = slugger();
    expect([slug('Beta'), slug('Beta'), slug('Beta')]).toEqual(['beta', 'beta-1', 'beta-2']);
  });
});
