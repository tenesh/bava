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

/**
 * A closed polygon, with corners rounded to `radius` when one is given.
 *
 * Each corner becomes a curve that starts and ends on the sides meeting there,
 * so the path stays inside the box. The radius is capped at half the shorter
 * side meeting the corner, as Excalidraw caps its proportional radius.
 */
function polygon(p: PathSink, points: [number, number][], radius = 0): void {
  if (radius <= 0) {
    points.forEach(([x, y], i) => (i === 0 ? p.moveTo(x, y) : p.lineTo(x, y)));
    p.closePath();
    return;
  }

  const count = points.length;
  const towards = (from: [number, number], to: [number, number], distance: number): [number, number] => {
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const length = Math.hypot(dx, dy) || 1;
    const step = Math.min(distance, length / 2);
    return [from[0] + (dx / length) * step, from[1] + (dy / length) * step];
  };

  for (let i = 0; i < count; i += 1) {
    const previous = points[(i - 1 + count) % count];
    const corner = points[i];
    const next = points[(i + 1) % count];
    const start = towards(corner, previous, radius);
    const end = towards(corner, next, radius);
    if (i === 0) p.moveTo(start[0], start[1]);
    else p.lineTo(start[0], start[1]);
    // A quadratic through the corner, written as the cubic the sink takes.
    p.bezierCurveTo(
      start[0] + (2 / 3) * (corner[0] - start[0]),
      start[1] + (2 / 3) * (corner[1] - start[1]),
      end[0] + (2 / 3) * (corner[0] - end[0]),
      end[1] + (2 / 3) * (corner[1] - end[1]),
      end[0],
      end[1],
    );
  }
  p.closePath();
}

const outlines: Record<OutlineShape, (p: PathSink, w: number, h: number, radius?: number) => void> = {
  diamond(p, w, h, radius) {
    polygon(
      p,
      [
        [w / 2, 0],
        [w, h / 2],
        [w / 2, h],
        [0, h / 2],
      ],
      radius,
    );
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

  hexagon(p, w, h, radius) {
    const inset = Math.min(w * 0.25, h * 0.5);
    polygon(
      p,
      [
        [inset, 0],
        [w - inset, 0],
        [w, h / 2],
        [w - inset, h],
        [inset, h],
        [0, h / 2],
      ],
      radius,
    );
  },

  parallelogram(p, w, h, radius) {
    const slant = Math.min(w * 0.2, h * 0.5);
    polygon(
      p,
      [
        [slant, 0],
        [w, 0],
        [w - slant, h],
        [0, h],
      ],
      radius,
    );
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

/**
 * Draw a shape's outline into a sink. `radius` rounds the corners of the
 * polygon shapes (diamond, hexagon, parallelogram); the curved outlines have
 * no corners and ignore it.
 */
export function drawOutline(shape: OutlineShape, sink: PathSink, w: number, h: number, radius = 0): void {
  outlines[shape](sink, w, h, radius);
}
