// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { keepsBrowserMenu } from './native-menu';

// The webview's own right-click menu (with its Reload, which lost
// unsaved work) shows only where there is text to cut, copy or paste.
describe("the webview's right-click menu", () => {
  const make = (html: string) => {
    const host = document.createElement('div');
    host.innerHTML = html;
    document.body.append(host);
    return host.firstElementChild as HTMLElement;
  };

  it('is kept in a text field and an editable area', () => {
    expect(keepsBrowserMenu(make('<input type="text">'))).toBe(true);
    expect(keepsBrowserMenu(make('<textarea></textarea>'))).toBe(true);
    const editor = make('<div contenteditable="true"><p>code</p></div>');
    expect(keepsBrowserMenu(editor.querySelector('p'))).toBe(true);
  });

  it('is cancelled everywhere else: the canvas, a button, a menu', () => {
    expect(keepsBrowserMenu(make('<canvas></canvas>'))).toBe(false);
    expect(keepsBrowserMenu(make('<button>More</button>'))).toBe(false);
    expect(keepsBrowserMenu(make('<div role="menu"><span>Copy</span></div>'))).toBe(false);
    expect(keepsBrowserMenu(make('<input type="checkbox">'))).toBe(false);
    expect(keepsBrowserMenu(null)).toBe(false);
  });

  it('is kept over text the user has selected', () => {
    const text = make('<p>About Bava</p>');
    const selection = { isCollapsed: false, toString: () => 'About' } as unknown as Selection;
    expect(keepsBrowserMenu(text, selection)).toBe(true);
    expect(keepsBrowserMenu(text, { isCollapsed: true, toString: () => '' } as unknown as Selection)).toBe(false);
  });
});
