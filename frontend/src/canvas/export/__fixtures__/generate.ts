/**
 * Regenerates `scene.svg`, the committed picture of every element type.
 *
 * Run with `BAVA_WRITE_FIXTURE=1 npx vite-node
 * src/canvas/export/__fixtures__/generate.ts` from `frontend/`, then **look at
 * the result** before committing it: a fixture
 * nobody looked at asserts nothing (`.ai/rules/testing.md`). On macOS,
 * `qlmanage -t -s 900 -o /tmp scene.svg` renders it to a PNG.
 */
import { writeFileSync } from 'node:fs';
import { toSvg } from '../svg';
import { exportArea } from '../area';
import type { SceneData } from '../../scene';

const light: Record<string, string> = {
  '--color-shape-fill': '#ffffff', '--color-shape-stroke': '#1f2933', '--color-shape-text': '#1f2933',
  '--color-canvas-bg': '#fbfbfa', '--swatch-blue-fill': '#d0ebff', '--swatch-blue-stroke': '#1971c2',
  '--swatch-blue-text': '#1864ab', '--swatch-red-fill': '#ffe3e3', '--swatch-red-stroke': '#e03131',
  '--swatch-red-text': '#c92a2a', '--size-shape-stroke': '1.5px', '--size-pen-stroke': '2px',
  '--size-dash': '6px', '--size-dot': '2px', '--size-arrowhead': '10px', '--radius-shape-round': '32px',
  '--size-label-inset': '8px', '--color-code-surface': '#f7f7f5', '--size-code-padding': '8px',
  '--radius-md': '6px', '--font-mono': 'Geist Mono', '--text-code': '13px', '--leading-code': '1.5',
  '--syntax-keyword': '#8250df', '--syntax-string': '#0a7a4a', '--syntax-name': '#1f2933',
  '--syntax-punctuation': '#6b7280', '--syntax-plain': '#1f2933', '--syntax-type': '#1264a3',
  '--syntax-operator': '#4b5563', '--syntax-comment': '#6b7280', '--syntax-number': '#b3541e', '--font-ui': "'Geist', system-ui, sans-serif", '--text-body': '16px', '--leading-tight': '1.2',
};
export const fixtureRead = (name: string) => light[name] ?? '';

export const fixtureScene: SceneData = { elements: [
  { id: 'r', type: 'rect', x: 0, y: 0, w: 140, h: 70, z: 1, fill: 'blue', stroke: 'blue', label: 'Rounded', edges: 'round' },
  { id: 'e', type: 'ellipse', x: 180, y: 0, w: 120, h: 70, z: 2, fill: 'red', stroke: 'red', label: 'Ellipse' },
  { id: 'd', type: 'diamond', x: 340, y: 0, w: 120, h: 70, z: 3, label: 'Diamond' },
  { id: 'h', type: 'hexagon', x: 0, y: 110, w: 120, h: 70, z: 4, strokeStyle: 'dashed', strokeWidth: 4 },
  { id: 'a1', type: 'arrow', x: 140, y: 120, w: 120, h: 0, z: 5, points: [0, 0, 120, 0] },
  { id: 'a2', type: 'arrow', x: 140, y: 150, w: 120, h: 40, z: 6, points: [0, 0, 120, 40], arrowType: 'elbow', endArrowhead: 'triangle', startArrowhead: 'circle' },
  { id: 'l', type: 'line', x: 300, y: 110, w: 160, h: 70, z: 7, points: [0, 0, 80, 70, 160, 0], strokeStyle: 'dotted' },
  { id: 't', type: 'text', x: 0, y: 210, w: 220, h: 40, z: 8, text: 'Text, two lines\nsecond line', measuredWidth: 220, measuredHeight: 40 },
  { id: 'f', type: 'frame', x: 260, y: 210, w: 200, h: 90, z: 9, label: 'Frame' },
  { id: 'turned', type: 'rect', x: 60, y: 280, w: 120, h: 30, z: 10, angle: 30, label: 'Rotated 30' },
  { id: 'faded', type: 'rect', x: 340, y: 330, w: 120, h: 40, z: 11, opacity: 40, label: 'Faded' },
  // A label too long for its shape: it has to wrap the way the canvas wraps.
  { id: 'wrapped', type: 'rect', x: 0, y: 340, w: 140, h: 80, z: 12, label: 'A label far too long for the box it sits in' },
  // A line with round edges: smoothed, not cornered.
  { id: 'curve', type: 'line', x: 180, y: 340, w: 140, h: 60, z: 13, points: [0, 60, 70, 0, 140, 60], edges: 'round' },
  // A code block: its panel and its coloured runs, drawn as real text.
  { id: 'code', type: 'code', x: 0, y: 500, w: 260, h: 78, z: 15, code: 'func main() {\n\tfmt.Println("hi")\n}', measuredWidth: 260, measuredHeight: 78 },
  // Text in a box with slack, so vertical alignment shows.
  { id: 'tall', type: 'text', x: 180, y: 420, w: 220, h: 80, z: 14, text: 'Top of a tall box', measuredWidth: 220, measuredHeight: 20 },
] as never[] };

/**
 * The code block's runs, as `canvas/code/runs.ts` would produce them. Written
 * out rather than parsed, so the fixture stays synchronous.
 */
/** Geist Mono's advance at `--text-code`, measured in a browser. */
export const MONO_ADVANCE = 7.8;

export const fixtureCodeRuns = {
  code: [
    [
      { text: 'func', kind: 'keyword' as const },
      { text: ' ', kind: 'plain' as const },
      { text: 'main', kind: 'name' as const },
      { text: '() {', kind: 'punctuation' as const },
    ],
    [
      { text: '    fmt', kind: 'name' as const },
      { text: '.', kind: 'punctuation' as const },
      { text: 'Println', kind: 'name' as const },
      { text: '(', kind: 'punctuation' as const },
      { text: '"hi"', kind: 'string' as const },
      { text: ')', kind: 'punctuation' as const },
    ],
    [{ text: '}', kind: 'punctuation' as const }],
  ],
};

/** Writes the fixture. Called by the script below, never on import. */
export function main(): void {
  writeFileSync(
    new URL('./scene.svg', import.meta.url),
    toSvg(exportArea(fixtureScene, []), {
      read: fixtureRead,
      background: true,
      codeRuns: fixtureCodeRuns,
      // Geist Mono's real advance at 13px, so the fixture is what a browser
      // would draw rather than what node estimates.
      monoAdvance: MONO_ADVANCE,
    }) + '\n',
  );
}

// Writing is asked for explicitly, never inferred from how this was loaded:
// `svg.test.ts` imports the scene, and a runner whose argv happened to match
// would have the suite rewrite its own expected output.
if (process.env.BAVA_WRITE_FIXTURE) main();
