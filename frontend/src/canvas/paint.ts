/**
 * How an element paints: colours, widths, dashes, rounding and text, resolved
 * from the element and the theme's variables.
 *
 * One description, two renderers. The stage turns it into Konva properties and
 * the exporter turns it into SVG attributes, so an exported file cannot
 * disagree with the canvas about how something looks. A second set of paint
 * rules anywhere is a bug (`.ai/rules/canvas.md`).
 */
import { resolveStyle, type ReadVariable } from './palette';
import { isOutlineShape } from './shapes';
import { isShapeType, type SceneElement } from './scene';

/** Excalidraw's proportional radius: a quarter of the shorter side. */
export const ROUND_SHARE = 0.25;

/**
 * How much a rounded line is smoothed. A polyline has no corners to cut, so
 * Round bends it through its points instead, which Konva calls tension. The
 * value is the shape of a curve, not a length, so it is a constant rather than
 * a token (`.ai/rules/canvas.md`).
 */
export const LINE_TENSION = 0.4;

export type TextPaint = {
  family: string;
  size: number;
  lineHeight: number;
  align: 'left' | 'center' | 'right';
  verticalAlign: 'top' | 'middle' | 'bottom';
  colour: string;
};

export type Paint = {
  /** The fill, or '' for none. */
  fill: string;
  /** The stroke, or '' for none. */
  stroke: string;
  strokeWidth: number;
  /** Dash pattern in scene units; empty for a solid line. */
  dash: number[];
  /** 0 to 1, for the whole element and its label. */
  opacity: number;
  /** Corner radius: the token on a rectangle, a share of the shorter side on a polygon. */
  cornerRadius: number;
  /** Whether a polyline is smoothed rather than cornered. */
  tension: number;
  font: TextPaint;
};

const number = (read: ReadVariable, name: string) => parseFloat(read(name)) || 0;

type StyleProps = {
  strokeWidth?: number;
  strokeStyle?: string;
  edges?: string;
  opacity?: number;
  fontSize?: number;
  align?: TextPaint['align'];
  verticalAlign?: TextPaint['verticalAlign'];
};

/** The dash pattern for a line style, in scene units. */
export function dashFor(style: string | undefined, read: ReadVariable): number[] {
  if (style === 'dashed') {
    const dash = number(read, '--size-dash');
    return [dash, dash];
  }
  if (style === 'dotted') {
    const dot = number(read, '--size-dot');
    return [dot, dot * 2];
  }
  return [];
}

/** How an element paints against the theme `read` describes. */
export function paintFor(element: SceneElement, read: ReadVariable): Paint {
  const style = resolveStyle(element as { fill?: string; stroke?: string; color?: string }, read);
  const props = element as SceneElement & StyleProps;
  const isFrame = element.type === 'frame';
  const strokeWidth =
    props.strokeWidth ??
    (element.type === 'stroke' ? number(read, '--size-pen-stroke') : number(read, '--size-shape-stroke'));

  const paint: Paint = {
    fill: isShapeType(element.type) ? style.fill : '',
    stroke: element.type === 'text' ? '' : style.stroke,
    strokeWidth,
    dash: dashFor(props.strokeStyle, read),
    opacity: props.opacity === undefined ? 1 : Math.min(100, Math.max(0, props.opacity)) / 100,
    cornerRadius: 0,
    tension: 0,
    font: {
      family: read('--font-ui').trim(),
      size: props.fontSize ?? number(read, '--text-body'),
      lineHeight: number(read, '--leading-tight'),
      align: props.align ?? (element.type === 'text' || isFrame ? 'left' : 'center'),
      // Free text starts at the top of its box, as Konva draws it; a shape's
      // label is centred in the shape, and a frame's sits at its corner.
      verticalAlign: props.verticalAlign ?? (isFrame || element.type === 'text' ? 'top' : 'middle'),
      colour: style.text,
    },
  };

  if (element.type === 'code') {
    // A code block is a panel: the theme's code surface, a subtle border, and
    // its text in the mono face at the code size.
    paint.fill = read('--color-code-surface').trim();
    paint.stroke = read('--color-border-subtle').trim();
    paint.cornerRadius = number(read, '--radius-md');
    paint.font = {
      ...paint.font,
      family: read('--font-mono').trim(),
      size: props.fontSize ?? number(read, '--text-code'),
      lineHeight: number(read, '--leading-code'),
      align: 'left',
      verticalAlign: 'top',
      colour: read('--syntax-plain').trim(),
    };
  }

  if (props.edges === 'round') {
    if (isOutlineShape(element.type)) paint.cornerRadius = Math.min(element.w, element.h) * ROUND_SHARE;
    else if (element.type === 'line') paint.tension = LINE_TENSION;
    else paint.cornerRadius = number(read, '--radius-shape-round');
  }

  switch (element.type) {
    case 'group':
      // A group draws nothing of its own; its children are the drawing.
      paint.fill = '';
      paint.stroke = '';
      break;
    case 'text':
      paint.fill = '';
      break;
    case 'arrow':
      // The heads are filled in the line's colour.
      paint.fill = style.stroke;
      break;
    default:
      break;
  }
  return paint;
}
