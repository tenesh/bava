// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { canvasKeyStandsDown, editTarget as target, fieldSelection } from './edit-target';

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

describe('canvasKeyStandsDown', () => {
  // Enter and Space activate a focused button; arrows move within a menu or a
  // radio group. The canvas must leave those keys to the control, or buttons
  // stop working from the keyboard.
  it('leaves activation and navigation keys to a focused control', () => {
    const button = inside('<button></button>', 'button');
    for (const key of ['Enter', ' ', 'ArrowDown', 'ArrowLeft', 'Tab']) {
      expect(canvasKeyStandsDown(button, key, false), key).toBe(true);
    }
    const radio = inside('<div role="radiogroup"><div role="radio" tabindex="0"></div></div>', '[role=radio]');
    expect(canvasKeyStandsDown(radio, 'ArrowRight', false)).toBe(true);
  });

  // Tool letters and Delete still act on the canvas after clicking a rail
  // button, which keeps the focus.
  it('lets tool letters and Delete through from a focused control', () => {
    const button = inside('<button></button>', 'button');
    expect(canvasKeyStandsDown(button, 'r', false)).toBe(false);
    expect(canvasKeyStandsDown(button, 'Backspace', false)).toBe(false);
  });

  it('stands down for a key something else already handled', () => {
    expect(canvasKeyStandsDown(document.body, 'Enter', true)).toBe(true);
    expect(canvasKeyStandsDown(document.body, 'Enter', false)).toBe(false);
  });
});
