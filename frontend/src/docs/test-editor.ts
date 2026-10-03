/**
 * For tests: a page open in a DocEditor on the page, taken down by the shared
 * teardown when the test ends.
 */
import { vi, type Mock } from 'vitest';
import type { EditorView } from 'prosemirror-view';
import { DocEditor, type DocEditorOptions } from './editor';
import { atTextEnd } from './test-caret';
import { onTeardown } from '../test/render';

type OpenOptions = Partial<DocEditorOptions> & {
  /** The key the page's folds are remembered under. */
  foldMemory?: string;
  /** Puts the caret at the end of the page's text, as a click below it would. */
  caretAtEnd?: boolean;
};

/**
 * Opens `markdown` in a new editor mounted into a fresh element on the page;
 * `null` mounts the editor with no page shown.
 */
export function openEditor(
  markdown: string | null,
  { foldMemory, caretAtEnd = false, ...options }: OpenOptions = {},
): { editor: DocEditor; view: EditorView; host: HTMLDivElement; onChange: Mock<() => void> } {
  const host = document.createElement('div');
  document.body.append(host);
  const onChange = (options.onChange ?? vi.fn()) as Mock<() => void>;
  const editor = new DocEditor();
  editor.mount(host, { ...options, onChange });
  onTeardown(() => editor.destroy());
  if (markdown !== null) editor.setPage(markdown, foldMemory ?? null);
  const view = editor.view!;
  if (caretAtEnd) view.dispatch(view.state.tr.setSelection(atTextEnd(view.state.doc)));
  return { editor, view, host, onChange };
}

/**
 * Lets what the editor asked the app for (a file's details, a link's card)
 * arrive: the answers are already-settled promises, so one turn of the task
 * queue delivers them and the views they update.
 */
export const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
