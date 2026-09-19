import { describe, expect, it } from 'vitest';
import { toSvg } from './svg';
import { exportArea } from './area';
import { svgPathSink } from './path-sink';
import { drawOutline } from '../shapes';
import { drawHead } from '../arrows';
import type { SceneData, SceneElement } from '../scene';

const read = (name: string) =>
  (({
    '--color-shape-fill': 'ivory',
    '--color-shape-stroke': 'slategray',
    '--color-shape-text': 'black',
    '--color-canvas-bg': 'white',
    '--swatch-blue-fill': 'lightblue',
    '--swatch-blue-stroke': 'steelblue',
    '--swatch-blue-text': 'navy',
    '--size-shape-stroke': '1.5px',
    '--size-pen-stroke': '2px',
    '--size-dash': '6px',
    '--size-dot': '2px',
    '--size-arrowhead': '10px',
    '--radius-shape-round': '32px',
    '--font-ui': 'Geist',
    '--text-body': '16px',
    '--leading-tight': '1.2',
  }) as Record<string, string>)[name] ?? '';

const svgOf = (elements: unknown[], options: Parameters<typeof toSvg>[1] = { read }) =>
  toSvg(exportArea({ elements } as SceneData, []), options);

describe('exporting to SVG', () => {
  it('sizes the document to the padded area', () => {
    const svg = svgOf([{ id: 'r', type: 'rect', x: 0, y: 0, w: 100, h: 50, z: 1 }]);
    expect(svg).toContain('viewBox="-16 -16 132 82"');
    expect(svg).toContain('width="132"');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it('draws a shape with its resolved fill and stroke', () => {
    const svg = svgOf([{ id: 'r', type: 'rect', x: 0, y: 0, w: 100, h: 50, z: 1, fill: 'blue' }]);
    expect(svg).toContain('fill="lightblue"');
    expect(svg).toContain('stroke="slategray"');
    expect(svg).toContain('stroke-width="1.5"');
  });

  it('writes a dashed line as a dash array', () => {
    const svg = svgOf([{ id: 'l', type: 'line', x: 0, y: 0, w: 50, h: 0, z: 1, points: [0, 0, 50, 0], strokeStyle: 'dashed' }]);
    expect(svg).toContain('stroke-dasharray="6 6"');
  });

  it('turns a rotated element about its own centre', () => {
    const svg = svgOf([{ id: 'r', type: 'rect', x: 0, y: 0, w: 100, h: 50, z: 1, angle: 30 }]);
    expect(svg).toContain('rotate(30 50 25)');
  });

  it('carries an element opacity', () => {
    const svg = svgOf([{ id: 'r', type: 'rect', x: 0, y: 0, w: 10, h: 10, z: 1, opacity: 40 }]);
    expect(svg).toContain('opacity="0.4"');
  });

  // The outline shapes have no SVG primitive: they are drawn through the same
  // code the canvas uses, so the two cannot disagree.
  it('draws an outline shape through the canvas geometry', () => {
    const svg = svgOf([{ id: 'd', type: 'diamond', x: 0, y: 0, w: 100, h: 60, z: 1 }]);
    const sink = svgPathSink();
    drawOutline('diamond', sink, 100, 60, 0);
    expect(svg).toContain(sink.d());
  });

  it('draws an arrow along its routed path, with a head at the end', () => {
    const svg = svgOf([
      { id: 'a', type: 'arrow', x: 0, y: 0, w: 40, h: 40, z: 1, points: [0, 0, 40, 40], arrowType: 'elbow' },
    ]);
    // An elbow is orthogonal: it steps out, across and in, never diagonally.
    expect(svg).toContain('points="0 0 20 0 20 40 40 40"');
    expect(svg).toContain('data-head="end"');
  });

  // The head is sized by its own token, not by whatever else was to hand.
  it('draws the head at the arrowhead size', () => {
    const svg = svgOf([{ id: 'a', type: 'arrow', x: 0, y: 0, w: 40, h: 0, z: 1, points: [0, 0, 40, 0] }]);
    const sink = svgPathSink();
    drawHead(sink, 'arrow', 10);
    expect(svg).toContain(sink.d());
  });

  it('writes text with its size and content, escaped', () => {
    const svg = svgOf([
      // Wide enough to hold the line, so this tests escaping and not wrapping.
      { id: 't', type: 'text', x: 0, y: 0, w: 600, h: 20, z: 1, text: 'a < b & c', measuredWidth: 600, measuredHeight: 20, fontSize: 28 },
    ]);
    expect(svg).toContain('font-size="28"');
    expect(svg).toContain('a &lt; b &amp; c');
    expect(svg).not.toContain('a < b & c');
  });

  // The stage hands Konva text already broken by `text-layout.ts`, so the two
  // renderers cannot disagree about where a long label ends up.
  it('wraps a label the same way the canvas does', () => {
    const svg = svgOf([
      { id: 'r', type: 'rect', x: 0, y: 0, w: 60, h: 50, z: 1, label: 'a label far too long for this box' },
    ]);
    expect((svg.match(/<tspan/g) ?? []).length).toBeGreaterThan(1);
  });

  it("writes a shape's label inside it", () => {
    const svg = svgOf([{ id: 'r', type: 'rect', x: 0, y: 0, w: 100, h: 50, z: 1, label: 'Hello' }]);
    expect(svg).toContain('Hello');
    expect(svg).toContain('text-anchor="middle"');
  });

  it('paints the background only when asked', () => {
    const elements = [{ id: 'r', type: 'rect', x: 0, y: 0, w: 10, h: 10, z: 1 }];
    expect(svgOf(elements, { read, background: true })).toContain('fill="white"');
    expect(svgOf(elements, { read })).not.toContain('data-background');
  });

  it('draws an empty scene as an empty document rather than failing', () => {
    const svg = toSvg(exportArea({ elements: [] as SceneElement[] }, []), { read });
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });
});

// The committed picture of every element type, looked at by eye before it was
// committed. It is what catches a change in any shape, route or head that the
// per-element tests above would each still pass.
describe('the exported picture of every element type', () => {
  it('matches the fixture', async () => {
    const { readFileSync } = await import('node:fs');
    const expected = readFileSync(new URL('./__fixtures__/scene.svg', import.meta.url), 'utf8');
    const { fixtureScene, fixtureRead } = await import('./__fixtures__/generate');
    expect(toSvg(exportArea(fixtureScene, []), { read: fixtureRead, background: true }) + '\n').toBe(expected);
  });
});

// An arrow's label travels with it into an exported file, at the same place
// the canvas draws it.
describe('exporting an arrow label', () => {
  it('writes it at the middle of the path', () => {
    const svg = svgOf([
      { id: 'a', type: 'arrow', x: 0, y: 0, w: 100, h: 0, z: 1, points: [0, 0, 100, 0], label: 'sends to' },
    ]);
    expect(svg).toContain('sends to');
    expect(svg).toMatch(/<text[^>]*x="50"/);
  });
});

// An arrow label wraps the same way in both renderers: the canvas wraps it to
// the length of the path, and so does the export.
describe('a long arrow label', () => {
  it('wraps in the export as it wraps on the canvas', () => {
    const svg = svgOf([
      { id: 'a', type: 'arrow', x: 0, y: 0, w: 40, h: 0, z: 1, points: [0, 0, 40, 0], label: 'a label far longer than this arrow' },
    ]);
    expect((svg.match(/<tspan/g) ?? []).length).toBeGreaterThan(1);
  });
});
