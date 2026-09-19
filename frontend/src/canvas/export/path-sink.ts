/**
 * An SVG path built through the same sink the canvas draws into.
 *
 * `shapes.ts` and `arrows.ts` describe every outline and arrowhead as calls to
 * a `PathSink`. Konva's context is one sink; this is the other. Nothing here
 * knows what a diamond looks like, which is the point: the export and the
 * canvas read the same drawing code (`.ai/rules/canvas.md`).
 */
import type { PathSink } from '../shapes';

/** Three decimals is below a device pixel at 3x, and keeps the file readable. */
function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export type SvgPathSink = PathSink & {
  /** The path data drawn so far, for a `d` attribute. */
  d(): string;
};

export function svgPathSink(): SvgPathSink {
  const parts: string[] = [];
  const pairs = (args: number[]): string => {
    const out: string[] = [];
    for (let i = 0; i + 1 < args.length; i += 2) out.push(`${round(args[i])} ${round(args[i + 1])}`);
    return out.join(' ');
  };
  return {
    moveTo: (...args: number[]) => void parts.push(`M${pairs(args)}`),
    lineTo: (...args: number[]) => void parts.push(`L${pairs(args)}`),
    bezierCurveTo: (...args: number[]) => void parts.push(`C${pairs(args)}`),
    closePath: () => void parts.push('Z'),
    d: () => parts.join(' '),
  };
}
