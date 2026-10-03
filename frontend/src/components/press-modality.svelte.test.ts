import { describe, expect, it } from 'vitest';
import { createPressModality } from './press-modality.svelte';

describe('createPressModality', () => {
  it('counts focus as the keyboard\'s until a pointer presses', () => {
    expect(createPressModality().byPointer).toBe(false);
  });

  it('counts a pointer press as the pointer\'s, and a key after it as the keyboard\'s', () => {
    const modality = createPressModality();
    modality.onpointerdown();
    expect(modality.byPointer).toBe(true);
    modality.onkeydown();
    expect(modality.byPointer).toBe(false);
  });
});
