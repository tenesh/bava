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

/** A box for a walk that places its own, its id and label the same; where it is given, not moved clear of the rail. */
export const box = (id: string, x: number, y: number, extra: Record<string, unknown> = {}) => ({
  id,
  type: 'rect',
  x,
  y,
  w: 120,
  h: 80,
  z: Number(id.replace(/\D/g, '') || 1),
  label: id,
  ...extra,
});

/** Every scene by name, for the walks to go through. */
export const SCENES = { shapes, colours, styles, arrows, heads, containers, turned, diagram, many } as const;

// ---- every element in every state ------------------------------------------------

/**
 * Every kind of element the canvas draws, by the name its pictures carry, and
 * the element type it is (`src/canvas/scene.ts`). A line and an arrow come in
 * the forms that draw differently.
 */
export const ELEMENT_KINDS = {
  rect: 'rect',
  ellipse: 'ellipse',
  diamond: 'diamond',
  cylinder: 'cylinder',
  hexagon: 'hexagon',
  parallelogram: 'parallelogram',
  document: 'document',
  person: 'person',
  cloud: 'cloud',
  'line-open': 'line',
  'line-bent': 'line',
  'line-round': 'line',
  'line-closed': 'line',
  'arrow-straight': 'arrow',
  'arrow-arc': 'arrow',
  'arrow-elbow': 'arrow',
  stroke: 'stroke',
  text: 'text',
  code: 'code',
  'code-plain': 'code',
  frame: 'frame',
  group: 'group',
} as const;

export type Kind = keyof typeof ELEMENT_KINDS;

/** The kinds pictured together, a row of five at most to a line. */
export const FAMILIES = {
  shapes: ['rect', 'ellipse', 'diamond', 'cylinder', 'hexagon', 'parallelogram', 'document', 'person', 'cloud'],
  lines: ['line-open', 'line-bent', 'line-round', 'line-closed'],
  arrows: ['arrow-straight', 'arrow-arc', 'arrow-elbow'],
  others: ['stroke', 'text', 'code', 'code-plain', 'frame', 'group'],
} as const satisfies Record<string, readonly Kind[]>;

export type Family = keyof typeof FAMILIES;

/** The family a kind is pictured with. */
export const familyOf = (kind: Kind): Family =>
  (Object.keys(FAMILIES) as Family[]).find((family) => (FAMILIES[family] as readonly Kind[]).includes(kind))!;

/**
 * The states every element is pictured in: at rest; selected; with a handle
 * hovered; locked; turned; with a label too long for it; its text being
 * edited; with an end bound to an element that is gone; under the eraser.
 */
export const ELEMENT_STATES = ['rest', 'selected', 'handle', 'locked', 'turned', 'long', 'editing', 'detached', 'erasing'] as const;

export type ElementState = (typeof ELEMENT_STATES)[number];

const NOT_AN_ARROW = 'only an arrow binds to another element';

/**
 * What a state leaves out, by kind or by element type, each with why it
 * cannot be shown. Everything else is pictured in it.
 */
export const LEFT_OUT: Record<ElementState, Record<string, string>> = {
  rest: {},
  selected: {},
  handle: {},
  locked: {},
  turned: { 'arrow-elbow': 'an elbow arrow cannot turn: its segments stay level and upright' },
  long: {
    line: 'a line carries no label',
    stroke: 'a stroke carries no label',
    group: 'a group draws no label of its own',
  },
  editing: {
    line: 'a double-click on a line edits its points, pictured in canvas-states',
    stroke: 'a stroke has no text to edit',
    group: 'a double-click on a group types into the shape under the pointer, pictured as that shape',
  },
  detached: Object.fromEntries(
    [...new Set(Object.values(ELEMENT_KINDS))].filter((type) => type !== 'arrow').map((type) => [type, NOT_AN_ARROW]),
  ),
  erasing: {},
};

/** The kinds pictured again at about 200% (four steps in), where a handle or an edited label shows its detail. */
export const AT_200 = {
  handle: ['rect', 'line-open', 'arrow-straight', 'arrow-arc', 'arrow-elbow'],
  editing: ['rect', 'arrow-straight', 'text', 'code', 'frame'],
} as const satisfies Partial<Record<ElementState, readonly Kind[]>>;

/** The kinds a state pictures, in family order. */
export const pictured = (state: ElementState, among: readonly Kind[] = Object.keys(ELEMENT_KINDS) as Kind[]): Kind[] =>
  among.filter((kind) => !(kind in LEFT_OUT[state]) && !(ELEMENT_KINDS[kind] in LEFT_OUT[state]));

export type Point = { x: number; y: number };
export type Box = { x: number; y: number; w: number; h: number };

/**
 * One kind's place in a scene of kinds: the part of the canvas pictured for
 * it, a point on it that selects it, a handle on it and the cursor that
 * handle shows, and a point a double-click there edits it at. In scene units.
 */
export type Cell = { box: Box; click: Point; handle: Point; cursor: string; edit: Point };

/** How the kinds are set up: all locked, all turned, with long labels, or bound to an element that is gone. */
export type Variant = { locked?: boolean; turned?: boolean; long?: boolean; detached?: boolean };

const CELL = { w: 180, h: 180 };
const COLUMNS = 5;
/** With long labels, wider cells, fewer to a row: an arrow's label runs past its ends. */
const LONG_CELL = { w: 220, h: 180 };
const LONG_COLUMNS = 4;
/** Room past the last cell for a long label run out of it. */
const LONG_SPILL = 100;
/** The angle the turned kinds are at. */
const TURN = 30;
/** How far a bent line's box stands clear of its points, on screen (`--size-bent-box-padding`). */
const BENT_PADDING = 10;

const LONG = {
  shape: 'A label far too long for its shape, Supercalifragilistic',
  arrow: 'A label far too long for its arrow',
  frame: 'A frame label far too long for its frame',
  text: 'Free text that wraps, Unbreakablewords',
  code: 'const value = computeTheThing(argumentOne, argumentTwo);',
};

/** A point turned clockwise by `degrees` about `centre`, as the canvas turns an element. */
function turnPoint(point: Point, centre: Point, degrees: number): Point {
  const a = (degrees * Math.PI) / 180;
  const dx = point.x - centre.x;
  const dy = point.y - centre.y;
  return { x: centre.x + dx * Math.cos(a) - dy * Math.sin(a), y: centre.y + dx * Math.sin(a) + dy * Math.cos(a) };
}

const centreOf = (e: { x: number; y: number; w: number; h: number }): Point => ({ x: e.x + e.w / 2, y: e.y + e.h / 2 });

/** An element turned about `centre`: its box moved round it, and its angle. */
function turnedAbout(e: El, centre: Point): El {
  const own = turnPoint(centreOf(e), centre, TURN);
  return { ...e, x: own.x - e.w / 2, y: own.y - e.h / 2, angle: TURN };
}

/** An element with the next z, where it is given. */
const put = (props: Omit<El, 'z'>): El => ({ ...props, z: (z += 1) }) as El;

/**
 * One kind, its body's top-left at `b` (a cell's room for its handles
 * around it): its elements, and its cell's points relative to nothing turned.
 */
function kindAt(kind: Kind, b: Point, v: Variant): { elements: El[]; click: Point; handle: Point; cursor: string; edit: Point } {
  const p = (dx: number, dy: number) => ({ x: b.x + dx, y: b.y + dy });
  const resize = { handle: p(120, 80), cursor: 'nwse-resize' };
  const shape = (type: string) => {
    const e = put({ id: kind, type, x: b.x, y: b.y, w: 120, h: 80, label: v.long ? LONG.shape : 'Label' });
    return { elements: [e], click: p(60, 40), edit: p(60, 40), ...resize };
  };
  const arrow = (extra: Record<string, unknown>, h: number, points: number[]) =>
    put({ id: kind, type: 'arrow', x: b.x, y: b.y + (h === 0 ? 40 : 0), w: 120, h, points, label: v.long ? LONG.arrow : 'Label', ...(v.detached ? { startBinding: 'gone' } : {}), ...extra });
  switch (kind) {
    case 'line-open':
      return { elements: [put({ id: kind, type: 'line', x: b.x, y: b.y, w: 120, h: 80, points: [0, 80, 120, 0] })], click: p(60, 40), handle: p(120, 0), cursor: 'pointer', edit: p(60, 40) };
    case 'line-bent':
    case 'line-round': {
      const e = put({ id: kind, type: 'line', x: b.x, y: b.y, w: 120, h: 80, points: [0, 80, 40, 0, 80, 80, 120, 0], ...(kind === 'line-round' ? { edges: 'round' } : {}) });
      return { elements: [e], click: p(40, 0), handle: p(120 + BENT_PADDING, 80 + BENT_PADDING), cursor: 'nwse-resize', edit: p(40, 0) };
    }
    case 'line-closed': {
      const e = put({ id: kind, type: 'line', x: b.x, y: b.y, w: 120, h: 80, points: [0, 80, 60, 0, 120, 80, 0, 80], closed: true, fill: 'green', stroke: 'green' });
      return { elements: [e], click: p(60, 0), handle: p(120 + BENT_PADDING, 80 + BENT_PADDING), cursor: 'nwse-resize', edit: p(60, 0) };
    }
    case 'arrow-straight':
      return { elements: [arrow({}, 0, [0, 0, 120, 0])], click: p(25, 40), handle: p(120, 40), cursor: 'pointer', edit: p(25, 40) };
    case 'arrow-arc':
      // Curved through its three points; the click on its rising side.
      return { elements: [arrow({ arrowType: 'arc' }, 80, [0, 80, 60, 0, 120, 80])], click: p(20, 53), handle: p(120, 80), cursor: 'pointer', edit: p(20, 53) };
    case 'arrow-elbow':
      // Along, then down, as the canvas routes it; the handle on the first
      // segment's middle, clear of the label halfway along the whole path.
      return { elements: [arrow({ arrowType: 'elbow' }, 80, [0, 0, 120, 0, 120, 80])], click: p(120, 50), handle: p(60, 0), cursor: 'pointer', edit: p(120, 50) };
    case 'stroke': {
      const e = put({ id: kind, type: 'stroke', x: b.x, y: b.y, w: 120, h: 80, points: [0, 40, 20, 15, 40, 55, 60, 20, 80, 60, 100, 25, 120, 45] });
      return { elements: [e], click: p(40, 55), edit: p(40, 55), ...resize };
    }
    case 'text': {
      const [w, h] = v.long ? [120, 84] : [86, 28];
      const e = put({ id: kind, type: 'text', x: b.x + (120 - w) / 2, y: b.y + (80 - h) / 2, w, h, text: v.long ? LONG.text : 'Free text', measuredWidth: w, measuredHeight: h });
      const corner = { x: e.x + w, y: e.y + h };
      return { elements: [e], click: p(60, 40), handle: corner, cursor: 'nwse-resize', edit: p(60, 40) };
    }
    case 'code':
    case 'code-plain': {
      const code = v.long ? LONG.code : kind === 'code' ? 'fmt.Println("hi")' : 'plain text';
      const e = put({ id: kind, type: 'code', x: b.x - 15, y: b.y + 10, w: 150, h: v.long ? 90 : 50, code, ...(kind === 'code' ? { language: 'go' } : {}), measuredWidth: 150, measuredHeight: v.long ? 90 : 50 });
      return { elements: [e], click: { x: e.x + 75, y: e.y + 25 }, handle: { x: e.x + e.w, y: e.y + e.h }, cursor: 'nwse-resize', edit: { x: e.x + 75, y: e.y + 25 } };
    }
    case 'frame': {
      const frame = put({ id: kind, type: 'frame', x: b.x - 10, y: b.y - 20, w: 140, h: 120, label: v.long ? LONG.frame : 'Frame' });
      const child = put({ id: `${kind}-child`, type: 'rect', x: b.x + 20, y: b.y + 25, w: 80, h: 50, label: 'Inside', frame: kind });
      return { elements: [frame, child], click: { x: frame.x + 22, y: frame.y + 14 }, handle: { x: frame.x + 140, y: frame.y + 120 }, cursor: 'nwse-resize', edit: { x: frame.x + 10, y: frame.y + 110 } };
    }
    case 'group': {
      const one = put({ id: `${kind}-one`, type: 'ellipse', x: b.x - 5, y: b.y + 10, w: 60, h: 60 });
      const two = put({ id: `${kind}-two`, type: 'diamond', x: b.x + 65, y: b.y + 10, w: 60, h: 60 });
      const group = put({ id: kind, type: 'group', x: b.x - 5, y: b.y + 10, w: 130, h: 60, children: [one.id, two.id] });
      return { elements: [one, two, group], click: p(25, 40), handle: p(125, 70), cursor: 'nwse-resize', edit: p(25, 40) };
    }
    default:
      return shape(kind);
  }
}

/**
 * The kinds given, in rows of five cells (four, wider, with long labels),
 * each cell with room round its element for the selection's handles, its
 * element's middle 90 below the cell's top, set up as `variant` says. Returns
 * the elements, each kind's cell, and the box round them all.
 */
export function elementScene(kinds: readonly Kind[], variant: Variant = {}): { elements: El[]; cells: Partial<Record<Kind, Cell>>; box: Box } {
  const elements: El[] = [];
  const cells: Partial<Record<Kind, Cell>> = {};
  const [cell, columns] = variant.long ? [LONG_CELL, LONG_COLUMNS] : [CELL, COLUMNS];
  kinds.forEach((kind, i) => {
    const box = { x: LEFT + 20 + (i % columns) * cell.w, y: 30 + Math.floor(i / columns) * cell.h, ...cell };
    const made = kindAt(kind, { x: box.x + (cell.w - 120) / 2, y: box.y + 50 }, variant);
    let own = made.elements.map((e) => (variant.locked ? { ...e, locked: true } : e));
    let { click, edit } = made;
    if (variant.turned && !(kind in LEFT_OUT.turned)) {
      // Turned about the element's own centre; a frame's or a group's members with it.
      const whole = own.find((e) => e.id === kind)!;
      const centre = centreOf(whole);
      own = own.map((e) => turnedAbout(e, centre));
      click = turnPoint(click, centre, TURN);
      edit = turnPoint(edit, centre, TURN);
    }
    elements.push(...own);
    cells[kind] = { box, click, edit, handle: made.handle, cursor: made.cursor };
  });
  const rows = Math.ceil(kinds.length / columns);
  const across = Math.min(kinds.length, columns) * cell.w + (variant.long ? LONG_SPILL : 0);
  return { elements, cells, box: { x: LEFT + 20, y: 30, w: across, h: rows * cell.h } };
}
