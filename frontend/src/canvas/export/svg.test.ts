import { beforeAll, describe, expect, it } from 'vitest';
import { loadSet } from '../icons/sets';
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
    // Dashes of 8 with gaps of 8 plus the width, and half a unit thicker.
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
    // rounded as the stage draws them.
    const path = pathOf([0, 0, 40, 40], 'elbow');
    const pairs = Array.from({ length: path.length / 2 }, (_, i) => `${Math.round(path[i * 2] * 1000) / 1000} ${Math.round(path[i * 2 + 1] * 1000) / 1000}`);
    expect(svg).toContain(`points="${pairs.join(' ')}"`);
    expect(svg).not.toContain('points="0 0 20 0 20 40 40 40"');
    expect(svg).toContain('data-head="end"');
  });

  // A head is sized by its kind, capped by the last
  // segment: the stage's own geometry, in the export.
  it("draws the head at its kind's size, capped by the arrow's length", () => {
    const svg = svgOf([{ id: 'a', type: 'arrow', x: 0, y: 0, w: 40, h: 0, z: 1, points: [0, 0, 40, 0] }]);
    const sink = svgPathSink();
    drawHead(sink, 'arrow', 40, 2);
    expect(svg).toContain(sink.d());
  });

  // An outline head is filled with the canvas, hiding the line.
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

  it('keeps every line of a label taller than its shape', () => {
    const svg = svgOf([{ id: 'r', type: 'rect', x: 0, y: 0, w: 60, h: 12, z: 1, label: 'one two three four five six seven eight' }]);
    const spans = [...svg.matchAll(/<tspan[^>]*>([^<]*)<\/tspan>/g)].map((m) => m[1]);
    expect(spans.join(' ')).toBe('one two three four five six seven eight');
  });

  it("writes an ellipse's label in the box inside its curve, a long word broken", () => {
    const svg = svgOf([{ id: 'e', type: 'ellipse', x: 0, y: 0, w: 80, h: 60, z: 1, label: 'Supercalifragilisticexpialidocious' }]);
    const spans = [...svg.matchAll(/<tspan[^>]*>([^<]*)<\/tspan>/g)].map((m) => m[1]);
    expect(spans.length).toBeGreaterThan(1);
    expect(spans.join('')).toBe('Supercalifragilisticexpialidocious');
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

  // A label sits on the middle point; slid, it sits along the path as drawn,
  // corners rounded.
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

// The canvas draws heads solid on a dashed arrow, so they read as heads; a
// dashed head exported as broken strokes disagreed with it.
describe('the heads of a dashed arrow', () => {
  it('are exported solid, while the line stays dashed', () => {
    const svg = svgOf([{ id: 'a', type: 'arrow', x: 0, y: 0, w: 200, h: 0, z: 1, points: [0, 0, 200, 0], strokeStyle: 'dashed' }]);
    const head = svg.slice(svg.indexOf('data-head='));
    expect(svg.slice(0, svg.indexOf('data-head='))).toContain('stroke-dasharray');
    expect(head).not.toContain('stroke-dasharray');
  });
});

// A closed line's fill travels into the export.
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

// A head is capped by the arrow's own last segment, not by
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

describe('an exported code block at another size', () => {
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

describe('an exported label along its arrow', () => {
  it('is turned about its centre', () => {
    const svg = svgOf([{ id: 'a', type: 'arrow', x: 0, y: 0, w: 0, h: 100, z: 1, points: [0, 0, 0, 100], label: 'down', labelDirection: 'along' }]);
    expect(svg).toContain('<g transform="rotate(90 0 50)">');
    expect(svg).toContain('<polygon points=');
  });
});

describe('pictures in an SVG', () => {
  const picture = { id: 'p', type: 'image', file: 'har gow.png', x: 10, y: 20, w: 200, h: 150, z: 1 };

  it('are drawn from the address given, filling their box, and say which file they are', () => {
    const svg = svgOf([picture], { read, pictures: { 'har gow.png': 'data:image/png;base64,AAAA' } });
    expect(svg).toContain('<image data-file="har gow.png" x="10" y="20" width="200" height="150" preserveAspectRatio="none" href="data:image/png;base64,AAAA"/>');
  });

  it('turn and fade as the element says, as every element does', () => {
    const svg = svgOf([{ ...picture, angle: 90, opacity: 50 }], { read, pictures: { 'har gow.png': 'data:,' } });
    expect(svg).toContain('transform="rotate(90 110 95)"');
    expect(svg).toContain('opacity="0.5"');
  });

  it('draw their placeholder when they cannot be shown, named', () => {
    for (const pictures of [{ 'har gow.png': null }, {}] as Record<string, string | null>[]) {
      const svg = svgOf([picture], { read, pictures });
      expect(svg).not.toContain('<image');
      expect(svg).toContain('stroke-dasharray="4 4"');
      expect(svg).toContain('har gow.png is missing');
    }
  });
});

describe('tables and classes in an SVG', () => {
  const table = { id: 't', type: 'table', name: 'users & co', rows: 'id int pk\nemail text unique', x: 10, y: 20, w: 240, h: 98, z: 1 };

  it('draws the box, the name, the rule and each row as the canvas does', () => {
    const svg = svgOf([table]);
    expect(svg).toContain('<rect x="10" y="20" width="240" height="98"');
    for (const word of ['users &amp; co', '>id<', '>int<', '>PK<', '>email<', '>UNQ<']) expect(svg).toContain(word);
    // The rule under the header.
    expect(svg).toContain('<line x1="10" y1="56" x2="250" y2="56"');
    // Cut at the box, as on the canvas.
    expect(svg).toMatch(/<clipPath id="clip-t">/);
  });

  it("draws a class's divider", () => {
    const svg = svgOf([{ id: 'c', type: 'class', name: 'User', rows: '+ email: string\n+ save(): bool', x: 0, y: 0, w: 260, h: 110, z: 1 }]);
    expect(svg.match(/<line /g)).toHaveLength(2);
    expect(svg).toContain('>save()<');
  });
});

describe('icons in an SVG', () => {
  beforeAll(async () => {
    await Promise.all([loadSet('line'), loadSet('logo')]);
  });

  const icon = (over: Record<string, unknown>) => ({ id: 'i', type: 'icon', icon: 'line/database', x: 10, y: 20, w: 48, h: 48, z: 1, ...over });

  it('draws a line icon as its own paths, stroked in its colour and scaled to its box', () => {
    const svg = svgOf([icon({})]);
    expect(svg).toContain('<g transform="translate(10 20) scale(2)">');
    expect(svg).toContain('<path d="M4 6a8 3 0 1 0 16 0a8 3 0 1 0 -16 0" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>');
    expect(svg).not.toContain('<image');
  });

  it("fills a logo in its own colour for Brand, and writes its label under it", () => {
    const svg = svgOf([icon({ icon: 'logo/redis', color: 'brand', label: 'Cache', measuredWidth: 40, measuredHeight: 19 })]);
    expect(svg).toMatch(/<path d="[^"]+" fill="#FF4438" stroke="none"\/>/);
    expect(svg).toMatch(/<text x="34" y="[\d.]+" fill="#FF4438"[^>]*text-anchor="middle"><tspan x="34" dy="0">Cache<\/tspan><\/text>/);
  });

  it('draws the dashed box and names an icon no set holds', () => {
    const svg = svgOf([icon({ icon: 'line/not-an-icon' })]);
    expect(svg).toContain('stroke-dasharray="4 4"');
    expect(svg).toContain('Missing icon: line/not-an-icon');
  });

  it("takes in the label when sizing the document", () => {
    const svg = svgOf([icon({ label: 'Orders database', measuredWidth: 120, measuredHeight: 19 })]);
    expect(svg).toContain('viewBox="-42 4 152 105"');
  });
});
