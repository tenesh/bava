// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { CanvasStage } from './stage';
import { createScene } from './scene';

function host(): HTMLDivElement {
  const el = document.createElement('div');
  // Konva reads the container size at mount.
  Object.defineProperty(el, 'clientWidth', { value: 800, configurable: true });
  Object.defineProperty(el, 'clientHeight', { value: 600, configurable: true });
  document.body.append(el);
  return el;
}

function sceneWith(count: number) {
  const scene = createScene();
  for (let i = 0; i < count; i += 1) {
    scene.add({ type: 'rect', x: i * 20, y: 0, w: 10, h: 10 });
  }
  return scene;
}

describe('CanvasStage', () => {
  it('creates a node per element', () => {
    const stage = new CanvasStage();
    stage.mount(host());
    stage.render(sceneWith(3).data());
    expect(stage.nodeCount).toBe(3);
    stage.destroy();
  });

  // The reason this class exists rather than per-element Svelte components:
  // a render that rebuilds every node reconciles the whole scene on every
  // keystroke and stutters at a few hundred elements.
  it('patches in place rather than rebuilding', () => {
    const stage = new CanvasStage();
    stage.mount(host());
    const scene = sceneWith(3);
    stage.render(scene.data());

    const [first] = scene.ordered();
    const nodeBefore = stage.nodeFor(first.id);
    scene.update(first.id, { x: 500 });
    stage.render(scene.data());

    expect(stage.nodeFor(first.id)).toBe(nodeBefore);
    expect(stage.nodeFor(first.id)?.x()).toBe(500);
    stage.destroy();
  });

  it('removes nodes for elements that are gone', () => {
    const stage = new CanvasStage();
    stage.mount(host());
    const scene = sceneWith(3);
    stage.render(scene.data());

    const [first] = scene.ordered();
    scene.remove(first.id);
    stage.render(scene.data());

    expect(stage.nodeCount).toBe(2);
    expect(stage.nodeFor(first.id)).toBeUndefined();
    stage.destroy();
  });

  it('renders in z-order', () => {
    const stage = new CanvasStage();
    stage.mount(host());
    const scene = sceneWith(3);
    const ids = scene.ordered().map((e) => e.id);
    scene.bringToFront(ids[0]);
    stage.render(scene.data());
    expect(stage.orderedIds()).toEqual([ids[1], ids[2], ids[0]]);
    stage.destroy();
  });

  it('releases the stage on destroy', () => {
    const el = host();
    const stage = new CanvasStage();
    stage.mount(el);
    stage.render(sceneWith(2).data());
    stage.destroy();
    expect(stage.nodeCount).toBe(0);
    expect(el.querySelector('canvas')).toBeNull();
  });

  it('survives a render before mount', () => {
    const stage = new CanvasStage();
    expect(() => stage.render(sceneWith(1).data())).not.toThrow();
    const el = host();
    stage.mount(el);
    // The scene that arrived early is painted once there is somewhere to paint.
    expect(stage.nodeCount).toBe(1);
    stage.destroy();
  });
});
