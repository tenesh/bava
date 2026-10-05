// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { TextSelection } from 'prosemirror-state';
import { openEditor } from './test-editor';

const box = { frame: 'f1', page: null, src: '.bava/attachments/Roadmap%20-%20Box.png', alt: 'Box' };

describe('putting a canvas embed in the page', () => {
  it('goes at the caret, on a line of its own', () => {
    const { editor, view } = openEditor('One\n\nTwo\n');
    // The page takes the caret as a person's click gives it; jsdom cannot
    // scroll to it, so the focus is told, not given.
    view.dom.dispatchEvent(new FocusEvent('focus'));
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 4)));
    expect(editor.hasCaret()).toBe(true);
    editor.insertEmbed(box);
    expect(editor.markdown()).toBe('One\n\n<!-- bava: embed=f1 -->\n![Box](.bava/attachments/Roadmap%20-%20Box.png)\n\nTwo\n');
  });

  it('goes at the end of a page that has had no caret since it opened', () => {
    const { editor } = openEditor('One\n\nTwo\n');
    expect(editor.hasCaret()).toBe(false);
    editor.insertEmbed(box);
    expect(editor.markdown()).toBe('One\n\nTwo\n\n<!-- bava: embed=f1 -->\n![Box](.bava/attachments/Roadmap%20-%20Box.png)\n');
  });

  it('writes the page a frame is on, when it is another', () => {
    const { editor } = openEditor('One\n');
    editor.insertEmbed({ ...box, page: 'Engineering/Architecture.md' });
    expect(editor.markdown()).toContain('<!-- bava: embed=f1 page="Engineering/Architecture.md" -->');
  });
});
