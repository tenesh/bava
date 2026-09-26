import { describe, expect, it } from 'vitest';
import { toSvg } from './svg';
import { exportArea } from './area';
import { svgPathSink } from './path-sink';
import { drawOutline } from '../shapes';
import { drawHead, labelPoint, pathOf } from '../arrows';
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
    expect(svg).toContain('stroke-width="2"');
  });

  it('writes a dashed line as a dash array', () => {
    const svg = svgOf([{ id: 'l', type: 'line', x: 0, y: 0, w: 50, h: 0, z: 1, points: [0, 0, 50, 0], strokeStyle: 'dashed' }]);
    // Excalidraw's [8, 8 + width] since 06.16 (T2), and half a unit thicker.
    expect(svg).toContain('stroke-width="2.5" stroke-dasharray="8 10"');
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
    // An elbow is orthogonal, stepping out, across and in, with its corners
    // rounded as the stage draws them (06.14 E4).
    const path = pathOf([0, 0, 40, 40], 'elbow');
    const pairs = Array.from({ length: path.length / 2 }, (_, i) => `${Math.round(path[i * 2] * 1000) / 1000} ${Math.round(path[i * 2 + 1] * 1000) / 1000}`);
    expect(svg).toContain(`points="${pairs.join(' ')}"`);
    expect(svg).not.toContain('points="0 0 20 0 20 40 40 40"');
    expect(svg).toContain('data-head="end"');
  });

  // Since 06.16 (H2, H3) a head is sized by its kind, capped by the last
  // segment: the stage's own geometry, in the export.
  it("draws the head at its kind's size, capped by the arrow's length", () => {
    const svg = svgOf([{ id: 'a', type: 'arrow', x: 0, y: 0, w: 40, h: 0, z: 1, points: [0, 0, 40, 0] }]);
    const sink = svgPathSink();
    drawHead(sink, 'arrow', 40, 2);
    expect(svg).toContain(sink.d());
  });

  // 06.16 H5: an outline head is filled with the canvas, hiding the line.
  it('fills an outline head with the canvas colour', () => {
    const svg = svgOf([{ id: 'a', type: 'arrow', x: 0, y: 0, w: 100, h: 0, z: 1, points: [0, 0, 100, 0], endArrowhead: 'triangle-outline' }]);
    expect(svg).toMatch(/data-head="end"[^>]*><path[^>]*fill="white"/);
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
    const { fixtureScene, fixtureRead, fixtureCodeRuns, MONO_ADVANCE } = await import('./__fixtures__/generate');
    expect(
      toSvg(exportArea(fixtureScene, []), {
        read: fixtureRead,
        background: true,
        codeRuns: fixtureCodeRuns,
        monoAdvance: MONO_ADVANCE,
      }) + '\n',
    ).toBe(expected);
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

  // Since 06.16 (decision 16) a label sits on the middle point; slid, it
  // sits along the path as drawn, corners rounded (the 06.14 review).
  it("writes an elbow's label at its middle point, or slid along the drawn path", () => {
    const at = (over: Record<string, unknown>) =>
      svgOf([{ id: 'a', type: 'arrow', arrowType: 'elbow', x: 0, y: 0, w: 100, h: 100, z: 1, points: [0, 0, 100, 0, 100, 100], label: 'x', ...over }]);
    expect(at({})).toContain('<text x="100"');
    const slid = labelPoint(pathOf([0, 0, 100, 0, 100, 100], 'elbow'), 0.5);
    expect(at({ labelPosition: 0.5 })).toContain(`<text x="${Math.round(slid.x * 1000) / 1000}"`);
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

// A code block exports as its panel and its coloured runs, as real text: an
// exported diagram holds code you can select, not a picture of code.
describe('exporting a code block', () => {
  const codeRead = (name: string) =>
    (({
      '--color-code-surface': 'whitesmoke',
      '--color-border-subtle': 'gainsboro',
      '--syntax-keyword': 'purple',
      '--syntax-plain': 'black',
      '--font-mono': 'Geist Mono',
      '--text-code': '13px',
      '--leading-code': '1.5',
      '--size-code-padding': '8px',
      '--radius-md': '6px',
    }) as Record<string, string>)[name] ?? '';

  const block = {
    id: 'c',
    type: 'code',
    x: 0,
    y: 0,
    w: 200,
    h: 40,
    z: 1,
    code: 'const a',
    measuredWidth: 200,
    measuredHeight: 40,
  };

  const runs = {
    c: [
      [
        { text: 'const', kind: 'keyword' as const },
        { text: ' a', kind: 'plain' as const },
      ],
    ],
  };

  it('draws the panel and every run, in the run colours', () => {
    const svg = toSvg(exportArea({ elements: [block] as never[] }, []), { read: codeRead, codeRuns: runs });
    expect(svg).toContain('fill="whitesmoke"');
    expect(svg).toContain('>const<');
    expect(svg).toContain('fill="purple"');
    expect(svg).toContain('fill="black"');
  });

  // The same wrap the canvas uses: 76 wide, padding 8, advance 6 holds ten
  // columns, so sixteen letters take two rows.
  it('wraps a line to the block width, as the canvas does', () => {
    const narrow = { ...block, w: 76 };
    const long = { c: [[{ text: 'abcdefghijklmnop', kind: 'plain' as const }]] };
    const svg = toSvg(exportArea({ elements: [narrow] as never[] }, []), { read: codeRead, codeRuns: long, monoAdvance: 6 });
    expect(svg).toContain('>abcdefghij<');
    expect(svg).toContain('>klmnop<');
  });

  it('keeps the mono font, so the columns line up', () => {
    const svg = toSvg(exportArea({ elements: [block] as never[] }, []), { read: codeRead, codeRuns: runs });
    expect(svg).toContain('font-family="Geist Mono"');
  });

  it('draws just the panel when it has no runs to draw', () => {
    const svg = toSvg(exportArea({ elements: [block] as never[] }, []), { read: codeRead });
    expect(svg).toContain('fill="whitesmoke"');
    expect(svg).not.toContain('>const<');
  });
});

// The exporter places a label where the canvas does, position included.
describe('an arrow label placed along its arrow', () => {
  it('is exported where its position puts it', () => {
    const svg = svgOf([{ id: 'a', type: 'arrow', x: 0, y: 0, w: 200, h: 0, z: 1, points: [0, 0, 200, 0], label: 'L', labelPosition: 0.25 }]);
    expect(svg).toMatch(/<tspan x="50"/);
  });
});

// The canvas draws heads solid on a dashed arrow (and Excalidraw does too); a
// dashed head exported as broken strokes disagreed with it.
describe('the heads of a dashed arrow', () => {
  it('are exported solid, while the line stays dashed', () => {
    const svg = svgOf([{ id: 'a', type: 'arrow', x: 0, y: 0, w: 200, h: 0, z: 1, points: [0, 0, 200, 0], strokeStyle: 'dashed' }]);
    const head = svg.slice(svg.indexOf('data-head='));
    expect(svg.slice(0, svg.indexOf('data-head='))).toContain('stroke-dasharray');
    expect(head).not.toContain('stroke-dasharray');
  });
});

// 06.15 P21: a closed line's fill travels into the export.
describe('exporting a closed line', () => {
  it('fills it', () => {
    const svg = svgOf([{ id: 'l', type: 'line', x: 0, y: 0, w: 10, h: 10, z: 1, points: [0, 0, 10, 0, 10, 10, 0, 0], closed: true, fill: 'blue' }]);
    expect(svg).toMatch(/<polyline[^>]*fill="lightblue"/);
  });
});

describe("the line under an exported arrow's label", () => {
  it('is masked out where the label sits', () => {
    const svg = svgOf([{ id: 'a', type: 'arrow', x: 0, y: 0, w: 200, h: 0, z: 1, points: [0, 0, 200, 0], label: 'sends' }]);
    expect(svg).toContain('<mask id="label-a"');
    expect(svg).toMatch(/<polyline[^>]*mask="url\(#label-a\)"/);
    expect(svgOf([{ id: 'b', type: 'arrow', x: 0, y: 0, w: 200, h: 0, z: 1, points: [0, 0, 200, 0] }])).not.toContain('<mask');
  });
});

// Review of 06.16: a head is capped by the arrow's own last segment, not by
// a drawn curve's samples or an elbow's rounded corner, in both renderers.
describe('the size of a head on a bent arrow', () => {
  const headOf = (svg: string) => svg.match(/data-head="end"[^>]*><path d="([^"]*)"/)![1];
  it('on a curved arrow is its full size', () => {
    const svg = svgOf([{ id: 'a', type: 'arrow', arrowType: 'arc', x: 0, y: 0, w: 240, h: 60, z: 1, points: [0, 0, 120, 60, 240, 0] }]);
    const sink = svgPathSink();
    drawHead(sink, 'arrow', Math.hypot(120, 60), 2);
    expect(headOf(svg)).toBe(sink.d());
  });
  it('on an elbow is capped by its last leg', () => {
    const svg = svgOf([{ id: 'e', type: 'arrow', arrowType: 'elbow', x: 0, y: 0, w: 130, h: 100, z: 1, points: [0, 0, 100, 0, 100, 100, 130, 100] }]);
    const sink = svgPathSink();
    drawHead(sink, 'arrow', 30, 2);
    expect(headOf(svg)).toBe(sink.d());
  });
});

describe("an exported code block's language", () => {
  it('names it on the top edge, the border masked behind it', () => {
    const svg = svgOf([{ id: 'c', type: 'code', x: 0, y: 0, w: 200, h: 60, z: 1, code: 'x', language: 'go', measuredWidth: 200, measuredHeight: 60 }]);
    expect(svg).toContain('>Go</text>');
    expect(svg).toContain('<mask id="language-c"');
    // The body is filled without a stroke: the border is the masked one.
    const body = svg.match(/<g data-id="c">(<rect[^>]*>)/)![1];
    expect(body).not.toContain('stroke=');
    expect(svgOf([{ id: 'p', type: 'code', x: 0, y: 0, w: 200, h: 60, z: 1, code: 'x', measuredWidth: 200, measuredHeight: 60 }])).not.toContain('language-p');
  });
});

describe('an exported code block at another size (06.17)', () => {
  it('draws its code at its own size and advance', () => {
    const svg = toSvg(exportArea({ elements: [{ id: 'c', type: 'code', x: 0, y: 0, w: 400, h: 80, z: 1, code: 'ab', fontSize: 26, measuredWidth: 400, measuredHeight: 80 }] as never[] }, []), {
      read: (name: string) => (({ '--text-code': '13px', '--font-mono': 'Geist Mono', '--leading-code': '1.5', '--size-code-padding': '8px' }) as Record<string, string>)[name] ?? '',
      codeRuns: { c: [[{ text: 'a', kind: 'plain' }, { text: 'b', kind: 'plain' }]] } as never,
      monoAdvance: 6,
    });
    expect(svg).toContain('font-size="26"');
    // The second character one advance on: 6 at 13, 12 at 26.
    expect(svg).toContain('<text x="20"');
  });
});

describe('an exported label along its arrow (06.17)', () => {
  it('is turned about its centre', () => {
    const svg = svgOf([{ id: 'a', type: 'arrow', x: 0, y: 0, w: 0, h: 100, z: 1, points: [0, 0, 0, 100], label: 'down', labelDirection: 'along' }]);
    expect(svg).toContain('<g transform="rotate(90 0 50)">');
    expect(svg).toContain('<polygon points=');
  });
});
