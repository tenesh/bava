/**
 * The canvas as an SVG document.
 *
 * Every outline, route and arrowhead comes from the same code the stage draws
 * with (`shapes.ts`, `arrows.ts`) through an SVG sink, and every colour, width
 * and dash from `paint.ts`. This file decides how to write SVG, never how
 * something looks: that would be a second drawing implementation, and it would
 * drift from the canvas the first time a shape changed.
 */
import { languageTag } from '../code/language-tag';
import { LABEL_CLEARANCE, drawHead, endSegment, headAt, headDash, labelCorners, labelLayout, type LabelLayout, pathOf, routePoints } from '../arrows';
import { paintFor, type Paint } from '../paint';
import { angleOfElement, centreOf } from '../rotate';
import { isShapeType, type SceneElement } from '../scene';
import { drawOutline, isOutlineShape } from '../shapes';
import type { ReadVariable } from '../palette';
import type { ExportArea } from './area';
import { svgPathSink } from './path-sink';
import { monoAdvance } from '../code/advance';
import { columnsIn } from '../code/measure';
import { columnsFor, wrapRuns } from '../code/wrap';
import type { Run } from '../code/highlight';
import { wrapLines } from '../text-layout';
import { placeLabel } from '../label-box';
import { canvasLineWidth } from '../text-measure';
import { smoothPoints } from '../curves';
import { BASELINE_SHARE, PICTURE_ICON, PLACEHOLDER_LOOK, placeholderLayout } from '../picture-placeholder';
import { TABLE_PAD, TABLE_ROW, tableLayout, type Cell } from '../table-layout';

export type SvgOptions = {
  /** Reads the theme variables the export resolves against. */
  read: ReadVariable;
  /** Paint the canvas colour behind the drawing. */
  background?: boolean;
  /** A `<style>` body, for the embedded font. */
  css?: string;
  /**
   * Tokenised code per block, by element id. Highlighting is asynchronous (a
   * language loads on first use) and this writer is not, so the runs arrive
   * with the request, exactly as they do at the stage.
   */
  codeRuns?: Record<string, Run[][]>;
  /**
   * The mono advance the canvas measured. Passed rather than measured here, so
   * an export lays code out on exactly the columns the canvas drew it on; a
   * measurement taken in a different environment drifts and the runs overlap.
   */
  monoAdvance?: number;
  /**
   * Elements carried inside the picture, as the file stores them: the
   * clipboard's copy, so Bava pastes them back as shapes (`clipboard-read.ts`).
   */
  carry?: SceneElement[];
  /**
   * Where each picture element's picture is drawn from, by attachment name: a
   * data address for a file that travels, the app's own address on screen;
   * null or absent, it cannot be shown and its placeholder is drawn.
   */
  pictures?: Record<string, string | null>;
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

/** A shape's or frame's label, placed as the stage places it (`placeLabel`). */
function shapeLabel(element: SceneElement, paint: Paint, label: string, inset: number): string {
  const measure = canvasLineWidth(`${paint.font.size}px ${paint.font.family}`);
  const placed = placeLabel(element.type, element.w, element.h, label, inset, paint.font, measure);
  const box = { ...element, x: element.x + placed.x, y: element.y + placed.y, w: placed.w, h: placed.h };
  const font = { ...paint.font, verticalAlign: placed.verticalAlign };
  const at = textPosition(box, { ...paint, font }, placed.lines.length);
  const step = round(paint.font.size * paint.font.lineHeight);
  const spans = placed.lines
    .map((line, i) => `<tspan x="${round(at.x)}" dy="${i === 0 ? 0 : step}">${escapeXml(line)}</tspan>`)
    .join('');
  return (
    `<text x="${round(at.x)}" y="${round(at.y)}" fill="${paint.font.colour}"` +
    ` font-family="${escapeXml(paint.font.family)}" font-size="${round(paint.font.size)}"` +
    ` text-anchor="${ANCHOR[paint.font.align]}">${spans}</text>`
  );
}

/** The body of an element: the shape itself, without its label. */
function body(element: SceneElement, paint: Paint, surface: string): string {
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
    const routed = smoothPoints(element.type === 'arrow' ? pathOf(points, (element as { arrowType?: string }).arrowType) : straight, paint.tension);
    const pairs: string[] = [];
    for (let i = 0; i + 1 < routed.length; i += 2) {
      pairs.push(`${round(element.x + routed[i])} ${round(element.y + routed[i + 1])}`);
    }
    // A closed line's fill; an arrow's paint fill is its heads'.
    const fill = element.type === 'line' ? paint.fill : '';
    const label = element.type === 'arrow' && 'label' in element ? (element.label as string | undefined) : undefined;
    const mask = label ? labelMask(element, paint, label) : '';
    const masked = label ? ` mask="url(#label-${element.id})"` : '';
    const line = `${mask}<polyline points="${pairs.join(' ')}" ${paintAttributes(paint, { fill })}${masked} stroke-linecap="round" stroke-linejoin="round"/>`;
    return element.type === 'arrow' ? line + heads(element, paint, straight, surface) : line;
  }
  if (element.type === 'text') return '';

  // Rectangles, frames and anything else drawn as a box.
  const radius = paint.cornerRadius > 0 ? ` rx="${round(paint.cornerRadius)}"` : '';
  return (
    `<rect x="${round(element.x)}" y="${round(element.y)}" width="${round(element.w)}" height="${round(element.h)}"` +
    `${radius} ${paintAttributes(paint)}/>`
  );
}

/**
 * An arrow's label, centred on its place along the path it takes (the middle,
 * or its `labelPosition`), as the stage centres it: measured the same way,
 * positioned the same way.
 */
function arrowLabel(element: SceneElement, paint: Paint, label: string): string {
  const layout = arrowLabelLayout(element, paint, label);
  const box = {
    ...element,
    x: element.x + layout.at.x - layout.width / 2,
    y: element.y + layout.at.y - layout.height / 2,
    w: layout.width,
    h: layout.height,
  } as SceneElement;
  const text = textElement(box, { ...paint, font: { ...paint.font, align: 'center', verticalAlign: 'middle' } }, label, 0);
  // Turned along the arrow about its centre, as the stage turns it.
  return layout.angle === 0
    ? text
    : `<g transform="rotate(${round(layout.angle)} ${round(element.x + layout.at.x)} ${round(element.y + layout.at.y)})">${text}</g>`;
}

/** An arrow's label laid out as the stage lays it out (`labelLayout`), in the arrow's coordinates. */
function arrowLabelLayout(element: SceneElement, paint: Paint, label: string): LabelLayout {
  // The path as the stage draws it, which it centres the label on.
  const points = smoothPoints(pathOf(('points' in element ? element.points : []) as number[], (element as { arrowType?: string }).arrowType), paint.tension);
  const measure = canvasLineWidth(`${paint.font.size}px ${paint.font.family}`);
  return labelLayout(element, points, paint.tension, paint.font, measure, label);
}

/**
 * The mask that hides an arrow's line under its label's box and a margin
 * round it, turned with it, as the stage clips it.
 */
function labelMask(element: SceneElement, paint: Paint, label: string): string {
  const corners = labelCorners(arrowLabelLayout(element, paint, label), LABEL_CLEARANCE);
  const points = corners.map((p) => `${round(element.x + p.x)},${round(element.y + p.y)}`).join(' ');
  return (
    `<mask id="label-${element.id}" maskUnits="userSpaceOnUse">` +
    `<rect x="-1000000" y="-1000000" width="2000000" height="2000000" fill="white"/>` +
    `<polygon points="${points}" fill="black"/></mask>`
  );
}

/** An arrow's heads, drawn and turned exactly as the stage draws them. */
function heads(element: SceneElement, paint: Paint, routed: number[], surface: string): string {
  const props = element as SceneElement & { startArrowhead?: string; endArrowhead?: string; strokeStyle?: string; strokeWidth?: number };
  const width = props.strokeWidth ?? 2;
  return (['start', 'end'] as const)
    .map((end) => {
      const kind = end === 'start' ? (props.startArrowhead ?? 'none') : (props.endArrowhead ?? 'arrow');
      if (kind === 'none') return '';
      const at = headAt(routed, end);
      const sink = svgPathSink();
      // Capped by the arrow's own points, as the stage caps it.
      const own = ('points' in element ? element.points : []) as number[];
      const filled = drawHead(sink, kind, endSegment(own, end), width);
      const fill = filled === 'stroke' ? paint.stroke : filled === 'surface' ? surface : '';
      return (
        `<g data-head="${end}" transform="translate(${round(element.x + at.x)} ${round(element.y + at.y)})` +
        // As the stage draws it: solid, but dotted strokes on a dotted line.
        ` rotate(${round(at.angle)})"><path d="${sink.d()}" ${paintAttributes({ ...paint, dash: headDash(kind, props.strokeStyle, width) }, { fill })}/></g>`
      );
    })
    .join('');
}

/**
 * A code block's coloured runs, as real SVG text.
 *
 * Laid out by character count in the mono advance, the same way the stage
 * places them, so an exported block and the canvas agree column for column.
 */
function codeRuns(element: SceneElement, paint: Paint, options: SvgOptions): string {
  const runs = options.codeRuns?.[element.id] ?? [];
  if (runs.length === 0) return '';
  const padding = parseFloat(options.read('--size-code-padding')) || 0;
  const lineHeight = paint.font.size * paint.font.lineHeight;
  // A given advance is the base code size's; a block at its own size scales it.
  const base = parseFloat(options.read('--text-code')) || paint.font.size;
  const advance = options.monoAdvance !== undefined ? (options.monoAdvance * paint.font.size) / base : monoAdvance(paint.font.size, paint.font.family);

  // Wrapped to the block's width, as the stage wraps it (`code/wrap.ts`).
  return wrapRuns(runs, columnsFor(element.w, { advance, lineHeight, padding }))
    .map((line, row) =>
      line
        .map((run, index) => {
          const column = line.slice(0, index).reduce((total, earlier) => total + columnsIn(earlier.text), 0);
          const x = element.x + padding + column * advance;
          // SVG places text on its baseline; the stage places a line by its top.
          const y = element.y + padding + row * lineHeight + paint.font.size;
          return (
            `<text x="${round(x)}" y="${round(y)}" fill="${options.read(`--syntax-${run.kind}`).trim()}"` +
            ` font-family="${escapeXml(paint.font.family)}" font-size="${round(paint.font.size)}"` +
            ` xml:space="preserve">${escapeXml(run.text)}</text>`
          );
        })
        .join(''),
    )
    .join('');
}

/**
 * A code block's language on its top edge and its border broken for it, as
 * the stage draws them (`code/language-tag.ts`); null for plain text.
 */
function codeLanguage(element: SceneElement, paint: Paint, options: SvgOptions): string | null {
  const size = parseFloat(options.read('--text-code-language')) || 0;
  const family = options.read('--font-mono').trim() || paint.font.family;
  const lineHeight = parseFloat(options.read('--leading-tight')) || 1.2;
  const tag = languageTag(element, canvasLineWidth(`${size}px ${family}`), {
    size,
    lineHeight,
    inset: parseFloat(options.read('--size-code-language-inset')) || 0,
    clearance: parseFloat(options.read('--size-code-language-clearance')) || 0,
  });
  if (!tag) return null;
  const { x, y } = element;
  const radius = paint.cornerRadius > 0 ? ` rx="${round(paint.cornerRadius)}"` : '';
  return (
    `<mask id="language-${element.id}" maskUnits="userSpaceOnUse">` +
    `<rect x="-1000000" y="-1000000" width="2000000" height="2000000" fill="white"/>` +
    `<rect x="${round(x + tag.gap.x)}" y="${round(y + tag.gap.y)}" width="${round(tag.gap.w)}" height="${round(tag.gap.h)}" fill="black"/></mask>` +
    `<rect x="${round(x)}" y="${round(y)}" width="${round(element.w)}" height="${round(element.h)}"${radius}` +
    ` fill="none" stroke="${paint.stroke}" stroke-width="${round(paint.strokeWidth)}" mask="url(#language-${element.id})"/>` +
    // SVG places text on its baseline: the middle of the line box plus a
    // third of the size, as the other labels here.
    `<text x="${round(x + tag.x)}" y="${round(y + tag.y + tag.h / 2 + size / 3)}" fill="${options.read('--color-text-muted').trim()}"` +
    ` font-family="${escapeXml(family)}" font-size="${round(size)}">${escapeXml(tag.text)}</text>`
  );
}

/** A picture, from its address; its placeholder when it has none, as the stage draws it. */
function picture(element: SceneElement & { file: string }, options: SvgOptions): string {
  const { x, y, w, h } = element;
  const href = options.pictures?.[element.file];
  if (href) {
    return (
      `<image data-file="${escapeXml(element.file)}" x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}"` +
      ` preserveAspectRatio="none" href="${escapeXml(href)}"/>`
    );
  }
  const read = (name: string) => options.read(name).trim();
  const sizes = { name: parseFloat(read('--text-body')) || 0, note: parseFloat(read('--text-meta')) || 0 };
  const layout = placeholderLayout(element, element.file, 'missing', sizes);
  const id = `clip-${element.id}`;
  const box =
    `<rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" rx="${PLACEHOLDER_LOOK.radius}"` +
    ` fill="${read('--color-surface-sunken')}" stroke="${read('--color-border-strong')}" stroke-width="${PLACEHOLDER_LOOK.border}"` +
    ` stroke-dasharray="${PLACEHOLDER_LOOK.dash.join(' ')}"/>`;
  const icon = layout.icon
    ? `<path transform="translate(${round(x + layout.icon.x)} ${round(y + layout.icon.y)})" d="${PICTURE_ICON.path}" fill="none"` +
      ` stroke="${read('--color-text-muted')}" stroke-width="${PLACEHOLDER_LOOK.iconStroke}" stroke-linecap="round" stroke-linejoin="round"/>`
    : '';
  const words = layout.lines
    .map(
      (line) =>
        // SVG places text on its baseline, not its top.
        `<text x="${round(x + line.x)}" y="${round(y + line.y + line.size * BASELINE_SHARE)}" text-anchor="middle"` +
        ` font-family="${escapeXml(read('--font-ui'))}" font-size="${round(line.size)}"` +
        ` fill="${read(line.kind === 'name' ? '--color-text-muted' : '--color-text-faint')}">${escapeXml(line.text)}</text>`,
    )
    .join('');
  // The words never spill out of the box, as on the canvas.
  const clip = `<clipPath id="${escapeXml(id)}"><rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}"/></clipPath>`;
  return `${box}${clip}<g clip-path="url(#${escapeXml(id)})">${icon}${words}</g>`;
}

/** A table's or class's name, rules and rows, from the layout the stage draws with. */
function tableInsides(element: SceneElement & { name: string; rows: string }, paint: Paint, options: SvgOptions): string {
  const { x, y, w, h } = element;
  const read = (name: string) => options.read(name).trim();
  const rowSize = parseFloat(read('--text-code')) || paint.font.size;
  // Measured as the canvas measures, so the cells end where they do there.
  const layout = tableLayout(element, canvasLineWidth(`${rowSize}px ${read('--font-mono')}`));
  const mono = escapeXml(read('--font-mono'));
  const chipSize = parseFloat(read('--text-mono-chip')) || rowSize;
  const muted = read('--color-text-muted');
  // SVG places text on its baseline: the middle of its band plus a third of the size, as the other labels here.
  const words = (text: string, at: number, anchor: 'start' | 'middle' | 'end', middle: number, size: number, family: string, fill: string, bold = false) =>
    `<text x="${round(at)}" y="${round(middle + size / 3)}" text-anchor="${anchor}" font-family="${family}" font-size="${round(size)}"` +
    `${bold ? ' font-weight="600"' : ''} fill="${fill}">${escapeXml(text)}</text>`;
  const header = layout.header;
  // The name at the interface's body size, set bold, as the stage draws it.
  const nameSize = parseFloat(read('--text-body')) || paint.font.size;
  let out =
    header.align === 'left'
      ? words(header.text, x + TABLE_PAD, 'start', y + header.height / 2, nameSize, escapeXml(paint.font.family), paint.font.colour, true)
      : words(header.text, x + w / 2, 'middle', y + header.height / 2, nameSize, escapeXml(paint.font.family), paint.font.colour, true);
  const rule = (at: number, width: number) =>
    `<line x1="${round(x)}" y1="${round(y + at)}" x2="${round(x + w)}" y2="${round(y + at)}" stroke="${paint.stroke}" stroke-width="${round(width)}"/>`;
  out += rule(header.height, paint.strokeWidth);
  if (layout.divider !== null) out += rule(layout.divider, PLACEHOLDER_LOOK.border);
  for (const row of layout.rows) {
    const middle = y + row.y + TABLE_ROW / 2;
    const cell = (c: Cell | undefined, fill: string, size = rowSize, bold = false) =>
      c && c.text ? words(c.text, x + c.x, c.align === 'left' ? 'start' : 'end', middle, size, mono, fill, bold) : '';
    out += cell(row.cells.marker, muted) + cell(row.cells.name, paint.font.colour) + cell(row.cells.type, muted) + cell(row.cells.keys, paint.font.colour, chipSize, true);
  }
  // Words wider than the box are cut at its edge, as on the canvas.
  const id = `clip-${element.id}`;
  return (
    `<clipPath id="${escapeXml(id)}"><rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}"/></clipPath>` +
    `<g clip-path="url(#${escapeXml(id)})">${out}</g>`
  );
}

/** One element: its body, its label, its opacity and its rotation. */
function draw(element: SceneElement, options: SvgOptions, labelInset: number): string {
  const paint = paintFor(element, options.read);
  const label = 'label' in element ? (element.label as string | undefined) : undefined;
  const tag = element.type === 'code' ? codeLanguage(element, paint, options) : null;
  const inner = element.type === 'image' ? picture(element, options) :
    // A named code block's border is drawn apart, broken for the name.
    body(element, tag ? { ...paint, stroke: '' } : paint, options.read('--color-canvas-bg').trim()) +
    (tag ?? '') +
    (element.type === 'code' ? codeRuns(element, paint, options) : '') +
    (element.type === 'table' || element.type === 'class' ? tableInsides(element, paint, options) : '') +
    (element.type === 'text'
      ? textElement(element, paint, (element as { text: string }).text, 0)
      : label && element.type === 'arrow'
        ? arrowLabel(element, paint, label)
        : label && (isShapeType(element.type) || element.type === 'frame')
          ? shapeLabel(element, paint, label, labelInset)
          : '');
  if (inner === '') return '';

  const angle = angleOfElement(element);
  const centre = centreOf(element);
  const attrs: string[] = [`data-id="${escapeXml(element.id)}"`];
  if (angle !== 0) attrs.push(`transform="rotate(${round(angle)} ${round(centre.x)} ${round(centre.y)})"`);
  if (paint.opacity !== 1) attrs.push(`opacity="${round(paint.opacity)}"`);
  return `<g ${attrs.join(' ')}>${inner}</g>`;
}

/** The elements a picture carries, as metadata: nothing when there are none. */
function carried(elements: SceneElement[] | undefined): string {
  if (!elements || elements.length === 0) return '';
  return `<metadata id="${CARRIED_ID}">${escapeXml(JSON.stringify({ version: CARRIED_VERSION, elements }))}</metadata>`;
}

/** The id of the metadata a copied picture carries its elements in. */
export const CARRIED_ID = 'bava-canvas';
/** The form of the elements carried: a reader refuses any other. */
export const CARRIED_VERSION = 1;

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
    `${carried(options.carry)}${style}${background}${drawn}</svg>`
  );
}
