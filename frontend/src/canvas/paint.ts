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
import { CODE_FONT_SIZE, PROPERTY_DEFAULTS } from './style-defaults';

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

/** What an absent `strokeWidth` and `fontSize` mean (`docs/file-format.md`). */
export const DEFAULT_STROKE_WIDTH = PROPERTY_DEFAULTS.strokeWidth as number;
export const DEFAULT_FONT_SIZE = PROPERTY_DEFAULTS.fontSize as number;

type StyleProps = {
  strokeWidth?: number;
  strokeStyle?: string;
  edges?: string;
  opacity?: number;
  fontSize?: number;
  align?: TextPaint['align'];
  verticalAlign?: TextPaint['verticalAlign'];
};

/**
 * The dash pattern for a line style at a stroke width, in scene units:
 * Excalidraw's dashed [8, 8 + width] and dotted [1.5, 6 + width]
 * (`element/src/shape.ts:200-216`).
 */
export function dashFor(style: string | undefined, width: number): number[] {
  if (style === 'dashed') return [8, 8 + width];
  if (style === 'dotted') return [1.5, 6 + width];
  return [];
}

/** How an element paints against the theme `read` describes. */
export function paintFor(element: SceneElement, read: ReadVariable): Paint {
  const style = resolveStyle(element as { fill?: string; stroke?: string; color?: string }, read);
  const props = element as SceneElement & StyleProps;
  // Absent means the file format's default, pen strokes included: a file
  // means the same whatever the theme, and picking the default clears the key.
  const strokeWidth = props.strokeWidth ?? DEFAULT_STROKE_WIDTH;

  const paint: Paint = {
    fill: isShapeType(element.type) ? style.fill : '',
    stroke: element.type === 'text' ? '' : style.stroke,
    // A dashed or dotted line is drawn half a unit thicker, so its dashes
    // read as heavy as a solid line (Excalidraw's `shape.ts:168-170`).
    strokeWidth: props.strokeStyle === 'dashed' || props.strokeStyle === 'dotted' ? strokeWidth + 0.5 : strokeWidth,
    dash: dashFor(props.strokeStyle, strokeWidth),
    opacity: props.opacity === undefined ? 1 : Math.min(100, Math.max(0, props.opacity)) / 100,
    cornerRadius: 0,
    tension: 0,
    font: {
      family: read('--font-ui').trim(),
      size: props.fontSize ?? DEFAULT_FONT_SIZE,
      lineHeight: number(read, '--leading-tight'),
      align: props.align ?? defaultAlign(element.type),
      // Free text starts at the top of its box, as Konva draws it; a shape's
      // label is centred in the shape, and a frame's sits at its corner.
      verticalAlign: props.verticalAlign ?? defaultVerticalAlign(element.type),
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
      // Absent means the file format's 13, not whatever a token says.
      size: props.fontSize ?? CODE_FONT_SIZE,
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
    case 'line':
      // Filled only while closed, and only with a fill of its own.
      paint.fill = (element as { closed?: boolean }).closed === true && (element as { fill?: string }).fill !== undefined ? style.fill : '';
      break;
    case 'arrow':
      // The heads are filled in the line's colour, and the label is written
      // in it, as Excalidraw's.
      paint.fill = style.stroke;
      paint.font.colour = style.stroke;
      break;
    default:
      break;
  }
  return paint;
}

/** Where text sits across its box when the file says nothing: left in free text and a frame's label, centred elsewhere. */
export function defaultAlign(type: string): TextPaint['align'] {
  return type === 'text' || type === 'frame' ? 'left' : 'center';
}

/** Where text sits down its box when the file says nothing: at the top of free text and a frame, in the middle elsewhere. */
export function defaultVerticalAlign(type: string): TextPaint['verticalAlign'] {
  return type === 'text' || type === 'frame' ? 'top' : 'middle';
}
