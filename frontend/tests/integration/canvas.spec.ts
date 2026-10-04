import { expect, test } from '@playwright/test';
import { FAMILIES, SCENES, box, elementScene, kinds, pictured } from '../fixtures/canvas-scenes';
import {
  CANVAS_PAGE,
  angleOf,
  byId,
  clickScene,
  dragScene,
  ends,
  eraseAcross,
  exportAs,
  luminance,
  menu,
  menus,
  ofType,
  onScreen,
  openCanvas,
  openDialog,
  pick,
  placed,
  pngFacts,
  popovers,
  pointsOf,
  reopened,
  saved,
  selectTool,
  selectionToolbar,
  startCanvas,
  zoomSteps,
  type Point,
  type Saved,
} from '../helpers';

// What the canvas does, checked on the file it saves: each test acts as a
// person would, saves, and reads the scene back.

test.describe('drawing', () => {
  test('each rail tool draws its kind', async ({ page }) => {
    await startCanvas(page);
    const tools: [string, Point][] = [
      ['r', { x: 100, y: 60 }],
      ['o', { x: 300, y: 60 }],
      ['a', { x: 500, y: 60 }],
      ['l', { x: 700, y: 60 }],
      ['d', { x: 100, y: 260 }],
      ['f', { x: 300, y: 260 }],
    ];
    for (const [key, from] of tools) {
      await page.keyboard.press(key);
      await dragScene(page, from, { x: from.x + 140, y: from.y + 90 });
      await page.keyboard.press('Escape');
    }
    const types = (await saved(page)).map((element) => element.type).sort();
    expect(types).toEqual(['arrow', 'ellipse', 'frame', 'line', 'rect', 'stroke']);
  });

  test('a drawn shape ends selected, with the select tool on', async ({ page }) => {
    await startCanvas(page);
    await page.keyboard.press('r');
    await dragScene(page, { x: 100, y: 100 }, { x: 260, y: 200 });
    await expect(selectTool(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(selectionToolbar(page)).toBeVisible();
  });

  test('Shift draws a square and a 45° line', async ({ page }) => {
    await startCanvas(page);
    await page.keyboard.press('r');
    await dragScene(page, { x: 100, y: 100 }, { x: 260, y: 170 }, { modifiers: ['Shift'] });
    await page.keyboard.press('l');
    // Lines turn in 15° steps with Shift; a drag near the diagonal is 45°.
    await dragScene(page, { x: 400, y: 100 }, { x: 560, y: 252 }, { modifiers: ['Shift'] });
    const elements = await saved(page);
    const square = ofType(elements, 'rect')[0];
    expect(square.w).toBe(square.h);
    const line = ofType(elements, 'line')[0] as Saved & { points: number[] };
    const [x0, y0, x1, y1] = line.points;
    const angle = (Math.atan2(y1 - y0, x1 - x0) * 180) / Math.PI;
    expect(Math.round(angle)).toBe(45);
  });

  test('Shift pressed mid-drag squares the shape; released mid-drag frees it', async ({ page }) => {
    await startCanvas(page);
    await page.keyboard.press('r');
    let a = await onScreen(page, { x: 100, y: 100 });
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(a.x + 160, a.y + 70, { steps: 4 });
    await page.keyboard.down('Shift');
    await page.mouse.move(a.x + 160, a.y + 71, { steps: 2 });
    await page.mouse.up();
    await page.keyboard.up('Shift');

    await page.keyboard.press('r');
    a = await onScreen(page, { x: 400, y: 100 });
    await page.keyboard.down('Shift');
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(a.x + 160, a.y + 70, { steps: 4 });
    await page.keyboard.up('Shift');
    await page.mouse.move(a.x + 160, a.y + 71, { steps: 2 });
    await page.mouse.up();

    const [pressed, released] = ofType(await saved(page), 'rect').sort((p, q) => p.x - q.x);
    expect(pressed.w).toBe(pressed.h);
    expect(released.w).not.toBe(released.h);
  });

  test('the pen draws twice in a row', async ({ page }) => {
    await startCanvas(page);
    await page.keyboard.press('d');
    await dragScene(page, { x: 100, y: 100 }, { x: 260, y: 160 });
    await page.keyboard.press('d');
    await dragScene(page, { x: 100, y: 260 }, { x: 260, y: 320 });
    expect(ofType(await saved(page), 'stroke')).toHaveLength(2);
  });

  test('Q keeps the tool on: two drawings, nothing selected', async ({ page }) => {
    await startCanvas(page);
    await page.keyboard.press('r');
    await page.keyboard.press('q');
    await dragScene(page, { x: 100, y: 100 }, { x: 220, y: 180 });
    await dragScene(page, { x: 300, y: 100 }, { x: 420, y: 180 });
    await expect(selectionToolbar(page)).toHaveCount(0);
    expect(ofType(await saved(page), 'rect')).toHaveLength(2);
  });

  test('a line drawn by clicks, closed on its first point', async ({ page }) => {
    await startCanvas(page);
    await page.keyboard.press('l');
    for (const point of [
      { x: 100, y: 100 },
      { x: 260, y: 100 },
      { x: 180, y: 220 },
      { x: 100, y: 100 },
    ]) {
      await clickScene(page, point);
    }
    const line = ofType(await saved(page), 'line')[0] as Saved & { closed?: boolean; points: number[] };
    expect(line.closed).toBe(true);
    expect(line.points.slice(-2)).toEqual(line.points.slice(0, 2));
  });

  test('a picked colour carries to the next drawing', async ({ page }) => {
    await startCanvas(page);
    await page.keyboard.press('r');
    await dragScene(page, { x: 100, y: 100 }, { x: 220, y: 180 });
    await pick(page, 'Border colour', 'red');
    await page.keyboard.press('r');
    await dragScene(page, { x: 300, y: 100 }, { x: 420, y: 180 });
    const rects = ofType(await saved(page), 'rect');
    expect(rects.map((rect) => rect.stroke)).toEqual(['red', 'red']);
  });
});

test.describe('selecting and moving', () => {
  const three = () => [box('b1', 100, 100), box('b2', 300, 100), box('b3', 500, 100)];

  test('Shift-click takes a shape out of the selection', async ({ page }) => {
    await startCanvas(page, three());
    await menu(page, 'edit.selectAll');
    await clickScene(page, { x: 160, y: 140 }, { modifiers: ['Shift'] });
    await page.keyboard.press('ArrowRight');
    const elements = await saved(page);
    expect(byId(elements, 'b1').x).toBe(100);
    expect(byId(elements, 'b2').x).toBe(301);
    expect(byId(elements, 'b3').x).toBe(501);
  });

  test('dragging empty space inside a selection of two moves both', async ({ page }) => {
    await startCanvas(page, [box('b1', 100, 100), box('b2', 300, 100)]);
    await menu(page, 'edit.selectAll');
    // Between the two boxes, inside the selection's outline.
    await dragScene(page, { x: 260, y: 140 }, { x: 260, y: 240 });
    const elements = await saved(page);
    expect([byId(elements, 'b1').y, byId(elements, 'b2').y]).toEqual([200, 200]);
  });

  test('Shift-drag moves on one axis; Shift+arrow moves 5', async ({ page }) => {
    await startCanvas(page, [box('b1', 100, 100)]);
    await dragScene(page, { x: 160, y: 140 }, { x: 300, y: 160 }, { modifiers: ['Shift'] });
    let shape = byId(await saved(page), 'b1');
    expect(shape.y).toBe(100);
    expect(shape.x).toBeGreaterThan(200);
    const x = shape.x;
    await page.keyboard.press('Shift+ArrowDown');
    shape = byId(await saved(page), 'b1');
    expect([shape.x, shape.y]).toEqual([x, 105]);
  });

  test('Alt-drag moves a copy and leaves the original', async ({ page }) => {
    await startCanvas(page, [box('b1', 100, 100)]);
    await dragScene(page, { x: 160, y: 140 }, { x: 460, y: 140 }, { modifiers: ['Alt'] });
    const rects = ofType(await saved(page), 'rect').sort((p, q) => p.x - q.x);
    expect(rects).toHaveLength(2);
    expect(rects[0]).toMatchObject({ id: 'b1', x: 100, y: 100 });
    expect(rects[1].x).toBe(400);
  });

  test('a twitch on a shape at 25% moves nothing', async ({ page }) => {
    await startCanvas(page, [box('b1', 100, 100)]);
    const zoom = await zoomSteps(page, -8);
    const at = await onScreen(page, { x: 160, y: 140 }, zoom);
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
    await page.mouse.move(at.x + 2, at.y + 1, { steps: 2 });
    await page.mouse.up();
    const shape = byId(await saved(page), 'b1');
    expect([shape.x, shape.y]).toEqual([100, 100]);
  });
});

test.describe('arranging', () => {
  test('align and distribute three', async ({ page }) => {
    await startCanvas(page, [box('b1', 100, 100), box('b2', 260, 160), box('b3', 600, 130)]);
    await menu(page, 'edit.selectAll');
    await menu(page, 'canvas.alignTop');
    await menu(page, 'canvas.distributeHorizontal');
    const elements = await saved(page);
    expect(elements.map((element) => element.y)).toEqual([100, 100, 100]);
    const xs = elements.map((element) => element.x).sort((p, q) => p - q);
    expect(xs[1] - xs[0]).toBe(xs[2] - xs[1]);
  });

  test('duplicate, flip and reorder', async ({ page }) => {
    await startCanvas(page, [box('b1', 100, 100), box('b2', 140, 120)]);
    await clickScene(page, { x: 120, y: 110 });
    await menu(page, 'canvas.duplicate');
    let elements = await saved(page);
    expect(ofType(elements, 'rect')).toHaveLength(3);
    await clickScene(page, { x: 120, y: 110 });
    await menu(page, 'canvas.bringToFront');
    elements = await saved(page);
    const top = elements.reduce((p, q) => ((p.z as number) > (q.z as number) ? p : q));
    expect(top.id).toBe('b1');
  });

  test('flip a line', async ({ page }) => {
    await startCanvas(page, [{ id: 'l1', type: 'line', x: 100, y: 100, w: 160, h: 80, z: 1, points: [0, 0, 160, 80] }]);
    await clickScene(page, { x: 180, y: 140 });
    await menu(page, 'canvas.flipHorizontal');
    const line = byId(await saved(page), 'l1') as Saved & { points: number[] };
    expect(line.points).toEqual([160, 0, 0, 80]);
  });

  test('group and ungroup', async ({ page }) => {
    await startCanvas(page, [box('b1', 100, 100), box('b2', 300, 100)]);
    await menu(page, 'edit.selectAll');
    await menu(page, 'canvas.group');
    let groups = ofType(await saved(page), 'group') as (Saved & { children: string[] })[];
    expect(groups).toHaveLength(1);
    expect([...groups[0].children].sort()).toEqual(['b1', 'b2']);
    await menu(page, 'canvas.ungroup');
    groups = ofType(await saved(page), 'group') as (Saved & { children: string[] })[];
    expect(groups).toHaveLength(0);
  });

  test('copy a style and paste it onto another shape', async ({ page }) => {
    await startCanvas(page, [box('b1', 100, 100, { fill: 'green', strokeStyle: 'dashed' }), box('b2', 300, 100)]);
    await clickScene(page, { x: 160, y: 140 });
    await menu(page, 'canvas.copyStyles');
    await clickScene(page, { x: 360, y: 140 });
    await menu(page, 'canvas.pasteStyles');
    expect(byId(await saved(page), 'b2')).toMatchObject({ fill: 'green', strokeStyle: 'dashed' });
  });

  test('erase two shapes, then undo', async ({ page }) => {
    await startCanvas(page, [box('b1', 100, 100), box('b2', 300, 100), box('b3', 500, 100)]);
    await page.keyboard.press('e');
    await dragScene(page, { x: 60, y: 140 }, { x: 400, y: 140 }, { steps: 16 });
    expect((await saved(page)).map((element) => element.id)).toEqual(['b3']);
    await menu(page, 'edit.undo');
    expect((await saved(page)).map((element) => element.id).sort()).toEqual(['b1', 'b2', 'b3']);
  });

  // The walk `canvas-elements` pictures mid-drag: what the trail faded is
  // what the release deletes, all of it, for every kind.
  for (const [family, members] of Object.entries(FAMILIES)) {
    test(`the eraser across every ${family} kind deletes them all`, async ({ page }) => {
      const scene = elementScene(pictured('erasing', members));
      await openCanvas(page, 'light', CANVAS_PAGE, scene.elements);
      await eraseAcross(page, scene, { x: 900, y: 600 });
      await page.mouse.up();
      const ids = new Set(scene.elements.map((element) => element.id));
      expect((await saved(page)).filter((element) => ids.has(element.id))).toEqual([]);
    });
  }
});

test.describe('styles', () => {
  test('every property set on a shape', async ({ page }) => {
    await startCanvas(page, [box('b1', 100, 100)]);
    await clickScene(page, { x: 160, y: 140 });
    await pick(page, 'Fill colour', 'blue');
    await pick(page, 'Border colour', 'red');
    await pick(page, 'Text colour', 'green');
    await pick(page, 'Stroke width', 'Bold');
    await pick(page, 'Line style', 'Dotted');
    await pick(page, 'Edges', 'Round');
    await pick(page, 'Text size', 'Large');
    await pick(page, 'Alignment', 'Right');
    await pick(page, 'Vertical alignment', 'Top');
    expect(byId(await saved(page), 'b1')).toMatchObject({
      fill: 'blue',
      stroke: 'red',
      color: 'green',
      strokeWidth: 4,
      strokeStyle: 'dotted',
      edges: 'round',
      fontSize: 28,
      align: 'right',
      verticalAlign: 'top',
    });
  });

  test('every property set on an arrow and a line', async ({ page }) => {
    await startCanvas(page, [
      { id: 'a1', type: 'arrow', x: 100, y: 100, w: 200, h: 0, z: 1, points: [0, 0, 200, 0], label: 'calls' },
      { id: 'l1', type: 'line', x: 100, y: 300, w: 200, h: 0, z: 2, points: [0, 0, 200, 0] },
    ]);
    await clickScene(page, { x: 150, y: 100 });
    await pick(page, 'Stroke width', 'Thin');
    await pick(page, 'Line style', 'Dashed');
    await pick(page, 'Start head', 'Circle');
    await pick(page, 'End head', 'Triangle');
    await pick(page, 'Arrow type', 'Arc');
    await pick(page, 'Text size', 'Small');
    await pick(page, 'Label direction', 'Along the arrow');
    await clickScene(page, { x: 150, y: 300 });
    await pick(page, 'Border colour', 'purple');
    await pick(page, 'Line style', 'Dotted');
    const elements = await saved(page);
    expect(byId(elements, 'a1')).toMatchObject({
      strokeWidth: 1,
      strokeStyle: 'dashed',
      startArrowhead: 'circle',
      endArrowhead: 'triangle',
      arrowType: 'arc',
      fontSize: 16,
      labelDirection: 'along',
    });
    expect(byId(elements, 'l1')).toMatchObject({ stroke: 'purple', strokeStyle: 'dotted' });
  });

  test('every property set on text', async ({ page }) => {
    await startCanvas(page, [{ id: 't1', type: 'text', x: 100, y: 100, w: 120, h: 28, z: 1, text: 'Hello', measuredWidth: 50, measuredHeight: 28 }]);
    await clickScene(page, { x: 120, y: 112 });
    await pick(page, 'Text colour', 'orange');
    await pick(page, 'Text size', 'Very large');
    await pick(page, 'Alignment', 'Centre');
    expect(byId(await saved(page), 't1')).toMatchObject({ color: 'orange', fontSize: 36, align: 'center' });
  });

  test('a custom colour is kept as written across a theme switch', async ({ page }) => {
    await startCanvas(page, [box('b1', 100, 100)]);
    await clickScene(page, { x: 160, y: 140 });
    await selectionToolbar(page).getByRole('button', { name: 'Border colour', exact: true }).click();
    await placed(popovers(page));
    const custom = popovers(page).getByRole('textbox');
    await custom.fill('#c0392b');
    await custom.press('Enter');
    expect(byId(await saved(page), 'b1').stroke).toBe('#c0392b');
    await page.keyboard.press('Escape');
    await menu(page, 'view.theme.dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(byId(await saved(page), 'b1').stroke).toBe('#c0392b');
  });

  test('a locked shape does not move; unlocked, it does', async ({ page }) => {
    await startCanvas(page, [box('b1', 100, 100)]);
    await clickScene(page, { x: 160, y: 140 });
    await menu(page, 'canvas.lock');
    await dragScene(page, { x: 160, y: 140 }, { x: 360, y: 140 });
    expect(byId(await saved(page), 'b1')).toMatchObject({ x: 100, locked: true });
    await menu(page, 'canvas.unlockAll');
    await clickScene(page, { x: 160, y: 140 });
    await dragScene(page, { x: 160, y: 140 }, { x: 360, y: 140 });
    const shape = byId(await saved(page), 'b1');
    expect(shape.x).toBe(300);
    expect(shape.locked).toBeUndefined();
  });

  test('rotating a shape, freely and in 15° steps with Shift', async ({ page }) => {
    await startCanvas(page, [box('b1', 100, 100), box('b2', 400, 100)]);
    await clickScene(page, { x: 160, y: 140 });
    // The rotate handle, above the top edge's middle.
    await dragScene(page, { x: 160, y: 84 }, { x: 260, y: 110 });
    const free = byId(await saved(page), 'b1').angle as number;
    expect(free).toBeGreaterThan(0);
    await clickScene(page, { x: 460, y: 140 });
    await dragScene(page, { x: 460, y: 84 }, { x: 560, y: 110 }, { modifiers: ['Shift'] });
    const stepped = byId(await saved(page), 'b2').angle as number;
    expect(stepped % 15).toBe(0);
    expect(stepped).toBeGreaterThan(0);
  });
});

test.describe('arrows', () => {
  const pair = () => [box('A', 100, 100), box('B', 500, 100)];

  test('an arrow drawn between two shapes attaches and follows a move, a resize and a turn', async ({ page }) => {
    await startCanvas(page, pair());
    await page.keyboard.press('a');
    await dragScene(page, { x: 160, y: 140 }, { x: 560, y: 140 });
    let arrow = ofType(await saved(page), 'arrow')[0];
    expect(arrow).toMatchObject({ startBinding: 'A', endBinding: 'B' });
    const before = ends(arrow).start;
    // A, taken away from the arrow's end on it.
    await page.keyboard.press('Escape');
    await clickScene(page, { x: 120, y: 110 });
    await dragScene(page, { x: 120, y: 110 }, { x: 120, y: 310 });
    arrow = ofType(await saved(page), 'arrow')[0];
    expect(ends(arrow).start.y - before.y).toBe(200);
    // Resized from its bottom-right corner, then turned by the handle above
    // its top edge's middle.
    await dragScene(page, { x: 220, y: 380 }, { x: 300, y: 400 });
    await dragScene(page, { x: 200, y: 284 }, { x: 320, y: 300 });
    const a = byId(await saved(page), 'A');
    expect(a.w).toBeGreaterThan(120);
    expect(a.angle).toBeTruthy();
    arrow = ofType(await saved(page), 'arrow')[0];
    expect(arrow).toMatchObject({ startBinding: 'A', endBinding: 'B' });
  });

  // Cmd/Ctrl leaves an end free: held from the press, both; at the drop, that end.
  test('Ctrl draws an arrow that stays free; Ctrl at the drop frees one end', async ({ page }) => {
    await startCanvas(page, pair());
    await page.keyboard.press('a');
    await dragScene(page, { x: 160, y: 120 }, { x: 560, y: 120 }, { modifiers: ['Control'] });
    await page.keyboard.press('a');
    const a = await onScreen(page, { x: 160, y: 160 });
    const b = await onScreen(page, { x: 560, y: 160 });
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move(b.x, b.y, { steps: 8 });
    await page.keyboard.down('Control');
    await page.mouse.move(b.x + 1, b.y, { steps: 2 });
    await page.mouse.up();
    await page.keyboard.up('Control');
    const [free, half] = ofType(await saved(page), 'arrow').sort((p, q) => (p.z as number) - (q.z as number));
    expect(free.startBinding).toBeUndefined();
    expect(free.endBinding).toBeUndefined();
    expect(half.startBinding).toBe('A');
    expect(half.endBinding).toBeUndefined();
  });

  // Inside a shape an end is pinned where it is dropped; just outside it
  // attaches to the edge; with Alt it is pinned anywhere on the shape.
  test('an end dropped inside a shape is pinned there; just outside it attaches; Alt pins it', async ({ page }) => {
    await startCanvas(page, pair());
    const draw = async (to: Point, alt = false) => {
      await page.keyboard.press('a');
      const a = await onScreen(page, { x: 160, y: 140 });
      const b = await onScreen(page, to);
      await page.mouse.move(a.x, a.y);
      await page.mouse.down();
      await page.mouse.move(b.x, b.y, { steps: 8 });
      if (alt) await page.keyboard.down('Alt');
      await page.mouse.move(b.x, b.y + 1, { steps: 2 });
      await page.mouse.up();
      if (alt) await page.keyboard.up('Alt');
      await page.keyboard.press('Escape');
    };
    // A quarter of the way across B, a quarter of the way down.
    await draw({ x: 530, y: 119 });
    // Just left of B's left side.
    await draw({ x: 494, y: 159 });
    // Just below B's bottom, with Alt.
    await draw({ x: 600, y: 184 }, true);
    const [inside, edge, held] = ofType(await saved(page), 'arrow').sort((p, q) => (p.z as number) - (q.z as number));
    expect(inside).toMatchObject({ endBinding: 'B', endMode: 'inside' });
    const [fx, fy] = inside.endAnchor as [number, number];
    expect(fx).toBeCloseTo(0.25, 1);
    expect(fy).toBeCloseTo(0.25, 1);
    expect(edge.endBinding).toBe('B');
    expect(edge.endMode).toBeUndefined();
    expect(held).toMatchObject({ endBinding: 'B', endMode: 'inside' });
  });

  test('deleting an attached shape detaches the arrow; undo attaches it again', async ({ page }) => {
    await startCanvas(page, [
      ...pair(),
      { id: 'ar', type: 'arrow', x: 226, y: 140, w: 268, h: 0, z: 3, points: [0, 0, 268, 0], startBinding: 'A', endBinding: 'B' },
    ]);
    await clickScene(page, { x: 560, y: 140 });
    await page.keyboard.press('Delete');
    let elements = await saved(page);
    expect(elements.map((element) => element.id).sort()).toEqual(['A', 'ar']);
    // Kept, not deleted: a binding whose target is gone freezes the end.
    expect(byId(elements, 'ar').endBinding).toBe('B');
    await menu(page, 'edit.undo');
    elements = await saved(page);
    expect(elements.map((element) => element.id).sort()).toEqual(['A', 'B', 'ar']);
  });

  // Switching to elbow replaces the bends with the route; switching away
  // keeps only the two ends (docs/file-format.md).
  test('bending, then arc, elbow and back to straight', async ({ page }) => {
    await startCanvas(page, [{ id: 'ar', type: 'arrow', x: 100, y: 200, w: 300, h: 0, z: 1, points: [0, 0, 300, 0] }]);
    await clickScene(page, { x: 200, y: 200 });
    // The middle handle, dragged up: a bend.
    await dragScene(page, { x: 250, y: 200 }, { x: 250, y: 120 });
    let arrow = byId(await saved(page), 'ar');
    expect((arrow.points as number[]).length).toBe(6);
    await pick(page, 'Arrow type', 'Arc');
    arrow = byId(await saved(page), 'ar');
    expect(arrow.arrowType).toBe('arc');
    // Curved through the bend, which it keeps.
    expect((arrow.points as number[]).length).toBe(6);
    await pick(page, 'Arrow type', 'Elbow');
    expect(byId(await saved(page), 'ar')).toMatchObject({ arrowType: 'elbow' });
    await pick(page, 'Arrow type', 'Straight');
    arrow = byId(await saved(page), 'ar');
    expect(arrow.arrowType).toBeUndefined();
    expect((arrow.points as number[]).length).toBe(4);
  });

  test('dragging an elbow’s middle segment fixes it', async ({ page }) => {
    await startCanvas(page, [
      ...pair(),
      {
        id: 'el',
        type: 'arrow',
        arrowType: 'elbow',
        x: 226,
        y: 140,
        w: 268,
        h: 0,
        z: 3,
        points: [0, 0, 134, 0, 134, 0, 268, 0],
        startBinding: 'A',
        endBinding: 'B',
      },
    ]);
    await page.locator('body').click({ position: { x: 1, y: 1 } }).catch(() => undefined);
    await clickScene(page, { x: 360, y: 140 });
    await dragScene(page, { x: 360, y: 140 }, { x: 360, y: 260 });
    const elbow = byId(await saved(page), 'el');
    expect((elbow.fixedSegments as unknown[]).length).toBeGreaterThan(0);
  });

  test('sliding a label along its arrow', async ({ page }) => {
    await startCanvas(page, [{ id: 'ar', type: 'arrow', x: 100, y: 200, w: 400, h: 0, z: 1, points: [0, 0, 400, 0], label: 'calls' }]);
    await clickScene(page, { x: 150, y: 200 });
    // The label, beside the middle handle that sits on it: the handle bends.
    await dragScene(page, { x: 284, y: 200 }, { x: 404, y: 200 });
    const position = byId(await saved(page), 'ar').labelPosition as number;
    expect(position).toBeGreaterThan(0.6);
  });

  test('a line turned into an arrow and back', async ({ page }) => {
    await startCanvas(page, [{ id: 'l1', type: 'line', x: 100, y: 200, w: 300, h: 0, z: 1, points: [0, 0, 300, 0] }]);
    await clickScene(page, { x: 200, y: 200 });
    await pick(page, 'Arrow type', 'Straight');
    expect(byId(await saved(page), 'l1').type).toBe('arrow');
    await pick(page, 'Arrow type', 'Line');
    expect(byId(await saved(page), 'l1').type).toBe('line');
  });

  test('with attaching off in Settings, an arrow stays free; Ctrl attaches it', async ({ page }) => {
    await startCanvas(page, pair());
    await menu(page, 'app.settings');
    const dialog = openDialog(page);
    await dialog.getByRole('tab', { name: 'Canvas' }).click();
    await dialog.getByRole('radiogroup', { name: 'Attach arrows to shapes' }).getByText('Off', { exact: true }).click();
    await page.keyboard.press('Escape');
    await clickScene(page, { x: 900, y: 560 });
    await page.keyboard.press('a');
    await dragScene(page, { x: 160, y: 120 }, { x: 560, y: 120 });
    await page.keyboard.press('a');
    await dragScene(page, { x: 160, y: 160 }, { x: 560, y: 160 }, { modifiers: ['Control'] });
    const [plain, held] = ofType(await saved(page), 'arrow').sort((p, q) => p.y - q.y);
    expect(plain.endBinding).toBeUndefined();
    expect(held.endBinding).toBe('B');
  });
});

test.describe('frames', () => {
  const framed = () => [
    { id: 'F', type: 'frame', x: 100, y: 100, w: 300, h: 240, z: 1, label: 'F' },
    box('in', 140, 160, { frame: 'F', z: 2 }),
    box('out', 600, 160, { z: 3 }),
  ];

  test('into and out of a frame', async ({ page }) => {
    await startCanvas(page, framed());
    await dragScene(page, { x: 660, y: 200 }, { x: 330, y: 280 });
    expect(byId(await saved(page), 'out').frame).toBe('F');
    await dragScene(page, { x: 200, y: 200 }, { x: 760, y: 500 });
    expect(byId(await saved(page), 'in').frame).toBeUndefined();
  });

  test('moving a frame carries its contents; resizing it keeps their size', async ({ page }) => {
    await startCanvas(page, framed());
    // By its label, at its top-left corner.
    await dragScene(page, { x: 112, y: 112 }, { x: 112, y: 212 });
    let elements = await saved(page);
    expect([byId(elements, 'F').y, byId(elements, 'in').y]).toEqual([200, 260]);
    // From its bottom-right corner.
    await dragScene(page, { x: 400, y: 440 }, { x: 480, y: 500 });
    elements = await saved(page);
    expect(byId(elements, 'F').w).toBeGreaterThan(300);
    expect([byId(elements, 'in').w, byId(elements, 'in').h]).toEqual([120, 80]);
  });

  test('deleting a frame keeps its contents', async ({ page }) => {
    await startCanvas(page, framed());
    await clickScene(page, { x: 112, y: 112 });
    await page.keyboard.press('Delete');
    const elements = await saved(page);
    expect(elements.map((element) => element.id).sort()).toEqual(['in', 'out']);
    expect(byId(elements, 'in').frame).toBeUndefined();
  });
});

test.describe('code blocks', () => {
  test('typing grows the block; a language, a resize, an arrow and a frame', async ({ page }) => {
    await startCanvas(page, [
      { id: 'F', type: 'frame', x: 600, y: 80, w: 360, h: 300, z: 1, label: 'F' },
      box('A', 100, 420),
    ]);
    await page.keyboard.press('c');
    await clickScene(page, { x: 100, y: 100 });
    await page.keyboard.type('one\ntwo\nthree\nfour\nfive');
    await page.keyboard.press('Escape');
    let code = ofType(await saved(page), 'code')[0];
    expect(code.code).toBe('one\ntwo\nthree\nfour\nfive');
    const firstHeight = code.h;
    expect(firstHeight).toBeGreaterThan(60);

    await clickScene(page, { x: code.x + 20, y: code.y + 20 });
    await pick(page, 'Language', 'Python');
    expect(ofType(await saved(page), 'code')[0].language).toBe('python');

    // Its right edge, dragged in, then out.
    code = ofType(await saved(page), 'code')[0];
    await dragScene(page, { x: code.x + code.w, y: code.y + code.h / 2 }, { x: code.x + code.w - 60, y: code.y + code.h / 2 });
    const narrower = ofType(await saved(page), 'code')[0].w;
    expect(narrower).toBeLessThan(code.w);

    await page.keyboard.press('a');
    await dragScene(page, { x: 160, y: 460 }, { x: code.x + 40, y: code.y + 30 });
    const arrow = ofType(await saved(page), 'arrow')[0];
    expect(arrow.endBinding).toBe(code.id);

    await page.keyboard.press('v');
    await clickScene(page, { x: code.x + 20, y: code.y + 20 });
    await dragScene(page, { x: code.x + 20, y: code.y + 20 }, { x: 640, y: 140 });
    expect(ofType(await saved(page), 'code')[0].frame).toBe('F');
  });
});

test.describe('snapping', () => {
  // Near the canvas's middle, which zooming keeps in view.
  const lined = () => [box('b1', 300, 300), box('b2', 460, 340)];

  test('off by default; a drag with Ctrl held snaps', async ({ page }) => {
    await startCanvas(page, lined());
    await dragScene(page, { x: 520, y: 380 }, { x: 520, y: 343 });
    expect(byId(await saved(page), 'b2').y).toBe(303);
    await dragScene(page, { x: 520, y: 343 }, { x: 520, y: 346 }, { modifiers: ['Control'] });
    expect(byId(await saved(page), 'b2').y).toBe(300);
  });

  test('Alt+S turns it on, and the menu’s tick follows', async ({ page }) => {
    await startCanvas(page, lined());
    await page.keyboard.press('Alt+s');
    await dragScene(page, { x: 520, y: 380 }, { x: 520, y: 343 });
    expect(byId(await saved(page), 'b2').y).toBe(300);
  });

  for (const steps of [-8, 0, 8]) {
    test(`the reach is the same on screen at ${Math.round(1.2 ** steps * 100)}%`, async ({ page }) => {
      await startCanvas(page, lined());
      const zoom = await zoomSteps(page, steps);
      // Dropped 4 screen pixels below the line of b1's top edge.
      const from = await onScreen(page, { x: 520, y: 380 }, zoom);
      const target = await onScreen(page, { x: 520, y: 340 }, zoom);
      const top = await onScreen(page, { x: 0, y: 300 }, zoom);
      await page.keyboard.down('Control');
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(from.x, from.y - (target.y - top.y) + 4, { steps: 8 });
      await page.mouse.up();
      await page.keyboard.up('Control');
      expect(byId(await saved(page), 'b2').y).toBe(300);
    });
  }
});

test.describe('export', () => {
  const scene = () => [box('b1', 100, 100), box('b2', 400, 260, { fill: 'blue' })];

  test('the whole canvas as PNG at 1× and 2×, with and without background, light and dark', async ({ page }) => {
    await startCanvas(page, scene());
    const one = pngFacts((await exportAs(page, 'PNG', { scale: '1×', background: true, dark: false })).contentsBase64);
    const two = pngFacts((await exportAs(page, 'PNG', { scale: '2×' })).contentsBase64);
    expect(two.width).toBe(one.width * 2);
    expect(two.height).toBe(one.height * 2);
    expect(one.pixel.a).toBe(255);
    expect(luminance(one.pixel)).toBeGreaterThan(0.8);
    const dark = pngFacts((await exportAs(page, 'PNG', { scale: '1×', dark: true })).contentsBase64);
    expect(luminance(dark.pixel)).toBeLessThan(0.2);
    const clear = pngFacts((await exportAs(page, 'PNG', { background: false })).contentsBase64);
    expect(clear.pixel.a).toBe(0);
  });

  test('a selection exports alone, smaller than the canvas', async ({ page }) => {
    await startCanvas(page, scene());
    const whole = pngFacts((await exportAs(page, 'PNG', { scale: '1×' })).contentsBase64);
    await page.keyboard.press('Escape');
    await clickScene(page, { x: 160, y: 140 });
    const part = pngFacts((await exportAs(page, 'PNG', { onlySelected: true })).contentsBase64);
    expect(part.width).toBeLessThan(whole.width);
    expect(part.height).toBeLessThan(whole.height);
  });

  test('an SVG’s labels and code are text, in Geist and Geist Mono, the fonts inside it', async ({ page }) => {
    await startCanvas(page, [
      box('b1', 100, 100),
      { id: 'k1', type: 'code', x: 100, y: 260, w: 220, h: 60, z: 2, code: 'let answer = 42', language: 'javascript', measuredWidth: 150, measuredHeight: 40 },
    ]);
    const svg = Buffer.from((await exportAs(page, 'SVG', { background: true, dark: false })).contentsBase64, 'base64').toString('utf8');
    expect(svg).toMatch(/<text[^>]*>(<tspan[^>]*>)?b1</);
    expect(svg).toContain('answer');
    expect(svg).toMatch(/font-family="?[^">]*Geist/);
    expect(svg).toMatch(/Geist Mono/);
    expect(svg).toMatch(/@font-face/);
  });
});

test.describe('round trips', () => {
  test('everything drawn, styled, attached and framed comes back as it was', async ({ page }) => {
    await startCanvas(page, [{ id: 'F', type: 'frame', x: 600, y: 80, w: 360, h: 300, z: 1, label: 'F' }]);
    await page.keyboard.press('r');
    await dragScene(page, { x: 100, y: 100 }, { x: 240, y: 180 });
    await pick(page, 'Fill colour', 'yellow');
    await pick(page, 'Line style', 'Dashed');
    await page.keyboard.press('o');
    await dragScene(page, { x: 640, y: 140 }, { x: 760, y: 220 });
    await page.keyboard.press('a');
    await dragScene(page, { x: 170, y: 140 }, { x: 700, y: 180 });
    await page.keyboard.press('d');
    await dragScene(page, { x: 100, y: 400 }, { x: 300, y: 460 });
    await page.keyboard.press('c');
    await clickScene(page, { x: 100, y: 500 });
    await page.keyboard.type('x = 1');
    await page.keyboard.press('Escape');
    const { before, after } = await reopened(page);
    expect(after).toEqual(before);
    expect(before.length).toBe(6);
  });

  test('the seeded canvases come back as they were', async ({ page }) => {
    await startCanvas(page, SCENES.arrows());
    const { before, after } = await reopened(page);
    expect(after).toEqual(before);
  });
});

test.describe('defaults, text and dialogs', () => {
  test('new arrows are drawn curved and new lines round', async ({ page }) => {
    await startCanvas(page);
    await page.keyboard.press('a');
    await dragScene(page, { x: 100, y: 100 }, { x: 300, y: 160 });
    await page.keyboard.press('l');
    await dragScene(page, { x: 100, y: 300 }, { x: 300, y: 360 });
    const elements = await saved(page);
    expect(ofType(elements, 'arrow')[0].arrowType).toBe('arc');
    expect(ofType(elements, 'line')[0].edges).toBe('round');
  });

  test('a new shape writes no size or width: the same as picking Medium and 20', async ({ page }) => {
    await startCanvas(page);
    await page.keyboard.press('r');
    await dragScene(page, { x: 100, y: 100 }, { x: 240, y: 180 });
    const drawn = ofType(await saved(page), 'rect')[0];
    await pick(page, 'Stroke width', 'Medium');
    await pick(page, 'Text size', 'Medium');
    const picked = ofType(await saved(page), 'rect')[0];
    expect(picked).toEqual(drawn);
    expect(drawn.strokeWidth).toBeUndefined();
    expect(drawn.fontSize).toBeUndefined();
  });

  test('text typed with the text tool', async ({ page }) => {
    await startCanvas(page);
    await page.keyboard.press('t');
    await clickScene(page, { x: 100, y: 100 });
    await page.keyboard.type('A note');
    await page.keyboard.press('Escape');
    const text = ofType(await saved(page), 'text')[0];
    expect(text.text).toBe('A note');
    expect(text.measuredWidth as number).toBeGreaterThan(30);
  });

  test('Insert with a cylinder from the panel', async ({ page }) => {
    await startCanvas(page);
    await page.getByRole('toolbar', { name: 'Tools' }).getByRole('button', { name: 'Insert', exact: true }).click();
    await page.keyboard.type('cyl');
    await page.keyboard.press('Enter');
    await dragScene(page, { x: 300, y: 200 }, { x: 420, y: 300 });
    expect(ofType(await saved(page), 'cylinder')).toHaveLength(1);
  });

  test('align, flip and duplicate a frame carry its shapes', async ({ page }) => {
    await startCanvas(page, [
      { id: 'F', type: 'frame', x: 100, y: 100, w: 300, h: 240, z: 1, label: 'F' },
      box('in', 140, 160, { frame: 'F', z: 2 }),
      box('other', 600, 300, { z: 3 }),
    ]);
    await clickScene(page, { x: 112, y: 112 });
    await clickScene(page, { x: 660, y: 340 }, { modifiers: ['Shift'] });
    await menu(page, 'canvas.alignBottom');
    let elements = await saved(page);
    // The frame's bottom on the other box's; its shape came down with it.
    expect(byId(elements, 'F').y + byId(elements, 'F').h).toBe(380);
    expect(byId(elements, 'in').y - byId(elements, 'F').y).toBe(60);
    await clickScene(page, { x: 900, y: 560 });
    await clickScene(page, { x: 112, y: byId(elements, 'F').y + 12 });
    await menu(page, 'canvas.flipHorizontal');
    elements = await saved(page);
    const frame = byId(elements, 'F');
    // Mirrored inside the frame: 40 from the left becomes 40 from the right.
    expect(frame.x + frame.w - (byId(elements, 'in').x + 120)).toBe(40);
    await menu(page, 'canvas.duplicate');
    elements = await saved(page);
    expect(ofType(elements, 'frame')).toHaveLength(2);
    const copy = ofType(elements, 'frame').find((element) => element.id !== 'F')!;
    expect(elements.filter((element) => element.frame === copy.id)).toHaveLength(1);
  });

  test('double-clicking an arrow’s label at 25% opens its field on the label', async ({ page }) => {
    await startCanvas(page, [{ id: 'ar', type: 'arrow', x: 300, y: 360, w: 400, h: 0, z: 1, points: [0, 0, 400, 0], label: 'calls' }]);
    const zoom = await zoomSteps(page, -8);
    const label = await onScreen(page, { x: 470, y: 360 }, zoom);
    await page.mouse.dblclick(label.x, label.y);
    const field = page.locator('textarea').filter({ visible: true });
    await expect(field).toBeVisible();
    await expect(field).toHaveValue('calls');
    const box = (await field.boundingBox())!;
    expect(Math.abs(box.x + box.width / 2 - label.x)).toBeLessThan(20);
    expect(Math.abs(box.y + box.height / 2 - label.y)).toBeLessThan(20);
  });

  // ⌘Enter is the native menu's accelerator for Edit Points; the harness has
  // no native menu, so it sends the command the accelerator sends.
  test('Edit Points on an arrow', async ({ page }) => {
    await startCanvas(page, [{ id: 'ar', type: 'arrow', x: 100, y: 200, w: 300, h: 0, z: 1, points: [0, 0, 300, 0] }]);
    await clickScene(page, { x: 200, y: 200 });
    const editPoints = selectionToolbar(page).getByRole('button', { name: 'Edit points' });
    await expect(editPoints).toBeVisible();
    await menu(page, 'canvas.editPoints');
    // In point editing, the toolbar no longer offers it.
    await expect(editPoints).toHaveCount(0);
  });

  test('Diagram from Code starts at the engine used last, and the status bar names it', async ({ page }) => {
    await startCanvas(page);
    await menu(page, 'insert.diagram');
    const dialog = openDialog(page);
    await dialog.getByText('Dagre', { exact: true }).click();
    await dialog.locator('.cm-content').click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('api');
    const insert = dialog.getByRole('button', { name: 'Insert' });
    await expect(insert).toBeEnabled();
    await insert.click();
    await expect(dialog).toHaveCount(0);
    await menu(page, 'insert.diagram');
    await expect(dialog.getByRole('radio', { name: 'Dagre' })).toBeChecked();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('footer')).toContainText('dagre');
  });

  // The webview's own menu (with Reload) shows unless the right-click's
  // contextmenu event is prevented; Bava's menu shows in its place.
  test('the right-click menu has no Reload', async ({ page }) => {
    await startCanvas(page, [box('b1', 100, 100)]);
    await page.evaluate(() => {
      const seen: boolean[] = [];
      (window as unknown as { contextPrevented: boolean[] }).contextPrevented = seen;
      // Read after every handler has run, at the event's last stop.
      window.addEventListener('contextmenu', (event) => seen.push(event.defaultPrevented));
    });
    for (const point of [{ x: 160, y: 140 }, { x: 700, y: 400 }]) {
      await clickScene(page, point, { button: 'right' });
      await expect(menus(page)).toBeVisible();
      await expect(menus(page).getByText('Reload')).toHaveCount(0);
      await page.keyboard.press('Escape');
    }
    expect(await page.evaluate(() => (window as unknown as { contextPrevented: boolean[] }).contextPrevented)).toEqual([true, true]);
  });

  test('saving, reopening and saving again asks nothing', async ({ page }) => {
    await startCanvas(page, [box('b1', 100, 100)]);
    await dragScene(page, { x: 160, y: 140 }, { x: 260, y: 140 });
    await reopened(page);
    await expect(openDialog(page)).toHaveCount(0);
  });
});

test.describe('editing details', () => {
  test('clicking one of three selected leaves only it selected', async ({ page }) => {
    await startCanvas(page, [box('b1', 100, 100), box('b2', 300, 100), box('b3', 500, 100)]);
    await menu(page, 'edit.selectAll');
    await clickScene(page, { x: 360, y: 140 });
    await page.keyboard.press('ArrowDown');
    expect((await saved(page)).map((element) => element.y)).toEqual([100, 101, 100]);
  });

  test('a resize with Shift keeps the shape’s proportions and leaves it selected', async ({ page }) => {
    await startCanvas(page, [box('b1', 100, 100)]);
    await clickScene(page, { x: 160, y: 140 });
    await dragScene(page, { x: 220, y: 180 }, { x: 340, y: 200 }, { modifiers: ['Shift'] });
    const shape = byId(await saved(page), 'b1');
    expect(shape.w / shape.h).toBeCloseTo(1.5, 2);
    expect(shape.w).toBeGreaterThan(200);
    await expect(selectionToolbar(page)).toBeVisible();
  });

  test('a PNG at 3× is three times the size, and a turned, locked shape exports as drawn', async ({ page }) => {
    await startCanvas(page, [box('b1', 100, 100, { angle: 30, locked: true })]);
    const one = pngFacts((await exportAs(page, 'PNG', { scale: '1×' })).contentsBase64);
    const three = pngFacts((await exportAs(page, 'PNG', { scale: '3×' })).contentsBase64);
    // A turned shape's bounds are fractional; each scale rounds its own size.
    expect(Math.abs(three.width - one.width * 3)).toBeLessThanOrEqual(3);
    const svg = Buffer.from((await exportAs(page, 'SVG')).contentsBase64, 'base64').toString('utf8');
    expect(svg).toMatch(/rotate\(30/);
  });

  test('an attached arrow dragged by its body moves and lets go', async ({ page }) => {
    await startCanvas(page, [
      box('A', 100, 100),
      box('B', 500, 100),
      { id: 'ar', type: 'arrow', x: 226, y: 140, w: 268, h: 0, z: 3, points: [0, 0, 268, 0], startBinding: 'A', endBinding: 'B' },
    ]);
    await clickScene(page, { x: 330, y: 140 });
    await dragScene(page, { x: 330, y: 140 }, { x: 330, y: 340 });
    const arrow = byId(await saved(page), 'ar');
    expect(arrow.y).toBe(340);
    expect(arrow.startBinding).toBeUndefined();
    expect(arrow.endBinding).toBeUndefined();
  });

  test('an arrow with both ends on one shape is pinned inside it at both', async ({ page }) => {
    await startCanvas(page, [box('A', 100, 100, { w: 240, h: 160 })]);
    await page.keyboard.press('a');
    await dragScene(page, { x: 140, y: 140 }, { x: 300, y: 220 });
    const arrow = ofType(await saved(page), 'arrow')[0];
    expect(arrow).toMatchObject({ startBinding: 'A', endBinding: 'A', startMode: 'inside', endMode: 'inside' });
  });

  test('flipped together, shapes keep their arrow attached', async ({ page }) => {
    await startCanvas(page, [
      box('A', 100, 100),
      box('B', 500, 100),
      { id: 'ar', type: 'arrow', x: 226, y: 140, w: 268, h: 0, z: 3, points: [0, 0, 268, 0], startBinding: 'A', endBinding: 'B' },
    ]);
    await menu(page, 'edit.selectAll');
    await menu(page, 'canvas.flipHorizontal');
    const elements = await saved(page);
    expect(byId(elements, 'ar')).toMatchObject({ startBinding: 'A', endBinding: 'B' });
    expect(byId(elements, 'A').x).toBeGreaterThan(byId(elements, 'B').x);
  });

  test('an elbow from the top of A to the bottom of B, A above B, leaves upwards and comes in from below', async ({ page }) => {
    await startCanvas(page, [
      box('A', 300, 100),
      box('B', 300, 360),
      {
        id: 'el',
        type: 'arrow',
        arrowType: 'elbow',
        x: 360,
        y: 94,
        w: 0,
        h: 352,
        z: 3,
        points: [0, 0, 0, 352],
        startBinding: 'A',
        endBinding: 'B',
        startAnchor: [0.5, 0],
        endAnchor: [0.5, 1],
      },
    ]);
    // Moved a little, so the route is worked out again.
    await clickScene(page, { x: 320, y: 120 });
    await dragScene(page, { x: 320, y: 120 }, { x: 330, y: 120 });
    const route = pointsOf(byId(await saved(page), 'el'));
    expect(route.length).toBeGreaterThan(3);
    expect(route[1].y).toBeLessThan(route[0].y);
    expect(route.at(-2)!.y).toBeGreaterThan(route.at(-1)!.y);
  });

  test('double-clicking a fixed segment’s handle hands it back to the router', async ({ page }) => {
    await startCanvas(page, [
      box('A', 100, 100),
      box('B', 500, 300),
      {
        id: 'el',
        type: 'arrow',
        arrowType: 'elbow',
        x: 226,
        y: 140,
        w: 334,
        h: 154,
        z: 3,
        points: [0, 0, 100, 0, 100, 154, 334, 154],
        startBinding: 'A',
        endBinding: 'B',
        startAnchor: [1, 0.5],
        endAnchor: [0.5, 0],
        fixedSegments: [{ index: 2, start: [100, 0], end: [100, 154] }],
      },
    ]);
    // Its handle, at the middle of the fixed segment as the opened page routes it.
    const route = pointsOf(byId(await saved(page), 'el'));
    const middle = { x: (route[1].x + route[2].x) / 2, y: (route[1].y + route[2].y) / 2 };
    await clickScene(page, middle);
    const handle = await onScreen(page, middle);
    await page.mouse.dblclick(handle.x, handle.y);
    expect(byId(await saved(page), 'el').fixedSegments).toBeUndefined();
  });

  test('a line by clicks: undo waits, Shift turns in 15° steps, the last point clicked again finishes it', async ({ page }) => {
    await startCanvas(page);
    await page.keyboard.press('l');
    await clickScene(page, { x: 100, y: 100 });
    await clickScene(page, { x: 300, y: 100 });
    await menu(page, 'edit.undo');
    await clickScene(page, { x: 400, y: 190 }, { modifiers: ['Shift'] });
    const at = await onScreen(page, { x: 400, y: 190 });
    // Finished by clicking where the last point went.
    await page.mouse.click(at.x, at.y);
    const [drawn] = ofType(await saved(page), 'line');
    const points = pointsOf(drawn);
    expect(points).toHaveLength(3);
    expect(angleOf(points[1], points[2]) % 15).toBe(0);
  });

  test('an arrow by clicks finishes on a click just outside a shape, attached to it', async ({ page }) => {
    await startCanvas(page, [box('B', 500, 100)]);
    await page.keyboard.press('a');
    await clickScene(page, { x: 100, y: 300 });
    await clickScene(page, { x: 494, y: 140 });
    await page.keyboard.press('Escape');
    const arrow = ofType(await saved(page), 'arrow')[0];
    expect(arrow.endBinding).toBe('B');
    expect(pointsOf(arrow)).toHaveLength(2);
  });

  test('Shift on an arrow’s end turns it in 15° steps', async ({ page }) => {
    await startCanvas(page, [{ id: 'ar', type: 'arrow', x: 100, y: 200, w: 300, h: 0, z: 1, points: [0, 0, 300, 0] }]);
    await clickScene(page, { x: 200, y: 200 });
    // The end taken first, then Shift: a Shift-press is a click that adds to
    // or takes from the selection, and passes over the handles.
    const from = await onScreen(page, { x: 400, y: 200 });
    const to = await onScreen(page, { x: 380, y: 330 });
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x - 5, from.y + 20, { steps: 3 });
    await page.keyboard.down('Shift');
    await page.mouse.move(to.x, to.y, { steps: 6 });
    await page.mouse.up();
    await page.keyboard.up('Shift');
    const [start_, end] = pointsOf(byId(await saved(page), 'ar'));
    expect(angleOf(start_, end) % 15).toBe(0);
    expect(angleOf(start_, end)).not.toBe(0);
  });

  test('in point editing, points boxed and deleted go', async ({ page }) => {
    await startCanvas(page, [{ id: 'l1', type: 'line', x: 100, y: 100, w: 300, h: 100, z: 1, points: [0, 100, 150, 0, 300, 100] }]);
    await clickScene(page, { x: 160, y: 160 });
    await menu(page, 'canvas.editPoints');
    // A box round the top point only.
    await dragScene(page, { x: 220, y: 70 }, { x: 280, y: 130 });
    await page.keyboard.press('Delete');
    expect(pointsOf(byId(await saved(page), 'l1'))).toHaveLength(2);
  });

  test('a code block made narrower wraps its long line and grows to hold it', async ({ page }) => {
    const long = 'const result = computeTheAnswer(firstArgument, secondArgument, thirdArgument);';
    await startCanvas(page, [{ id: 'k1', type: 'code', x: 100, y: 100, w: 700, h: 60, z: 1, code: long, language: 'javascript', measuredWidth: 650, measuredHeight: 40 }]);
    await clickScene(page, { x: 140, y: 120 });
    const before = byId(await saved(page), 'k1');
    await dragScene(page, { x: 800, y: 100 + before.h / 2 }, { x: 360, y: 100 + before.h / 2 });
    const after = byId(await saved(page), 'k1');
    expect(after.w).toBeLessThan(before.w);
    expect(after.h).toBeGreaterThan(before.h);
  });

  test('with snapping on, a drawn box snaps to another’s edge, and Ctrl draws freely', async ({ page }) => {
    await startCanvas(page, [box('b1', 300, 300)]);
    await page.keyboard.press('Alt+s');
    await page.keyboard.press('r');
    await dragScene(page, { x: 500, y: 303 }, { x: 600, y: 377 });
    await page.keyboard.press('r');
    await dragScene(page, { x: 500, y: 503 }, { x: 600, y: 577 }, { modifiers: ['Control'] });
    const [snapped, free] = ofType(await saved(page), 'rect')
      .filter((rect) => rect.id !== 'b1')
      .sort((p, q) => p.y - q.y);
    expect([snapped.y, snapped.y + snapped.h]).toEqual([300, 380]);
    expect(free.y).toBe(503);
  });

  test('a diagram from code is undone with one press', async ({ page }) => {
    await startCanvas(page);
    await menu(page, 'insert.diagram');
    const dialog = openDialog(page);
    await dialog.locator('.cm-content').click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('api');
    await dialog.getByRole('button', { name: 'Insert' }).click();
    await expect(dialog).toHaveCount(0);
    expect(await saved(page)).toHaveLength(1);
    await menu(page, 'edit.undo');
    expect(await saved(page)).toHaveLength(0);
  });
});

test.describe('menus over the canvas', () => {
  // A menu takes focus a moment after it opens; an arrow pressed in between
  // moved the selected shape under it.
  test('arrow keys go to an open right-click menu, not the selection', async ({ page }) => {
    const scene = kinds();
    await openCanvas(page, 'light', CANVAS_PAGE, scene.elements);
    const before = scene.elements.find((element) => element.id === 'k-shape')!;
    await clickScene(page, scene.click.shape);
    await clickScene(page, scene.click.shape, { button: 'right' });
    await expect(menus(page)).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Escape');
    const shape = byId(await saved(page), 'k-shape');
    expect({ x: shape.x, y: shape.y }).toEqual({ x: before.x, y: before.y });
  });
});
