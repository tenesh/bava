// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { printableClone, renderPage } from './print-page';

const PLACE = { root: '/Users/you/Acme', here: 'Marketing' };

function dom(html: string): HTMLElement {
  const root = document.createElement('div');
  root.className = 'ProseMirror';
  root.setAttribute('contenteditable', 'true');
  root.innerHTML = html;
  return root;
}

describe('printableClone', () => {
  it('takes away the controls and leaves the words', () => {
    const clone = printableClone(dom('<div class="code-block"><div class="code-bar"><button>Copy</button></div><pre>let a = 1</pre></div><p>Words <button class="media-relink">Find it</button></p>'));
    expect(clone.querySelector('button, .code-bar')).toBeNull();
    expect(clone.textContent).toContain('let a = 1');
    expect(clone.textContent).toContain('Words');
  });

  it('is no longer editable or selected', () => {
    const clone = printableClone(dom('<figure class="media ProseMirror-selectednode" draggable="true"><p contenteditable="false">x</p></figure>'));
    expect(clone.querySelector('[contenteditable], [draggable], .ProseMirror-selectednode')).toBeNull();
    expect(clone.hasAttribute('contenteditable')).toBe(false);
  });

  it('prints a picture from the web as its address', () => {
    const clone = printableClone(dom('<figure class="media"><div class="media-frame"><img class="media-file" src="https://example.com/a.png"></div></figure>'));
    expect(clone.querySelector('img')).toBeNull();
    expect(clone.querySelector('a')?.getAttribute('href')).toBe('https://example.com/a.png');
  });

  it("keeps a picture from the Space's own files", () => {
    const clone = printableClone(dom('<img class="media-file" src="/bava-file/?root=%2FUsers&amp;path=a.png">'));
    expect(clone.querySelector('img')?.getAttribute('src')).toContain('/bava-file/');
  });

  it('prints an online video as its site and address, without its thumbnail or player', () => {
    const clone = printableClone(dom('<figure class="media"><div class="media-frame"><div class="media-online"><img class="media-thumbnail" src="https://i.ytimg.com/x.jpg"><span class="media-site">YouTube</span><span class="media-address">youtu.be/x</span></div><iframe src="https://youtube.com/embed/x"></iframe></div></figure>'));
    expect(clone.querySelector('img, iframe')).toBeNull();
    expect(clone.textContent).toContain('youtu.be/x');
  });

  it("prints a video file as its card: the file's name", () => {
    const clone = printableClone(dom('<figure class="media"><div class="media-frame"><video class="media-file" src="/bava-file/?root=%2FU&amp;path=.bava%2Fattachments%2Fdemo.mp4#t=0.001"></video></div></figure>'));
    expect(clone.querySelector('video')).toBeNull();
    expect(clone.querySelector('.media-print-file')?.textContent).toBe('demo.mp4');
  });
});

describe('renderPage', () => {
  it("holds the page's text and its equations drawn", async () => {
    const page = await renderPage('# Launch plan\n\nThe budget is $x^2$.\n', { place: PLACE, width: 'narrow' });
    expect(page.html).toContain('Launch plan');
    expect(page.html).toContain('katex');
    expect(page.html).not.toContain('contenteditable');
  });

  it('leaves nothing behind, whether it worked or not', async () => {
    const before = document.body.children.length;
    await renderPage('# A\n', { place: PLACE, width: 'wide' });
    expect(document.body.children.length).toBe(before);
    await expect(renderPage('# A\n', { place: PLACE, width: 'wide', ready: () => Promise.reject(new Error('no')) })).rejects.toThrow('no');
    expect(document.body.children.length).toBe(before);
  });

  it("gives the page's width in pixels, 0 for full width", async () => {
    document.documentElement.style.setProperty('--size-page-narrow', '640px');
    expect((await renderPage('a\n', { place: PLACE, width: 'narrow' })).widthPx).toBe(640);
    expect((await renderPage('a\n', { place: PLACE, width: 'full' })).widthPx).toBe(0);
  });
});
