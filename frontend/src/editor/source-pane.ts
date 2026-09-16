/**
 * The D2 source pane.
 *
 * CodeMirror is imperative and owns its own DOM, so it is created here and
 * destroyed by the caller's cleanup. It is never handed reactive props: if a
 * `$derived` ever feeds this, the design has gone wrong.
 *
 * No D2 language mode yet — plain text with diagnostics. Highlighting is
 * Milestone 3.5, before documents embed editors of their own.
 */
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, lineNumbers, keymap, highlightActiveLine } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { lintGutter, setDiagnostics } from '@codemirror/lint';
import type { Diagnostic as GoDiagnostic } from '../../bindings/github.com/tenesh/bava/internal/render/models';
import { toEditorDiagnostics } from './diagnostics';

export type SourcePaneOptions = {
  doc: string;
  onChange: (source: string) => void;
};

export class SourcePane {
  #view: EditorView | null = null;

  mount(host: HTMLElement, options: SourcePaneOptions): void {
    const extensions: Extension[] = [
      lineNumbers(),
      highlightActiveLine(),
      history(),
      lintGutter(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) options.onChange(update.state.doc.toString());
      }),
    ];

    this.#view = new EditorView({
      state: EditorState.create({ doc: options.doc, extensions }),
      parent: host,
    });
  }

  /** The current document, for feeding the render client. */
  get doc(): string {
    return this.#view?.state.doc.toString() ?? '';
  }

  /** Show compiler diagnostics in the gutter and inline. */
  setDiagnostics(diagnostics: GoDiagnostic[]): void {
    const view = this.#view;
    if (!view) return;
    const mapped = toEditorDiagnostics(view.state.doc.toString(), diagnostics);
    view.dispatch(setDiagnostics(view.state, mapped));
  }

  /**
   * Put the cursor on a source position and scroll it into view. Used when a
   * click on a diagram node resolves through the response's nodeMap.
   */
  revealRange(from: number, to: number): void {
    const view = this.#view;
    if (!view) return;
    const end = view.state.doc.length;
    const start = Math.min(Math.max(from, 0), end);
    const stop = Math.min(Math.max(to, start), end);
    view.dispatch({
      selection: { anchor: start, head: stop },
      scrollIntoView: true,
    });
    view.focus();
  }

  /** Call from the component's cleanup return. */
  destroy(): void {
    this.#view?.destroy();
    this.#view = null;
  }
}
