/**
 * Outlines for the canvas shapes Konva has no primitive for.
 *
 * Pure geometry: each function draws into a path sink for a box `w` by `h`,
 * with every point (curve control points included) inside the box, so
 * hit-testing, selection and resize can treat the box as the shape. Konva's
 * `sceneFunc` passes its canvas context as the sink; tests pass a recorder.
 * Rectangles and ellipses use Konva's own `Rect` and `Ellipse`.
 */
export type PathSink = {
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): void;
  closePath(): void;
};

export const OUTLINE_SHAPES = ['diamond', 'cylinder', 'hexagon', 'parallelogram', 'document', 'person', 'cloud'] as const;

export type OutlineShape = (typeof OUTLINE_SHAPES)[number];

export function isOutlineShape(type: string): type is OutlineShape {
  return (OUTLINE_SHAPES as readonly string[]).includes(type);
}

// Cubic Bézier approximation of a quarter circle.
const KAPPA = 0.5522847498;

/** A full ellipse inside the box (cx ± rx, cy ± ry), as four curves. */
function ellipse(p: PathSink, cx: number, cy: number, rx: number, ry: number) {
  const ox = rx * KAPPA;
  const oy = ry * KAPPA;
  p.moveTo(cx - rx, cy);
  p.bezierCurveTo(cx - rx, cy - oy, cx - ox, cy - ry, cx, cy - ry);
  p.bezierCurveTo(cx + ox, cy - ry, cx + rx, cy - oy, cx + rx, cy);
  p.bezierCurveTo(cx + rx, cy + oy, cx + ox, cy + ry, cx, cy + ry);
  p.bezierCurveTo(cx - ox, cy + ry, cx - rx, cy + oy, cx - rx, cy);
  p.closePath();
}

const outlines: Record<OutlineShape, (p: PathSink, w: number, h: number) => void> = {
  diamond(p, w, h) {
    p.moveTo(w / 2, 0);
    p.lineTo(w, h / 2);
    p.lineTo(w / 2, h);
    p.lineTo(0, h / 2);
    p.closePath();
  },

  cylinder(p, w, h) {
    const ry = Math.min(h * 0.12, w * 0.25);
    const oy = ry * KAPPA;
    const ox = (w / 2) * KAPPA;
    // Body: down the left side, round the front of the base, up the right.
    p.moveTo(0, ry);
    p.lineTo(0, h - ry);
    p.bezierCurveTo(0, h - ry + oy, w / 2 - ox, h, w / 2, h);
    p.bezierCurveTo(w / 2 + ox, h, w, h - ry + oy, w, h - ry);
    p.lineTo(w, ry);
    p.closePath();
    // The lid, drawn whole so its front rim shows.
    ellipse(p, w / 2, ry, w / 2, ry);
  },

  hexagon(p, w, h) {
    const inset = Math.min(w * 0.25, h * 0.5);
    p.moveTo(inset, 0);
    p.lineTo(w - inset, 0);
    p.lineTo(w, h / 2);
    p.lineTo(w - inset, h);
    p.lineTo(inset, h);
    p.lineTo(0, h / 2);
    p.closePath();
  },

  parallelogram(p, w, h) {
    const slant = Math.min(w * 0.2, h * 0.5);
    p.moveTo(slant, 0);
    p.lineTo(w, 0);
    p.lineTo(w - slant, h);
    p.lineTo(0, h);
    p.closePath();
  },

  document(p, w, h) {
    const wave = h * 0.08;
    p.moveTo(0, 0);
    p.lineTo(w, 0);
    p.lineTo(w, h - wave);
    // One S-curve along the bottom edge, from right to left.
    p.bezierCurveTo(w * 0.66, h - 2 * wave, w * 0.33, h, 0, h - wave);
    p.closePath();
  },

  person(p, w, h) {
    // Shoulders: a rounded mound across the lower half.
    p.moveTo(0, h);
    p.bezierCurveTo(0, h * 0.6, w * 0.25, h * 0.52, w / 2, h * 0.52);
    p.bezierCurveTo(w * 0.75, h * 0.52, w, h * 0.6, w, h);
    p.closePath();
    // Head: a circle above them.
    const r = Math.min(w, h) * 0.22;
    ellipse(p, w / 2, h * 0.25, r, r);
  },

  cloud(p, w, h) {
    p.moveTo(w * 0.2, h * 0.9);
    p.bezierCurveTo(0, h * 0.9, 0, h * 0.55, w * 0.18, h * 0.5);
    p.bezierCurveTo(w * 0.12, h * 0.2, w * 0.42, h * 0.05, w * 0.5, h * 0.25);
    p.bezierCurveTo(w * 0.58, 0, w * 0.9, h * 0.08, w * 0.8, h * 0.4);
    p.bezierCurveTo(w, h * 0.4, w, h * 0.9, w * 0.8, h * 0.9);
    p.closePath();
  },
};

export function drawOutline(shape: OutlineShape, sink: PathSink, w: number, h: number): void {
  outlines[shape](sink, w, h);
}
