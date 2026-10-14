/**
 * The D2 source pane.
 *
 * CodeMirror is imperative and owns its own DOM, so it is created here and
 * destroyed by the caller's cleanup. It is never handed reactive props: if a
 * `$derived` ever feeds this, the design has gone wrong.
 *
 * D2 as D2 (`d2-language.ts`): coloured as the canvas colours code, typed
 * with D2's editing help, with the compiler's diagnostics.
 */
import { editorTheme } from './theme';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, lineNumbers, keymap, highlightActiveLine, type KeyBinding } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab, redo, selectAll, toggleTabFocusMode, undo } from '@codemirror/commands';
import { syntaxHighlighting } from '@codemirror/language';
import { d2Support } from './d2-language';
import { KIND_HIGHLIGHTER } from '../canvas/code/highlight';
import { lintGutter, setDiagnostics } from '@codemirror/lint';
import type { Diagnostic as GoDiagnostic } from '../../bindings/github.com/tharabyte/bava/internal/render/models';
import { toEditorDiagnostics } from './diagnostics';

export type SourcePaneOptions = {
  doc: string;
  onChange: (source: string) => void;
  /**
   * Bindings the native menu owns. The editor drops them, so a key the menu
   * binds has one meaning and cannot act twice.
   */
  isReserved?: (binding: KeyBinding) => boolean;
  /**
   * Mod-Enter: the source is done (the dialog inserts it). Tab indents here,
   * so this is how the work is finished without leaving the editor.
   */
  onSubmit?: () => void;
};

/** Every mounted pane, by its editor's root element. */
const mounted = new WeakMap<Element, SourcePane>();

export class SourcePane {
  #view: EditorView | null = null;

  /**
   * The pane whose editor contains `element`, or null. Edit commands arrive
   * from the native menu and must reach the editor with focus: more than one
   * pane can be on screen (the document's, and the D2 diagram
   * dialog's), and sending them all to one pasted into an editor nobody was
   * looking at.
   */
  static containing(element: Element | null): SourcePane | null {
    const root = element?.closest('.cm-editor');
    return root ? (mounted.get(root) ?? null) : null;
  }

  mount(host: HTMLElement, options: SourcePaneOptions): void {
    const extensions: Extension[] = [
      editorTheme,
      lineNumbers(),
      highlightActiveLine(),
      history(),
      lintGutter(),
      d2Support(),
      syntaxHighlighting(KIND_HIGHLIGHTER),
      // Tab indents, as in any code editor. Shift-Alt-M hands Tab back to
      // moving focus, on every platform: CodeMirror's own Ctrl-M is the
      // window's Minimise on Windows and Linux.
      keymap.of(
        [
          ...(options.onSubmit ? [{ key: 'Mod-Enter', run: () => (options.onSubmit?.(), true) }] : []),
          { key: 'Shift-Alt-m', run: toggleTabFocusMode },
          ...defaultKeymap.filter((binding) => binding.run !== toggleTabFocusMode),
          ...historyKeymap,
          indentWithTab,
        ].filter((binding) => !options.isReserved?.(binding)),
      ),
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) options.onChange(update.state.doc.toString());
      }),
    ];

    this.#view = new EditorView({
      state: EditorState.create({ doc: options.doc, extensions }),
      parent: host,
    });
    mounted.set(this.#view.dom, this);
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

  /**
   * Edit commands from the native menu. The menu owns Cmd+Z and friends and
   * the editor's keymap has those bindings removed (`isReserved`), so these
   * are the one way they arrive.
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

  /** The selected text, for Copy and Cut. */
  selectedText(): string {
    const view = this.#view;
    if (!view) return '';
    return view.state.selection.ranges.map((r) => view.state.sliceDoc(r.from, r.to)).join('\n');
  }

  /** Replace the selection: Paste with text, Cut with nothing. One undo step. */
  replaceSelection(text: string): void {
    const view = this.#view;
    if (!view) return;
    view.dispatch(view.state.replaceSelection(text), { userEvent: 'input.paste', scrollIntoView: true });
  }

  /** Call from the component's cleanup return. */
  destroy(): void {
    if (this.#view) mounted.delete(this.#view.dom);
    this.#view?.destroy();
    this.#view = null;
  }
}
