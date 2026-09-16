// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { DiagramCanvas } from './canvas';

function host(): HTMLDivElement {
  const el = document.createElement('div');
  document.body.append(el);
  return el;
}

describe('DiagramCanvas', () => {
  // The canvas owns its DOM and patches it. Svelte never renders diagram
  // nodes: per-node components reconcile the whole tree on every keystroke and
  // the app stutters at a few hundred nodes.
  it('renders the SVG it is given into the element it owns', () => {
    const el = host();
    const canvas = new DiagramCanvas();
    canvas.mount(el);

    canvas.setSVG('<svg id="one"><rect/></svg>');

    expect(el.querySelector('svg')?.id).toBe('one');
    canvas.destroy();
  });

  it('replaces previous content rather than appending on each render', () => {
    const el = host();
    const canvas = new DiagramCanvas();
    canvas.mount(el);

    canvas.setSVG('<svg id="one"></svg>');
    canvas.setSVG('<svg id="two"></svg>');

    expect(el.querySelectorAll('svg')).toHaveLength(1);
    expect(el.querySelector('svg')?.id).toBe('two');
    canvas.destroy();
  });

  // A compile error must never blank the diagram, so an empty string is a
  // no-op rather than a clear.
  it('ignores an empty SVG so a compile error cannot blank the canvas', () => {
    const el = host();
    const canvas = new DiagramCanvas();
    canvas.mount(el);

    canvas.setSVG('<svg id="good"></svg>');
    canvas.setSVG('');

    expect(el.querySelector('svg')?.id).toBe('good');
    canvas.destroy();
  });

  it('removes the DOM it owns on destroy', () => {
    const el = host();
    const canvas = new DiagramCanvas();
    canvas.mount(el);
    canvas.setSVG('<svg id="one"></svg>');

    canvas.destroy();

    expect(el.querySelector('svg')).toBeNull();
    expect(el.children).toHaveLength(0);
  });

  it('reports the element id at a point so clicks can resolve to a node', () => {
    const el = host();
    const canvas = new DiagramCanvas();
    canvas.mount(el);
    canvas.setSVG('<svg id="root"><g id="web.api"><rect/></g></svg>');

    const rect = el.querySelector('rect') as SVGRectElement;
    expect(canvas.nodeIDForTarget(rect)).toBe('web.api');
    canvas.destroy();
  });

  it('returns null for a target that is not inside a node group', () => {
    const el = host();
    const canvas = new DiagramCanvas();
    canvas.mount(el);
    canvas.setSVG('<svg id="root"><rect/></svg>');

    const rect = el.querySelector('rect') as SVGRectElement;
    expect(canvas.nodeIDForTarget(rect)).toBeNull();
    canvas.destroy();
  });
});

describe('DiagramCanvas mount ordering', () => {
  // A render result can arrive before the element exists. Caching it as
  // "already painted" left the canvas blank until the source next changed.
  it('paints an SVG that arrived before mount', () => {
    const el = host();
    const canvas = new DiagramCanvas();

    canvas.setSVG('<svg id="early"></svg>');
    canvas.mount(el);

    expect(el.querySelector('svg')?.id).toBe('early');
    canvas.destroy();
  });

  it('paints the same SVG again after a remount', () => {
    const first = host();
    const canvas = new DiagramCanvas();
    canvas.mount(first);
    canvas.setSVG('<svg id="same"></svg>');
    canvas.destroy();

    const second = host();
    canvas.mount(second);
    canvas.setSVG('<svg id="same"></svg>');

    expect(second.querySelector('svg')?.id).toBe('same');
    canvas.destroy();
  });
});
