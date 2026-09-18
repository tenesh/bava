// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHistory } from './history';
import { commitLabel, commitText, editableAt, insertText, LabelEditor } from './label-editor';
import { editTarget } from '../shell/edit-target';
import type { SceneData } from './scene';

afterEach(() => {
  document.body.innerHTML = '';
});

const scene = (): SceneData => ({
  elements: [
    { id: 'r', type: 'rect', x: 0, y: 0, w: 100, h: 50, z: 1, label: 'Old' } as never,
    { id: 't', type: 'text', x: 200, y: 0, w: 40, h: 16, z: 2, text: 'hi', measuredWidth: 40, measuredHeight: 16 } as never,
  ],
});

describe('committing an edit', () => {
  it('sets a label in one history step', () => {
    const history = createHistory(scene());
    commitLabel(history, 'r', 'New label');
    expect(history.current.elements[0]).toMatchObject({ label: 'New label' });
    history.undo();
    expect(history.current.elements[0]).toMatchObject({ label: 'Old' });
  });

  it('removes the label key when the label is emptied', () => {
    const history = createHistory(scene());
    commitLabel(history, 'r', '   ');
    expect('label' in history.current.elements[0]).toBe(false);
  });

  it("stores a text element's measurement with its text", () => {
    const history = createHistory(scene());
    commitText(history, 't', 'hello world', () => ({ width: 88, height: 18 }));
    expect(history.current.elements[1]).toMatchObject({ text: 'hello world', measuredWidth: 88, measuredHeight: 18, w: 88, h: 18 });
  });

  // An empty text element cannot be seen, selected or explained.
  it('deletes a text element left empty', () => {
    const history = createHistory(scene());
    commitText(history, 't', '', () => ({ width: 0, height: 0 }));
    expect(history.current.elements.map((e) => e.id)).toEqual(['r']);
  });

  it('records nothing when the text did not change', () => {
    const history = createHistory(scene());
    commitLabel(history, 'r', 'Old');
    expect(history.canUndo).toBe(false);
  });
});

describe('finding what to edit', () => {
  it('finds the topmost shape or text under a point', () => {
    expect(editableAt(scene(), { x: 10, y: 10 })?.id).toBe('r');
    expect(editableAt(scene(), { x: 210, y: 5 })?.id).toBe('t');
    expect(editableAt(scene(), { x: 500, y: 500 })).toBeUndefined();
  });

  // A locked element is inert: no edit reaches it, typing included
  // (`.ai/rules/canvas.md`, "A locked element is skipped by everything that
  // selects"). Without this, a double-click still opened its label editor.
  it('passes through a locked element to what is beneath', () => {
    const locked: SceneData = {
      elements: [
        { id: 'under', type: 'rect', x: 0, y: 0, w: 100, h: 50, z: 1 } as never,
        { id: 'over', type: 'rect', x: 0, y: 0, w: 100, h: 50, z: 2, locked: true } as never,
      ],
    };
    expect(editableAt(locked, { x: 10, y: 10 })?.id).toBe('under');
  });

  // Placing text is one gesture and one undo step: nothing enters history
  // until there is text, so undo cannot leave an invisible empty element.
  it('inserts typed text with its measurement as one step, and nothing when empty', () => {
    const history = createHistory({ elements: [] });
    expect(insertText(history, { x: 30, y: 40 }, '', () => ({ width: 0, height: 0 }))).toBeNull();
    expect(history.canUndo).toBe(false);

    const id = insertText(history, { x: 30, y: 40 }, 'a\nb', () => ({ width: 12, height: 32 }));
    expect(history.current.elements[0]).toMatchObject({ id, type: 'text', x: 30, y: 40, w: 12, h: 32, text: 'a\nb', measuredHeight: 32 });
    history.undo();
    expect(history.current.elements).toHaveLength(0);
    expect(history.canUndo).toBe(false);
  });
});

describe('LabelEditor', () => {
  it('opens a textarea over the element with its value, and canvas keys stand down', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const editor = new LabelEditor(host);
    editor.open({ value: 'Old', rect: { x: 10, y: 20, width: 100, height: 50 }, onCommit: vi.fn() });

    const field = host.querySelector('textarea')!;
    expect(field.value).toBe('Old');
    expect(document.activeElement).toBe(field);
    // Typing "r" in the editor must not switch to the rectangle tool.
    expect(editTarget(document.activeElement, { canvasVisible: true })).toBe('field');
    editor.destroy();
  });

  it('commits once on Escape and once on blur, then closes', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const editor = new LabelEditor(host);
    const onCommit = vi.fn();
    editor.open({ value: '', rect: { x: 0, y: 0, width: 10, height: 10 }, onCommit });

    const field = host.querySelector('textarea')!;
    field.value = 'Typed';
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    field.dispatchEvent(new FocusEvent('blur'));

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith('Typed');
    expect(host.querySelector('textarea')).toBeNull();
    editor.destroy();
  });
});

// Typing "hello text" into new text showed "xt": the field stayed at its
// minimum width while the text scrolled inside it.
describe('LabelEditor sizing', () => {
  it('grows the field to the measured size as you type', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const editor = new LabelEditor(host);
    editor.open({
      value: '',
      rect: { x: 0, y: 0, width: 0, height: 0 },
      measure: (value) => ({ width: value.length * 7, height: 18 }),
      onCommit: vi.fn(),
    });

    const field = host.querySelector('textarea')!;
    field.value = 'hello text';
    field.dispatchEvent(new Event('input', { bubbles: true }));

    expect(field.style.width).toBe('70px');
    expect(field.style.height).toBe('18px');
    editor.destroy();
  });

  it('keeps a shape label at its box when no measure is given', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const editor = new LabelEditor(host);
    editor.open({ value: '', rect: { x: 0, y: 0, width: 100, height: 50 }, onCommit: vi.fn() });

    const field = host.querySelector('textarea')!;
    field.value = 'a much longer label than the box';
    field.dispatchEvent(new Event('input', { bubbles: true }));

    expect(field.style.width).toBe('100px');
    editor.destroy();
  });
});

describe('LabelEditor lifecycle', () => {
  // Opening over an editor still in use must not lose what was typed.
  it('commits an open editor before opening another', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const editor = new LabelEditor(host);
    const first = vi.fn();
    editor.open({ value: '', rect: { x: 0, y: 0, width: 10, height: 10 }, onCommit: first });
    host.querySelector('textarea')!.value = 'typed';
    editor.open({ value: 'other', rect: { x: 0, y: 0, width: 10, height: 10 }, onCommit: vi.fn() });
    expect(first).toHaveBeenCalledWith('typed');
    editor.destroy();
  });

  it('commits when told to, for a view change under it', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const editor = new LabelEditor(host);
    const onCommit = vi.fn();
    editor.open({ value: 'x', rect: { x: 0, y: 0, width: 10, height: 10 }, onCommit });
    editor.commit();
    expect(onCommit).toHaveBeenCalledWith('x');
    expect(editor.isOpen).toBe(false);
  });

  it('aligns free text to the left and labels to the centre', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const editor = new LabelEditor(host);
    editor.open({ value: '', rect: { x: 0, y: 0, width: 10, height: 10 }, onCommit: vi.fn(), align: 'left' });
    expect(host.querySelector('textarea')!.dataset.align).toBe('left');
    editor.destroy();
  });
});

// A rotated shape is typed into where it is drawn, and the field sits on it
// (.ai/rules/canvas.md, "A rotated element is tested where it is drawn").
describe('editing a rotated element', () => {
  const rotated: SceneData = {
    elements: [{ id: 'r', type: 'rect', x: 0, y: 0, w: 100, h: 20, z: 1, angle: 90, label: 'Old' } as never],
  };

  it('is found where it is drawn, not where its box is', () => {
    // Turned a quarter, the bar runs from y -40 to 60 at x 40 to 60.
    expect(editableAt(rotated, { x: 50, y: 55 })?.id).toBe('r');
    expect(editableAt(rotated, { x: 5, y: 10 })).toBeUndefined();
  });

  it('turns the field with the element', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const editor = new LabelEditor(host);
    editor.open({ value: 'Old', rect: { x: 0, y: 0, width: 100, height: 20 }, angle: 90, onCommit: () => {} });
    const field = host.querySelector('textarea')!;
    expect(field.style.transform).toContain('rotate(90deg)');
    editor.destroy();
  });
});
