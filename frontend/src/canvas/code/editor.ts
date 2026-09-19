/**
 * Typing in a code block.
 *
 * A CodeMirror placed over the element, with that language's support, so what
 * the user types is highlighted by the same code that colours the block when
 * they are done. Imperative and owned here, like the label editor: it is
 * created on a double-click and destroyed when it closes, and it is never
 * handed reactive props (`.ai/rules/editors.md`).
 *
 * Enter belongs to the code. Escape and clicking away are how it closes, which
 * is what every other editor in Bava does.
 */
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, redo, selectAll, undo } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { loadLanguageSupport } from './languages';
import { measureCode, type CodeMetrics } from './measure';
import type { History } from '../history';
import type { ElementId, SceneElement } from '../scene';

/**
 * Set a code block's code and the size that code implies, as one undo step.
 *
 * The size is not the user's to choose (`docs/file-format.md`), so it is
 * written here rather than left for a later pass to notice. An emptied block
 * stays: unlike a text element, it is a panel the user placed and can type
 * into again.
 */
export function commitCode(history: History, id: ElementId, code: string, metrics: CodeMetrics): void {
  history.mutate((draft) => {
    const element = draft.elements.find((e) => e.id === id) as (SceneElement & CodeFields) | undefined;
    if (!element || element.type !== 'code') return;
    if (element.code === code) return;
    const size = measureCode(code, metrics);
    element.code = code;
    element.w = size.width;
    element.h = size.height;
    element.measuredWidth = size.width;
    element.measuredHeight = size.height;
  });
}

type CodeFields = { code: string; measuredWidth: number; measuredHeight: number };

export type CodeEditorRequest = {
  code: string;
  language?: string;
  /** Where the block is on screen, relative to the host. */
  rect: { x: number; y: number; width: number; height: number };
  /** The block's angle, so the editor sits on it rather than beside it. */
  angle?: number;
  /** The canvas zoom, so the typed text matches the code underneath. */
  zoom?: number;
  onCommit: (code: string) => void;
};

export class CodeEditor {
  #host: HTMLElement;
  #view: EditorView | null = null;
  #commit: (() => void) | null = null;

  constructor(host: HTMLElement) {
    this.#host = host;
  }

  get isOpen(): boolean {
    return this.#view !== null;
  }

  /** Whether an event started inside the editor, which the canvas ignores. */
  contains(target: EventTarget | null): boolean {
    return target instanceof Node && this.#view !== null && this.#view.dom.contains(target);
  }

  async open(request: CodeEditorRequest): Promise<void> {
    // Anything typed into an editor still open is kept, not dropped.
    this.commit();

    const support = await loadLanguageSupport(request.language);
    const wrapper = document.createElement('div');
    wrapper.className = 'bava-code-editor';
    const zoom = request.zoom ?? 1;
    Object.assign(wrapper.style, {
      left: `${request.rect.x}px`,
      top: `${request.rect.y}px`,
      width: `${request.rect.width}px`,
      height: `${request.rect.height}px`,
      // Turned about its centre, as the stage turns the block; and scaled with
      // the canvas, so what is typed lines up with what is drawn.
      transform: request.angle ? `rotate(${request.angle}deg)` : '',
      fontSize: `${zoom}em`,
    });

    let done = false;
    const commit = () => {
      if (done) return;
      done = true;
      const code = this.#view?.state.doc.toString() ?? request.code;
      this.#view?.destroy();
      this.#view = null;
      this.#commit = null;
      wrapper.remove();
      request.onCommit(code);
    };

    const extensions: Extension[] = [
      history(),
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      ...(support ? [support] : []),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      EditorView.domEventHandlers({
        keydown: (event) => {
          // Enter is a new line here; Escape is how you leave.
          if (event.key !== 'Escape') {
            event.stopPropagation();
            return false;
          }
          event.preventDefault();
          commit();
          return true;
        },
        blur: () => {
          commit();
          return false;
        },
      }),
    ];

    this.#host.append(wrapper);
    this.#view = new EditorView({
      state: EditorState.create({ doc: request.code, extensions }),
      parent: wrapper,
    });
    this.#commit = commit;
    this.#view.focus();
  }

  /**
   * The edit commands, which arrive from the native menu rather than as keys:
   * the accelerator is taken before the webview sees it, so without these the
   * editor could not be undone in or pasted into.
   */
  undo(): void {
    if (this.#view) undo(this.#view);
  }

  redo(): void {
    if (this.#view) redo(this.#view);
  }

  selectAll(): void {
    if (this.#view) selectAll(this.#view);
  }

  /** What is in the editor, for a test and for the caller's own checks. */
  text(): string {
    return this.#view?.state.doc.toString() ?? '';
  }

  /** The selected text, for Copy and Cut. */
  selectedText(): string {
    const view = this.#view;
    if (!view) return '';
    return view.state.selection.ranges.map((range) => view.state.sliceDoc(range.from, range.to)).join('\n');
  }

  /** Replace the selection: Paste with text, Cut with nothing. One step. */
  replaceSelection(text: string): void {
    const view = this.#view;
    if (!view) return;
    view.dispatch(view.state.replaceSelection(text), { userEvent: 'input.paste', scrollIntoView: true });
  }

  /** Commit and close an open editor, if there is one. */
  commit(): void {
    this.#commit?.();
  }

  /**
   * Close the editor, keeping what was typed.
   *
   * Called when the canvas goes away (a file closes, the pane unmounts), which
   * must not be a way to lose work: the commit happens first, and only then
   * is the view torn down.
   */
  destroy(): void {
    this.commit();
    const view = this.#view;
    this.#commit = null;
    this.#view = null;
    view?.dom.parentElement?.remove();
    view?.destroy();
  }
}
