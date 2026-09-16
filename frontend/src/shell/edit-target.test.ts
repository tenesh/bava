// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { editTarget as target, fieldSelection } from './edit-target';

const editTarget = (el: Element | null) => target(el, { canvasVisible: true });

function inside(html: string, selector: string): Element | null {
  document.body.innerHTML = html;
  return document.querySelector(selector);
}

// Undo, Redo, Select All and Delete arrive from the native menu, not as key
// presses, so nothing routes them by focus unless this does.
describe('editTarget', () => {
  it('routes to the source editor when CodeMirror has focus', () => {
    expect(editTarget(inside('<div class="cm-editor"><div class="cm-content" contenteditable></div></div>', '.cm-content'))).toBe('source');
  });

  it('routes to the field when a text input has focus', () => {
    expect(editTarget(inside('<input>', 'input'))).toBe('field');
    expect(editTarget(inside('<textarea></textarea>', 'textarea'))).toBe('field');
    expect(editTarget(inside('<div contenteditable></div>', 'div'))).toBe('field');
  });

  it('routes to the canvas otherwise', () => {
    expect(editTarget(inside('<button></button>', 'button'))).toBe('canvas');
    expect(editTarget(document.body)).toBe('canvas');
    expect(editTarget(null)).toBe('canvas');
  });

  it('never reaches a hidden canvas', () => {
    expect(target(document.body, { canvasVisible: false })).toBe('none');
    expect(target(null, { canvasVisible: false })).toBe('none');
  });

  it('never reaches the canvas from inside a dialog', () => {
    expect(editTarget(inside('<div role="dialog"><button></button></div>', 'button'))).toBe('none');
    expect(editTarget(inside('<div role="dialog"><input></div>', 'input'))).toBe('field');
  });

  it('reads the selection inside a text input', () => {
    const input = inside('<input value="hello world">', 'input') as HTMLInputElement;
    input.setSelectionRange(0, 5);
    expect(fieldSelection(input)).toBe('hello');
  });
});
