// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

// Its own file, so the module's shared context is created here, from the fake
// below, rather than cached by another test before the fake exists.
describe('canvasLineWidth', () => {
  it('measures each font as its own, though interleaved', async () => {
    // A context whose widths depend on the font it currently has, as a real
    // one's do: a measurer that forgot to set its font reads the last one set.
    // Spied inside the test, since mocks are restored after each one.
    const context = {
      font: '',
      measureText(line: string) {
        return { width: line.length * parseFloat(this.font) };
      },
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as never);
    const { canvasLineWidth } = await import('./text-measure');

    const small = canvasLineWidth('10px Geist');
    const large = canvasLineWidth('40px Geist');
    expect(small('abc')).toBe(30);
    expect(large('abc')).toBe(120);
    expect(small('abc')).toBe(30);
  });
});
