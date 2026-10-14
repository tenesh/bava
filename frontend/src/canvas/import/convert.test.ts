import { beforeAll, describe, expect, it } from 'vitest';
import layout from './__fixtures__/containers.json';
import { ICON_IN_FRAME, ICON_IN_FRAME_INSET, iconsNotFound, toElements, unplaceable } from './convert';
import type { Layout } from './convert';
import { isShapeType, type SceneElement } from '../scene';
import { loadSet, setCustomIcons } from '../icons/sets';
import { resolveD2Icon } from '../icons/d2-names';
import { tableLayout } from '../table-layout';

const fixture = layout as Layout;
const converted = () => toElements(fixture, { at: { x: 0, y: 0 } });
const byLabel = (elements: ReturnType<typeof converted>, label: string) =>
  elements.find((e) => (e as { label?: string }).label === label)!;

describe('converting a D2 layout into canvas elements', () => {
  it('makes one element per shape and one arrow per connection', () => {
    const elements = converted();
    expect(elements.filter((e) => e.type === 'arrow')).toHaveLength(fixture.connections.length);
    expect(elements.filter((e) => e.type !== 'arrow')).toHaveLength(fixture.shapes.length);
  });

  // A container is a frame that owns what it holds, so dragging it later
  // carries its contents.
  it('turns a container into a frame whose children record it', () => {
    const elements = converted();
    const frame = byLabel(elements, 'Frontend');
    expect(frame.type).toBe('frame');
    const child = byLabel(elements, 'Source Editor');
    expect((child as { frame?: string }).frame).toBe(frame.id);
    expect(isShapeType(child.type)).toBe(true);
  });

  it('binds each arrow to the elements its connection named', () => {
    const elements = converted();
    const editor = byLabel(elements, 'Source Editor');
    const compile = byLabel(elements, 'Compile');
    const arrow = elements.find((e) => (e as { label?: string }).label === 'source')!;
    expect(arrow).toMatchObject({ type: 'arrow', startBinding: editor.id, endBinding: compile.id });
  });

  it('carries the arrowheads the connection asked for', () => {
    const arrow = converted().find((e) => (e as { label?: string }).label === 'source') as Record<string, unknown>;
    expect(arrow.endArrowhead).toBe('triangle');
    expect(arrow.startArrowhead).toBe('none');
  });

  it('keeps every label', () => {
    const labels = converted().map((e) => (e as { label?: string }).label);
    for (const label of ['Frontend', 'Backend', 'Source Editor', 'Canvas', 'Compile', 'Layout', 'Render', 'source', 'svg']) {
      expect(labels).toContain(label);
    }
  });

  it('keeps the sizes D2 laid out, one to one', () => {
    const frame = byLabel(converted(), 'Frontend');
    const source = fixture.shapes.find((s) => s.id === 'frontend')!;
    expect({ w: frame.w, h: frame.h }).toEqual({ w: source.w, h: source.h });
  });

  // The user's decision: a generated shape looks like one drawn by hand, and
  // follows the theme. D2's palette is not carried at all.
  it('gives nothing a colour', () => {
    for (const element of converted()) {
      expect(element).not.toHaveProperty('fill');
      expect(element).not.toHaveProperty('stroke');
      expect(element).not.toHaveProperty('color');
    }
  });

  it('centres the whole diagram where it is asked to land', () => {
    const elements = toElements(fixture, { at: { x: 500, y: 300 } });
    const xs = elements.map((e) => e.x);
    const ys = elements.map((e) => e.y);
    const centre = {
      x: (Math.min(...xs) + Math.max(...elements.map((e) => e.x + e.w))) / 2,
      y: (Math.min(...ys) + Math.max(...elements.map((e) => e.y + e.h))) / 2,
    };
    expect(Math.abs(centre.x - 500)).toBeLessThan(1);
    expect(Math.abs(centre.y - 300)).toBeLessThan(1);
  });

  it('gives everything a fresh id, never D2 own', () => {
    const elements = converted();
    const ids = elements.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const shape of fixture.shapes) expect(ids).not.toContain(shape.id);
  });

  it('paints containers behind their contents', () => {
    const elements = converted();
    const frame = byLabel(elements, 'Frontend');
    const child = byLabel(elements, 'Source Editor');
    expect(frame.z).toBeLessThan(child.z);
  });

  // A shape is fitted to its label as it arrives; containers and arrows are not.
  it('fits each shape as it arrives, and nothing else', () => {
    const fitted: string[] = [];
    const elements = toElements(fixture, { at: { x: 0, y: 0 }, fit: (element) => fitted.push(element.id) });
    const shapes = elements.filter((element) => element.type !== 'arrow' && element.type !== 'frame');
    expect(fitted.sort()).toEqual(shapes.map((element) => element.id).sort());
    expect(fitted.length).toBeGreaterThan(0);
  });

  it('converts an empty layout into nothing at all', () => {
    expect(toElements({ shapes: [], connections: [] }, { at: { x: 0, y: 0 } })).toEqual([]);
  });
});

// D2 features Bava cannot place yet (a sequence diagram's lifelines) name
// endpoints that are not shapes. A half-bound arrow hanging off a participant
// is worse than no arrow: the user did not draw it and cannot explain it.
describe('a connection that names something that is not a shape', () => {
  const stray: Layout = {
    shapes: [{ id: 'alice', type: 'rectangle', x: 0, y: 0, w: 60, h: 40, label: 'Alice' }],
    connections: [
      {
        id: '(alice -- )[0]',
        src: 'alice',
        dst: 'alice-lifeline-end-3851299086',
        route: [
          { x: 30, y: 40 },
          { x: 30, y: 280 },
        ],
      },
    ],
  };

  it('is left out rather than inserted half-attached', () => {
    const elements = toElements(stray, { at: { x: 0, y: 0 } });
    expect(elements.filter((e) => e.type === 'arrow')).toHaveLength(0);
    expect(elements).toHaveLength(1);
  });

  it('reports what it could not place, so the caller can say so', () => {
    expect(unplaceable(stray)).toBe(1);
    expect(unplaceable({ shapes: [], connections: [] })).toBe(0);
  });
});

// A SQL table and a UML class arrive as tables and classes, and a link
// between two columns arrives attached to both rows.
describe('tables and classes from a D2 diagram', () => {
  // D2 gives a table's header and each column the same height: 30 here.
  const users = { id: 'users', type: 'sql_table', x: 0, y: 0, w: 200, h: 90, label: 'users', rows: 'id int pk\nteam_id int fk' };
  const teams = { id: 'teams', type: 'sql_table', x: 400, y: 0, w: 200, h: 60, label: 'teams', rows: 'id int pk' };
  const user = { id: 'User', type: 'class', x: 0, y: 200, w: 220, h: 120, label: 'User', rows: '+ email: string\n+ save(): bool' };
  const link = { id: '(users.team_id -> teams.id)[0]', src: 'users', dst: 'teams', dstArrow: 'triangle', route: [{ x: 200, y: 75 }, { x: 400, y: 45 }], srcColumn: 1, dstColumn: 0 };
  // To the whole table, its route ending on a side at a row's height.
  const whole = { id: '(users -> teams)[0]', src: 'users', dst: 'teams', dstArrow: 'triangle', route: [{ x: 200, y: 45 }, { x: 400, y: 45 }] };
  const elements = () => toElements({ shapes: [users, teams, user], connections: [link, whole] } as unknown as Layout, { at: { x: 300, y: 160 } });

  it('makes tables and classes of them, their rows kept, as tall as their rows', () => {
    const [t, , c] = elements() as unknown as { type: string; name: string; rows: string; w: number; h: number }[];
    expect(t).toMatchObject({ type: 'table', name: 'users', rows: 'id int pk\nteam_id int fk', w: 200 });
    expect(t.h).toBe(tableLayout({ ...t, type: 'table' }).height);
    expect(c).toMatchObject({ type: 'class', name: 'User', rows: '+ email: string\n+ save(): bool' });
    expect(t).not.toHaveProperty('label');
  });

  it('attaches a link between columns to both rows, and a link to a table to no row', () => {
    const [toColumns, toTable] = elements().filter((e) => e.type === 'arrow');
    expect(toColumns).toMatchObject({ startRow: 'team_id', endRow: 'id' });
    expect(toTable).not.toHaveProperty('startRow');
    expect(toTable).not.toHaveProperty('endRow');
  });
});

describe('icons from a D2 diagram', () => {
  const shape = (over: Record<string, unknown>) => ({ type: 'rectangle', x: 0, y: 0, w: 100, h: 66, ...over });
  const withIcons: Layout = {
    shapes: [
      shape({ id: 'api', label: 'api', icon: 'server' }),
      shape({ id: 'db', label: 'Orders DB', icon: 'https://example.com/icons/postgresql.svg', x: 200 }),
      shape({ id: 'billing', label: 'billing', icon: 'acme-billing', x: 400 }),
      shape({ id: 'group', label: 'Workers', icon: 'cloud', x: 0, y: 200, w: 300, h: 200 }),
      shape({ id: 'group.worker', parent: 'group', label: 'worker', x: 50, y: 280 }),
    ] as Layout['shapes'],
    connections: [
      { id: '(api -> db)[0]', src: 'api', dst: 'db', route: [{ x: 100, y: 33 }, { x: 200, y: 33 }] },
      { id: '(api -> billing)[0]', src: 'api', dst: 'billing', route: [{ x: 100, y: 40 }, { x: 400, y: 40 }] },
    ] as Layout['connections'],
  };
  const known: Record<string, string> = { server: 'line/server', 'https://example.com/icons/postgresql.svg': 'logo/postgresql', cloud: 'line/cloud' };
  const resolve = (value: string) => known[value] ?? null;
  const convert = () => toElements(withIcons, { at: { x: 250, y: 200 }, resolveIcon: resolve });
  const icons = (elements: SceneElement[]) => elements.filter((e) => e.type === 'icon') as (SceneElement & { icon: string; label?: string; frame?: string })[];

  it('makes a shape with a known icon that icon alone, its label under it, in the middle of its box', () => {
    const elements = convert();
    const api = icons(elements).find((e) => e.icon === 'line/server')!;
    expect(api).toMatchObject({ label: 'api', w: 66, h: 66 });
    // Centred where D2 put the box: the layout's centre moved to `at`.
    expect(api.x - (convert().find((e) => e.type === 'frame')!.x - 0)).toBeCloseTo(17);
    expect(icons(elements).find((e) => e.icon === 'logo/postgresql')).toMatchObject({ label: 'Orders DB' });
  });

  it("attaches the shape's arrows to its icon, ending at its square rather than D2's box", () => {
    const elements = convert();
    const api = icons(elements).find((e) => e.icon === 'line/server')!;
    const db = icons(elements).find((e) => e.icon === 'logo/postgresql')!;
    const arrow = elements.find((e) => e.type === 'arrow' && (e as { endBinding?: string }).endBinding === db.id) as SceneElement & { points: number[] };
    expect(arrow).toMatchObject({ startBinding: api.id });
    const ends = [
      { x: arrow.x + arrow.points[0], y: arrow.y + arrow.points[1] },
      { x: arrow.x + arrow.points[arrow.points.length - 2], y: arrow.y + arrow.points[arrow.points.length - 1] },
    ];
    expect(ends[0].x).toBeCloseTo(api.x + api.w);
    expect(ends[1].x).toBeCloseTo(db.x);
  });

  it('leaves a shape whose icon is not found a plain shape, and names it', () => {
    const elements = convert();
    expect(elements.find((e) => (e as { label?: string }).label === 'billing')).toMatchObject({ type: 'rect' });
    expect(iconsNotFound(withIcons, resolve)).toEqual(['acme-billing']);
  });

  it('names a missing picture carried as data briefly, and says nothing of a table, which takes no icon', () => {
    const layout: Layout = {
      shapes: [
        { id: 'p', type: 'rectangle', x: 0, y: 0, w: 10, h: 10, icon: 'data:image/png;base64,AAAA' },
        { id: 't', type: 'sql_table', x: 0, y: 0, w: 10, h: 10, icon: 'not-here', rows: 'id int' },
      ] as Layout['shapes'],
      connections: [],
    };
    expect(iconsNotFound(layout, () => null)).toEqual(['a picture carried in the D2']);
  });

  // Its top-left corner holds the frame's label.
  it('keeps a container its frame, and puts its icon in the top-right corner, unlabelled', () => {
    const elements = convert();
    const frame = elements.find((e) => e.type === 'frame')!;
    const icon = icons(elements).find((e) => e.icon === 'line/cloud')!;
    expect(icon).toMatchObject({
      frame: frame.id,
      w: ICON_IN_FRAME,
      h: ICON_IN_FRAME,
      x: frame.x + frame.w - ICON_IN_FRAME_INSET - ICON_IN_FRAME,
      y: frame.y + ICON_IN_FRAME_INSET,
    });
    expect(icon.label).toBeUndefined();
    expect(icon.z).toBeGreaterThan(frame.z);
  });
});

// Whatever a D2 diagram's icons say, what lands on the canvas names an icon
// of Bava's own, never an address to fetch.
describe('conversion never yields a remote icon', () => {
  beforeAll(async () => {
    await Promise.all([loadSet('line'), loadSet('logo')]);
    setCustomIcons([]);
  });

  it('names only icons of its own sets, whatever the D2 says', () => {
    const values = [
      'server',
      'https://icons.example.com/essentials/112-server.svg',
      'http://example.com/database.svg',
      '//cdn.example.com/x/cloud.svg',
      'file:///Users/you/redis.svg',
      'data:image/svg+xml;base64,PHN2Zz4=',
      'https://example.com/not-an-icon.svg',
      'ftp://example.com/postgresql.svg',
    ];
    const layout: Layout = {
      shapes: values.map((icon, n) => ({ id: `s${n}`, type: 'rectangle', x: n * 120, y: 0, w: 100, h: 66, label: `s${n}`, icon })) as Layout['shapes'],
      connections: [],
    };
    const elements = toElements(layout, { at: { x: 0, y: 0 }, resolveIcon: resolveD2Icon });
    const icons = elements.filter((e) => e.type === 'icon').map((e) => (e as { icon: string }).icon);
    expect(icons).toEqual(['line/server', 'line/server', 'line/database', 'line/cloud', 'logo/redis', 'logo/postgresql']);
    for (const element of elements) {
      expect(JSON.stringify(element)).not.toMatch(/https?:|\/\/|data:|file:|ftp:/);
    }
  });
});
