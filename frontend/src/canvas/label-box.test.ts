import { describe, expect, it } from 'vitest';
import { growToLabel, labelArea, labelHeight, neededHeight, placeLabel } from './label-box';
import { drawOutline, OUTLINE_SHAPES, type OutlineShape, type PathSink } from './shapes';

type Point = [number, number];

/** A shape's outline as polygons, its curves sampled. */
function outline(shape: OutlineShape, w: number, h: number): Point[][] {
  const paths: Point[][] = [];
  let current: Point[] = [];
  let at: Point = [0, 0];
  const sink: PathSink = {
    moveTo(x, y) {
      if (current.length) paths.push(current);
      current = [[x, y]];
      at = [x, y];
    },
    lineTo(x, y) {
      current.push([x, y]);
      at = [x, y];
    },
    bezierCurveTo(c1x, c1y, c2x, c2y, x, y) {
      const [x0, y0] = at;
      for (let i = 1; i <= 24; i += 1) {
        const t = i / 24;
        const u = 1 - t;
        current.push([
          u * u * u * x0 + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * x,
          u * u * u * y0 + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * y,
        ]);
      }
      at = [x, y];
    },
    closePath() {},
  };
  drawOutline(shape, sink, w, h);
  if (current.length) paths.push(current);
  return paths;
}

function inside(polygon: Point[], [x, y]: Point): boolean {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

const corners = (a: { x: number; y: number; w: number; h: number }): Point[] => [
  [a.x, a.y],
  [a.x + a.w, a.y],
  [a.x, a.y + a.h],
  [a.x + a.w, a.y + a.h],
];

const INSET = 8;

describe('where a label sits in its shape', () => {
  for (const shape of OUTLINE_SHAPES) {
    for (const [w, h] of [
      [200, 100],
      [120, 240],
      [300, 60],
    ]) {
      it(`keeps clear of a ${shape}'s edges at ${w} by ${h}`, () => {
        const area = labelArea(shape, w, h, INSET);
        expect(area.w).toBeGreaterThan(0);
        expect(area.h).toBeGreaterThan(0);
        const paths = outline(shape, w, h);
        for (const corner of corners(area)) expect(paths.some((path) => inside(path, corner))).toBe(true);
      });
    }
  }

  it("keeps clear of an ellipse's curve", () => {
    const w = 200;
    const h = 100;
    const area = labelArea('ellipse', w, h, INSET);
    for (const [x, y] of corners(area)) expect(((x - w / 2) / (w / 2)) ** 2 + ((y - h / 2) / (h / 2)) ** 2).toBeLessThanOrEqual(1);
  });

  it('sits in a rectangle less its inset, every side', () => {
    expect(labelArea('rectangle', 200, 100, INSET)).toEqual({ x: 8, y: 8, w: 184, h: 84 });
  });

  it("sits in a frame's inset, as its title does", () => {
    expect(labelArea('frame', 200, 100, INSET)).toEqual({ x: 8, y: 8, w: 184, h: 84 });
  });

  it('is never less than nothing in a shape too small for it', () => {
    const area = labelArea('diamond', 10, 10, INSET);
    expect(area.w).toBe(0);
    expect(area.h).toBe(0);
  });
});

describe('the height a label needs', () => {
  for (const shape of ['rectangle', 'ellipse', ...OUTLINE_SHAPES]) {
    it(`holds the text in a ${shape}, and no more than it must`, () => {
      const w = 200;
      const text = 130;
      const h = neededHeight(shape, w, text, INSET);
      expect(labelArea(shape, w, h, INSET).h).toBeGreaterThanOrEqual(text - 0.01);
      expect(labelArea(shape, w, h - 1, INSET).h).toBeLessThan(text);
    });
  }

  it('is no height at all for no text', () => {
    expect(neededHeight('rectangle', 200, 0, INSET)).toBe(0);
  });
});

describe('a label placed in its shape', () => {
  const chars = (line: string) => line.length * 6;
  const font = { size: 10, lineHeight: 1.2, verticalAlign: 'middle' as const };

  it('sits in the inscribed box of an ellipse, its words broken to that width', () => {
    const placed = placeLabel('ellipse', 200, 100, 'Supercalifragilisticexpialidocious', INSET, font, chars);
    const area = labelArea('ellipse', 200, 100, INSET);
    expect({ x: placed.x, w: placed.w }).toEqual({ x: area.x, w: area.w });
    for (const line of placed.lines) expect(chars(line)).toBeLessThanOrEqual(area.w);
    expect(placed.lines.join('')).toBe('Supercalifragilisticexpialidocious');
    expect(placed.verticalAlign).toBe('middle');
  });

  it('keeps every line of a label taller than its shape, running on past the bottom', () => {
    const placed = placeLabel('rect', 60, 20, 'one two three four five six', INSET, font, chars);
    expect(placed.lines.join(' ')).toBe('one two three four five six');
    expect(placed.h).toBeCloseTo(placed.lines.length * 12);
    expect(placed.y).toBe(labelArea('rect', 60, 20, INSET).y);
    expect(placed.verticalAlign).toBe('top');
  });
});

describe('a shape grown to hold its label', () => {
  const need = () => 90;

  it('grows taller to the height its label needs', () => {
    const shape = { type: 'rect', w: 100, h: 40, label: 'long' };
    expect(growToLabel(shape, need)).toBe(true);
    expect(shape.h).toBe(90);
  });

  it('never shrinks a shape made taller than its label needs', () => {
    const shape = { type: 'rect', w: 100, h: 200, label: 'short' };
    expect(growToLabel(shape, need)).toBe(false);
    expect(shape.h).toBe(200);
  });

  it('leaves alone what has no label, a frame, an arrow and text', () => {
    for (const shape of [
      { type: 'rect', w: 100, h: 40 },
      { type: 'frame', w: 100, h: 40, label: 'Title' },
      { type: 'arrow', w: 100, h: 40, label: 'sends' },
      { type: 'text', w: 100, h: 40 },
    ]) {
      expect(growToLabel(shape, need)).toBe(false);
      expect(shape.h).toBe(40);
    }
  });
});

describe('the height a shape needs for its label, as drawn', () => {
  const chars = (line: string) => line.length * 6;
  const font = { size: 10, lineHeight: 1.2, verticalAlign: 'middle' as const };

  it('holds every line its label breaks into at that height', () => {
    for (const type of ['rect', 'ellipse', 'hexagon', 'diamond', 'cloud']) {
      const label = 'Collect feedback from the first hundred users and sort it by theme';
      const h = labelHeight(type, 120, 30, label, INSET, font, chars);
      const placed = placeLabel(type, 120, h, label, INSET, font, chars);
      expect(placed.lines.length * 12).toBeLessThanOrEqual(labelArea(type, 120, h, INSET).h + 0.01);
    }
  });

  it('is no taller than the shape for a label that fits', () => {
    expect(labelHeight('rect', 200, 100, 'Hi', INSET, font, chars)).toBeLessThanOrEqual(100);
  });
});
