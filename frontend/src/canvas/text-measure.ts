/**
 * Measuring canvas text.
 *
 * The measurement is stored on the element and never recomputed on open.
 * WebKitGTK and WebView2 disagree on glyph advances, so a scene re-measured on
 * another machine reflows, which is why `canvas.md` requires bundled fonts
 * *and* persisted dimensions, not one or the other.
 */
export type Measurement = { width: number; height: number };

export type Measurer = (text: string, font: string) => Measurement;

/** The browser measurer. Falls back to an estimate where there is no canvas. */
export function measureWithCanvas(text: string, font: string): Measurement {
  const canvas = globalThis.document?.createElement('canvas');
  const context = canvas?.getContext('2d');
  if (!context) return estimate(text);

  context.font = font;
  const metrics = context.measureText(text);
  const width = metrics.width;
  const height =
    (metrics.actualBoundingBoxAscent ?? 0) + (metrics.actualBoundingBoxDescent ?? 0);

  // A zero height means the metrics were unavailable rather than that the text
  // has no height.
  return { width, height: height > 0 ? height : estimate(text).height };
}

function estimate(text: string): Measurement {
  const size = 13;
  return { width: text.length * size * 0.55, height: size * 1.45 };
}

/**
 * The size of a block of text: the widest line, and one line height per line.
 * Measuring a multi-line text as one line stored a single line's height, and
 * Konva stops drawing lines that do not fit the box, so only the first line
 * appeared. `widthOf` measures one line; the canvas one in the app.
 */
export function measureTextBlock(
  text: string,
  font: { fontSize: number; lineHeight: number },
  widthOf: (line: string) => number,
): Measurement {
  const lines = text.split('\n');
  return {
    width: Math.max(0, ...lines.map(widthOf)),
    height: lines.length * font.fontSize * font.lineHeight,
  };
}

/** A line's width with the browser's canvas; an estimate where there is none. */
export function canvasLineWidth(font: string): (line: string) => number {
  const context = globalThis.document?.createElement('canvas').getContext('2d');
  if (!context) return (line) => estimate(line).width;
  context.font = font;
  return (line) => context.measureText(line).width;
}
