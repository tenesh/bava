/**
 * Canvases for the screen checks: each small enough to read in one picture,
 * together covering what a canvas can hold (docs/file-format.md, "The
 * canvas"). Put into a page of the pretend Space before it opens
 * (`seedScene`), so the Files tree never changes.
 */

type El = Record<string, unknown> & { id: string; type: string; x: number; y: number; w: number; h: number; z: number };

/** Clear of the tool rail, which covers the canvas's left edge. */
const LEFT = 60;

let z = 0;
/** An element with the next z, so each scene draws in the order it lists, clear of the rail. */
const el = (props: Omit<El, 'z'>): El => ({ ...props, x: (props.x as number) + LEFT, z: (z += 1) }) as El;

const SHAPES = ['rect', 'ellipse', 'diamond', 'cylinder', 'hexagon', 'parallelogram', 'document', 'person', 'cloud'] as const;
const SWATCHES = ['gray', 'blue', 'green', 'yellow', 'orange', 'red', 'purple', 'pink'] as const;
const HEADS = [
  'none', 'arrow', 'bar', 'triangle', 'triangle-outline', 'circle', 'circle-outline', 'diamond', 'diamond-outline',
  'one', 'many', 'oneOrMany', 'exactlyOne', 'zeroOrOne', 'zeroOrMany',
] as const;

/** Every shape, labelled, in a grid of three. */
export function shapes(): El[] {
  return SHAPES.map((type, i) =>
    el({ id: `s-${type}`, type, x: 40 + (i % 3) * 200, y: 40 + Math.floor(i / 3) * 140, w: 150, h: 96, label: type }),
  );
}

/** Every swatch as a fill and as a border, a literal colour, and coloured labels. */
export function colours(): El[] {
  const out: El[] = [];
  SWATCHES.forEach((name, i) => {
    out.push(el({ id: `fill-${name}`, type: 'rect', x: 40 + i * 100, y: 40, w: 84, h: 56, fill: name, label: name }));
    out.push(el({ id: `stroke-${name}`, type: 'ellipse', x: 40 + i * 100, y: 130, w: 84, h: 56, stroke: name, color: name, label: name }));
  });
  out.push(el({ id: 'literal', type: 'rect', x: 40, y: 230, w: 200, h: 80, fill: '#f6d8b8', stroke: '#c0392b', color: '#1f4e79', label: 'literal colours' }));
  out.push(el({ id: 'literal-dark', type: 'hexagon', x: 280, y: 230, w: 200, h: 80, fill: '#1f3a5f', color: '#ffffff', label: 'deep fill' }));
  return out;
}

/** Stroke widths and styles, edges, opacity, font sizes and the two alignments. */
export function styles(): El[] {
  const out: El[] = [];
  [1, 2, 4].forEach((width, i) => out.push(el({ id: `w${width}`, type: 'rect', x: 40 + i * 120, y: 40, w: 100, h: 60, strokeWidth: width, label: `width ${width}` })));
  ['solid', 'dashed', 'dotted'].forEach((style, i) =>
    out.push(el({ id: `st-${style}`, type: 'rect', x: 420 + i * 120, y: 40, w: 100, h: 60, strokeStyle: style, label: style })),
  );
  ['sharp', 'round'].forEach((edges, i) => {
    out.push(el({ id: `e-rect-${edges}`, type: 'rect', x: 40 + i * 120, y: 130, w: 100, h: 60, edges, label: edges }));
    out.push(el({ id: `e-diamond-${edges}`, type: 'diamond', x: 280 + i * 120, y: 130, w: 100, h: 60, edges }));
  });
  [100, 60, 30].forEach((opacity, i) => out.push(el({ id: `op-${opacity}`, type: 'rect', x: 520 + i * 90, y: 130, w: 80, h: 60, fill: 'blue', opacity, label: `${opacity}%` })));
  [16, 20, 28, 36].forEach((fontSize, i) =>
    out.push(el({ id: `fs-${fontSize}`, type: 'text', x: 40 + i * 140, y: 220, w: 130, h: fontSize * 1.4, text: `Size ${fontSize}`, fontSize, measuredWidth: fontSize * 4, measuredHeight: fontSize * 1.4 })),
  );
  ['left', 'center', 'right'].forEach((align, i) =>
    ['top', 'middle', 'bottom'].forEach((verticalAlign, j) =>
      out.push(el({ id: `al-${align}-${verticalAlign}`, type: 'rect', x: 40 + i * 170, y: 290 + j * 80, w: 150, h: 64, align, verticalAlign, label: `${align} ${verticalAlign}` })),
    ),
  );
  // A word wider than its box is drawn whole, overflowing it.
  ['left', 'center', 'right'].forEach((align, i) =>
    out.push(el({ id: `over-${align}`, type: 'rect', x: 700, y: 290 + i * 80, w: 60, h: 64, align, label: 'Overflowing' })),
  );
  out.push(el({ id: 'over-text', type: 'text', x: 700, y: 540, w: 40, h: 28, text: 'Unbreakable', measuredWidth: 40, measuredHeight: 28 }));
  return out;
}

/** Straight, arc and elbow arrows and lines; every head; bound, pinned, free and detached ends; labels. */
export function arrows(): El[] {
  const out: El[] = [];
  const a = el({ id: 'box-a', type: 'rect', x: 40, y: 40, w: 120, h: 70, label: 'A' });
  const b = el({ id: 'box-b', type: 'ellipse', x: 360, y: 40, w: 120, h: 70, label: 'B' });
  const c = el({ id: 'box-c', type: 'rect', x: 360, y: 200, w: 120, h: 70, label: 'C' });
  out.push(a, b, c);
  out.push(el({ id: 'bound', type: 'arrow', x: 160, y: 75, w: 200, h: 0, points: [0, 0, 200, 0], startBinding: 'box-a', endBinding: 'box-b', label: 'bound' }));
  out.push(el({ id: 'arc', type: 'arrow', arrowType: 'arc', x: 100, y: 110, w: 260, h: 125, points: [0, 0, 120, 110, 260, 125], startBinding: 'box-a', endBinding: 'box-c', label: 'along', labelDirection: 'along' }));
  out.push(el({ id: 'pinned', type: 'arrow', x: 420, y: 110, w: 0, h: 90, points: [0, 0, 0, 90], startBinding: 'box-b', endBinding: 'box-c', startAnchor: [0.5, 0.5], startMode: 'inside', endArrowhead: 'triangle' }));
  out.push(el({ id: 'elbow', type: 'arrow', arrowType: 'elbow', x: 160, y: 95, w: 200, h: 140, points: [0, 0, 60, 0, 60, 140, 200, 140], startBinding: 'box-a', endBinding: 'box-c', fixedSegments: [{ index: 2, start: [60, 0], end: [60, 140] }] }));
  out.push(el({ id: 'detached', type: 'arrow', x: 520, y: 75, w: 120, h: 0, points: [0, 0, 120, 0], startBinding: 'gone', label: 'detached' }));
  out.push(el({ id: 'free-line', type: 'line', x: 520, y: 140, w: 150, h: 60, points: [0, 60, 50, 0, 100, 60, 150, 0], strokeStyle: 'dashed' }));
  out.push(el({ id: 'closed', type: 'line', x: 520, y: 220, w: 120, h: 90, points: [0, 0, 120, 20, 80, 90, 0, 0], closed: true, fill: 'green', stroke: 'green' }));
  out.push(el({ id: 'pen', type: 'stroke', x: 40, y: 300, w: 200, h: 40, points: [0, 20, 20, 5, 40, 30, 60, 10, 80, 35, 100, 15, 120, 30, 140, 5, 160, 25, 180, 10, 200, 20] }));
  return out;
}

/** Every head at both ends, on short arrows, solid and dotted. */
export function heads(): El[] {
  return HEADS.flatMap((head, i) => [
    el({ id: `h-${head}`, type: 'arrow', x: 40 + (i % 5) * 150, y: 40 + Math.floor(i / 5) * 80, w: 110, h: 0, points: [0, 0, 110, 0], startArrowhead: head, endArrowhead: head }),
    el({ id: `hd-${head}`, type: 'arrow', x: 40 + (i % 5) * 150, y: 70 + Math.floor(i / 5) * 80, w: 110, h: 0, points: [0, 0, 110, 0], startArrowhead: head, endArrowhead: head, strokeStyle: 'dotted' }),
  ]);
}

/** A frame holding shapes, a group, an arrow crossing the frame, and code blocks. */
export function containers(): El[] {
  const frame = el({ id: 'frame', type: 'frame', x: 40, y: 40, w: 340, h: 220, label: 'Write path', stroke: 'blue' });
  const inA = el({ id: 'in-a', type: 'rect', x: 70, y: 90, w: 110, h: 60, label: 'Editor', frame: 'frame' });
  const inB = el({ id: 'in-b', type: 'cylinder', x: 240, y: 150, w: 110, h: 80, label: 'Disk', frame: 'frame' });
  const g1 = el({ id: 'g-1', type: 'ellipse', x: 440, y: 60, w: 90, h: 60, label: 'one' });
  const g2 = el({ id: 'g-2', type: 'diamond', x: 560, y: 60, w: 90, h: 60, label: 'two' });
  const group = el({ id: 'group', type: 'group', x: 440, y: 60, w: 210, h: 60, children: ['g-1', 'g-2'] });
  const across = el({ id: 'across', type: 'arrow', x: 180, y: 120, w: 260, h: 0, points: [0, 0, 260, -30], startBinding: 'in-a', endBinding: 'g-1' });
  const code = [
    el({ id: 'code-go', type: 'code', x: 440, y: 170, w: 260, h: 90, code: 'func main() {\n\tfmt.Println("hi")\n}', language: 'go', measuredWidth: 220, measuredHeight: 80 }),
    el({ id: 'code-plain', type: 'code', x: 40, y: 300, w: 300, h: 70, code: 'plain text, no language\nand a second line', measuredWidth: 280, measuredHeight: 60 }),
    el({ id: 'code-long', type: 'code', x: 380, y: 300, w: 320, h: 80, code: 'const aVeryLongNameThatRunsOnAndOn = computeTheThingFromAnotherThing(argumentOne, argumentTwo);', language: 'typescript', fontSize: 11, measuredWidth: 300, measuredHeight: 70 }),
  ];
  return [frame, inA, inB, g1, g2, group, across, ...code];
}

/** Rotated and locked elements of each kind. */
export function turned(): El[] {
  return [
    el({ id: 'r-rect', type: 'rect', x: 60, y: 60, w: 140, h: 80, angle: 30, label: 'rotated 30°' }),
    el({ id: 'r-ellipse', type: 'ellipse', x: 260, y: 60, w: 140, h: 80, angle: 300, label: 'rotated 300°' }),
    el({ id: 'r-text', type: 'text', x: 460, y: 80, w: 150, h: 30, angle: 15, text: 'Turned text', measuredWidth: 110, measuredHeight: 28 }),
    el({ id: 'r-code', type: 'code', x: 60, y: 220, w: 220, h: 70, angle: 350, code: 'let x = 1', language: 'javascript', measuredWidth: 120, measuredHeight: 40 }),
    el({ id: 'l-rect', type: 'rect', x: 340, y: 220, w: 140, h: 80, locked: true, label: 'locked' }),
    el({ id: 'l-turned', type: 'diamond', x: 520, y: 220, w: 120, h: 90, locked: true, angle: 45, label: 'both' }),
  ];
}

/** The shapes Diagram from Code makes of `api -> db; api -> cache`: boxes and bound arrows. */
export function diagram(): El[] {
  return [
    el({ id: 'd-api', type: 'rect', x: 240, y: 40, w: 140, h: 66, label: 'api' }),
    el({ id: 'd-db', type: 'cylinder', x: 120, y: 200, w: 140, h: 90, label: 'db' }),
    el({ id: 'd-cache', type: 'rect', x: 380, y: 200, w: 140, h: 66, label: 'cache', fill: 'yellow' }),
    el({ id: 'd-e1', type: 'arrow', x: 280, y: 106, w: 90, h: 94, points: [0, 0, -90, 94], startBinding: 'd-api', endBinding: 'd-db' }),
    el({ id: 'd-e2', type: 'arrow', x: 340, y: 106, w: 110, h: 94, points: [0, 0, 110, 94], startBinding: 'd-api', endBinding: 'd-cache' }),
  ];
}

/** A few hundred shapes and arrows, to see a busy canvas drawn at zoom. */
export function many(): El[] {
  const out: El[] = [];
  // Shapes 36 apart, so each arrow clears the gap it keeps at both ends.
  for (let i = 0; i < 240; i += 1) {
    const x = 20 + (i % 16) * 72;
    const y = 20 + Math.floor(i / 16) * 50;
    out.push(el({ id: `m-${i}`, type: SHAPES[i % SHAPES.length], x, y, w: 36, h: 32, fill: SWATCHES[i % SWATCHES.length] }));
    if (i % 16 !== 15) out.push(el({ id: `ma-${i}`, type: 'arrow', x: x + 36, y: y + 16, w: 36, h: 0, points: [0, 0, 36, 0], startBinding: `m-${i}`, endBinding: `m-${i + 1}` }));
  }
  return out;
}

/**
 * One of each kind a selection draws differently, spaced apart: a shape, a
 * straight arrow, a bent line, an elbow, a code block, a frame holding a
 * shape, and a group. `click` is a point on each, in scene units.
 */
export function kinds(): { elements: El[]; click: Record<string, { x: number; y: number }> } {
  const elements = [
    el({ id: 'k-shape', type: 'rect', x: 40, y: 60, w: 140, h: 80, label: 'Box' }),
    el({ id: 'k-arrow', type: 'arrow', x: 240, y: 100, w: 160, h: 0, points: [0, 0, 160, 0] }),
    el({ id: 'k-bent', type: 'line', x: 460, y: 60, w: 120, h: 80, points: [0, 80, 60, 0, 120, 80] }),
    el({ id: 'k-elbow', type: 'arrow', arrowType: 'elbow', x: 640, y: 60, w: 120, h: 80, points: [0, 0, 60, 0, 60, 80, 120, 80] }),
    el({ id: 'k-code', type: 'code', x: 40, y: 220, w: 220, h: 80, code: 'print("hi")', language: 'python', measuredWidth: 120, measuredHeight: 40 }),
    el({ id: 'k-frame', type: 'frame', x: 320, y: 200, w: 220, h: 160, label: 'Frame' }),
    el({ id: 'k-child', type: 'rect', x: 360, y: 250, w: 100, h: 60, label: 'Inside', frame: 'k-frame' }),
    el({ id: 'k-g1', type: 'ellipse', x: 600, y: 220, w: 80, h: 60 }),
    el({ id: 'k-g2', type: 'diamond', x: 700, y: 220, w: 80, h: 60 }),
    el({ id: 'k-group', type: 'group', x: 600, y: 220, w: 180, h: 60, children: ['k-g1', 'k-g2'] }),
  ];
  const at = (id: string, dx: number, dy: number) => {
    const found = elements.find((e) => e.id === id)!;
    return { x: found.x + dx, y: found.y + dy };
  };
  return {
    elements,
    click: {
      shape: at('k-shape', 70, 40),
      arrow: at('k-arrow', 80, 0),
      bent: at('k-bent', 30, 40),
      elbow: at('k-elbow', 30, 0),
      code: at('k-code', 110, 40),
      frame: at('k-frame', 30, 14),
      group: at('k-g1', 40, 30),
    },
  };
}

/** Three boxes in a row, the last a little out of line, to drag into it. */
export function row(): El[] {
  return [
    el({ id: 'r-1', type: 'rect', x: 40, y: 100, w: 120, h: 80, label: 'One' }),
    el({ id: 'r-2', type: 'rect', x: 240, y: 100, w: 120, h: 80, label: 'Two' }),
    el({ id: 'r-3', type: 'rect', x: 460, y: 160, w: 120, h: 80, label: 'Three' }),
  ];
}

/** Every scene by name, for the walks to go through. */
export const SCENES = { shapes, colours, styles, arrows, heads, containers, turned, diagram, many } as const;
