/**
 * The dot grid behind the drawing: which dots a view shows.
 *
 * Pure arithmetic, kept apart from Konva so it is tested directly. The dots
 * sit on a lattice of the drawing, so they pan and zoom with it; only the
 * ones inside the view are listed, and when zoomed so far out that they would
 * crowd together on screen, every other one is dropped until they do not.
 */

export type GridView = {
  zoom: number;
  pan: { x: number; y: number };
  /** The view's size on screen. */
  width: number;
  height: number;
};

export type GridDots = {
  /** The lattice spacing in the drawing, after thinning. */
  step: number;
  /** Drawing coordinates of each column and row of dots in view. */
  xs: number[];
  ys: number[];
};

/**
 * The spacing in the drawing between drawn dots: `step`, doubled until the
 * dots stand at least `minGap` apart on screen. Zero when there is no grid.
 */
export function gridStep(step: number, zoom: number, minGap: number): number {
  if (!(step > 0) || !(zoom > 0)) return 0;
  let spacing = step;
  while (spacing * zoom < minGap) spacing *= 2;
  return spacing;
}

/** Positions along one axis, from `from` to `to`, on multiples of `step`. */
function along(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  if (step <= 0 || to <= from) return out;
  for (let at = Math.ceil(from / step) * step; at <= to; at += step) out.push(at + 0); // never -0
  return out;
}

/** The dots a view shows, in drawing coordinates. */
export function gridDots(view: GridView, step: number, minGap: number): GridDots {
  const spacing = gridStep(step, view.zoom, minGap);
  if (spacing === 0) return { step: 0, xs: [], ys: [] };
  // The view's corners in the drawing.
  const left = -view.pan.x / view.zoom;
  const top = -view.pan.y / view.zoom;
  const right = (view.width - view.pan.x) / view.zoom;
  const bottom = (view.height - view.pan.y) / view.zoom;
  return { step: spacing, xs: along(left, right, spacing), ys: along(top, bottom, spacing) };
}
