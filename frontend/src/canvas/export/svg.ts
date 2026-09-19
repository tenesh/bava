/**
 * The canvas as an SVG document.
 *
 * Every outline, route and arrowhead comes from the same code the stage draws
 * with (`shapes.ts`, `arrows.ts`) through an SVG sink, and every colour, width
 * and dash from `paint.ts`. This file decides how to write SVG, never how
 * something looks: that would be a second drawing implementation, and it would
 * drift from the canvas the first time a shape changed.
 */
import { drawHead, headAt, routePoints } from '../arrows';
import { paintFor, type Paint } from '../paint';
import { angleOfElement, centreOf } from '../rotate';
import { isShapeType, type SceneElement } from '../scene';
import { drawOutline, isOutlineShape } from '../shapes';
import type { ReadVariable } from '../palette';
import type { ExportArea } from './area';
import { svgPathSink } from './path-sink';
import { wrapLines } from '../text-layout';
import { canvasLineWidth } from '../text-measure';
import { smoothPoints } from '../curves';

export type SvgOptions = {
  /** Reads the theme variables the export resolves against. */
  read: ReadVariable;
  /** Paint the canvas colour behind the drawing. */
  background?: boolean;
  /** A `<style>` body, for the embedded font (Task 3). */
  css?: string;
};

const round = (value: number): number => Math.round(value * 1000) / 1000;

/** Text and attribute values are escaped: a label can hold anything. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** The presentation attributes shared by every drawn element. */
function paintAttributes(paint: Paint, { fill = paint.fill }: { fill?: string } = {}): string {
  const parts = [`fill="${fill || 'none'}"`];
  if (paint.stroke) {
    parts.push(`stroke="${paint.stroke}"`, `stroke-width="${round(paint.strokeWidth)}"`);
    if (paint.dash.length > 0) parts.push(`stroke-dasharray="${paint.dash.map(round).join(' ')}"`);
  }
  return parts.join(' ');
}

const ANCHOR = { left: 'start', center: 'middle', right: 'end' } as const;

/** Where a run of text sits inside a box, following the same rules as Konva. */
function textPosition(element: SceneElement, paint: Paint, lines: number): { x: number; y: number } {
  const anchor = paint.font.align;
  const x = element.x + (anchor === 'left' ? 0 : anchor === 'center' ? element.w / 2 : element.w);
  const height = paint.font.size * paint.font.lineHeight * lines;
  const top =
    paint.font.verticalAlign === 'top'
      ? element.y
      : paint.font.verticalAlign === 'bottom'
        ? element.y + element.h - height
        : element.y + (element.h - height) / 2;
  // SVG places text on its baseline; Konva places a line by its top.
  return { x, y: top + paint.font.size };
}

function textElement(element: SceneElement, paint: Paint, value: string, inset: number): string {
  // The same breaker the stage hands Konva, so a label that wraps on the
  // canvas wraps identically here.
  const box = {
    ...element,
    x: element.x + inset,
    y: element.y + inset,
    w: Math.max(0, element.w - inset * 2),
    h: Math.max(0, element.h - inset * 2),
  };
  const lines = wrapLines(value, box.w, canvasLineWidth(`${paint.font.size}px ${paint.font.family}`));
  const at = textPosition(box, paint, lines.length);
  const step = round(paint.font.size * paint.font.lineHeight);
  const spans = lines
    .map((line, i) => `<tspan x="${round(at.x)}" dy="${i === 0 ? 0 : step}">${escapeXml(line)}</tspan>`)
    .join('');
  return (
    `<text x="${round(at.x)}" y="${round(at.y)}" fill="${paint.font.colour}"` +
    ` font-family="${escapeXml(paint.font.family)}" font-size="${round(paint.font.size)}"` +
    ` text-anchor="${ANCHOR[paint.font.align]}">${spans}</text>`
  );
}

/** The body of an element: the shape itself, without its label. */
function body(element: SceneElement, paint: Paint, headSize: number): string {
  const attrs = paintAttributes(paint);
  const points = 'points' in element ? (element.points as number[]) : [];

  if (element.type === 'ellipse') {
    return (
      `<ellipse cx="${round(element.x + element.w / 2)}" cy="${round(element.y + element.h / 2)}"` +
      ` rx="${round(element.w / 2)}" ry="${round(element.h / 2)}" ${attrs}/>`
    );
  }
  if (isOutlineShape(element.type)) {
    const sink = svgPathSink();
    drawOutline(element.type, sink, element.w, element.h, paint.cornerRadius);
    return `<g transform="translate(${round(element.x)} ${round(element.y)})"><path d="${sink.d()}" ${attrs}/></g>`;
  }
  if (element.type === 'line' || element.type === 'stroke' || element.type === 'arrow') {
    const straight = element.type === 'arrow' ? routePoints(points, (element as { arrowType?: string }).arrowType) : points;
    // Round edges on a line are a smoothing, and the stage draws the same
    // samples: leaving them out here drew corners where the canvas curves.
    const routed = smoothPoints(straight, paint.tension);
    const pairs: string[] = [];
    for (let i = 0; i + 1 < routed.length; i += 2) {
      pairs.push(`${round(element.x + routed[i])} ${round(element.y + routed[i + 1])}`);
    }
    const line = `<polyline points="${pairs.join(' ')}" ${paintAttributes(paint, { fill: '' })} stroke-linecap="round" stroke-linejoin="round"/>`;
    return element.type === 'arrow' ? line + heads(element, paint, straight, headSize) : line;
  }
  if (element.type === 'text') return '';

  // Rectangles, frames and anything else drawn as a box.
  const radius = paint.cornerRadius > 0 ? ` rx="${round(paint.cornerRadius)}"` : '';
  return (
    `<rect x="${round(element.x)}" y="${round(element.y)}" width="${round(element.w)}" height="${round(element.h)}"` +
    `${radius} ${paintAttributes(paint)}/>`
  );
}

/** An arrow's heads, drawn and turned exactly as the stage draws them. */
function heads(element: SceneElement, paint: Paint, routed: number[], size: number): string {
  const props = element as SceneElement & { startArrowhead?: string; endArrowhead?: string };
  return (['start', 'end'] as const)
    .map((end) => {
      const kind = end === 'start' ? (props.startArrowhead ?? 'none') : (props.endArrowhead ?? 'arrow');
      if (kind === 'none') return '';
      const at = headAt(routed, end);
      const sink = svgPathSink();
      const filled = drawHead(sink, kind, size);
      const fill = filled ? paint.stroke : '';
      return (
        `<g data-head="${end}" transform="translate(${round(element.x + at.x)} ${round(element.y + at.y)})` +
        ` rotate(${round(at.angle)})"><path d="${sink.d()}" ${paintAttributes(paint, { fill })}/></g>`
      );
    })
    .join('');
}

/** One element: its body, its label, its opacity and its rotation. */
function draw(element: SceneElement, options: SvgOptions, labelInset: number): string {
  const paint = paintFor(element, options.read);
  const label = 'label' in element ? (element.label as string | undefined) : undefined;
  const inner =
    body(element, paint, parseFloat(options.read('--size-arrowhead')) || 0) +
    (element.type === 'text'
      ? textElement(element, paint, (element as { text: string }).text, 0)
      : label && (isShapeType(element.type) || element.type === 'frame')
        ? textElement(element, paint, label, labelInset)
        : '');
  if (inner === '') return '';

  const angle = angleOfElement(element);
  const centre = centreOf(element);
  const attrs: string[] = [`data-id="${escapeXml(element.id)}"`];
  if (angle !== 0) attrs.push(`transform="rotate(${round(angle)} ${round(centre.x)} ${round(centre.y)})"`);
  if (paint.opacity !== 1) attrs.push(`opacity="${round(paint.opacity)}"`);
  return `<g ${attrs.join(' ')}>${inner}</g>`;
}

/**
 * The area as a standalone SVG document. Nothing is fetched when it is opened:
 * the colours are resolved values and the font, when there is text, travels
 * inside it.
 */
export function toSvg(area: ExportArea, options: SvgOptions): string {
  const { box } = area;
  const inset = parseFloat(options.read('--size-label-inset')) || 0;
  const background = options.background
    ? `<rect data-background="true" x="${round(box.x)}" y="${round(box.y)}" width="${round(box.w)}"` +
      ` height="${round(box.h)}" fill="${options.read('--color-canvas-bg').trim()}"/>`
    : '';
  const style = options.css ? `<style>${options.css}</style>` : '';
  const drawn = area.elements.map((element) => draw(element, options, inset)).join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${round(box.w)}" height="${round(box.h)}"` +
    ` viewBox="${round(box.x)} ${round(box.y)} ${round(box.w)} ${round(box.h)}">` +
    `${style}${background}${drawn}</svg>`
  );
}
