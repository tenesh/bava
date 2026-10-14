/**
 * The source editor in Bava's colours. CodeMirror's own theme is light only,
 * so without this its gutter and current line stay light in the dark theme.
 * Every value is a token, so the editor follows the theme as it changes.
 */
import { EditorView } from '@codemirror/view';

export const editorTheme = EditorView.theme({
  '&': { color: 'var(--color-text-primary)', backgroundColor: 'transparent' },
  // CodeMirror marks focus with a dotted outline round the editor, which is
  // only as tall as its text; the pane holding it shows focus instead.
  '&.cm-focused': { outline: 'none' },
  '.cm-content': { caretColor: 'var(--color-text-primary)' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--color-text-primary)' },
  '.cm-gutters': {
    backgroundColor: 'var(--color-surface)',
    color: 'var(--color-text-muted)',
    borderRight: 'var(--border-width) solid var(--color-border-subtle)',
  },
  '.cm-activeLine': { backgroundColor: 'var(--color-accent-subtle)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--color-accent-subtle)', color: 'var(--color-text-secondary)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'var(--color-selection)',
  },
  // The kinds `canvas/code/highlight.ts` marks, in the colours the canvas draws code in.
  '.syntax-keyword': { color: 'var(--syntax-keyword)' },
  '.syntax-string': { color: 'var(--syntax-string)' },
  '.syntax-number': { color: 'var(--syntax-number)' },
  '.syntax-comment': { color: 'var(--syntax-comment)' },
  '.syntax-name': { color: 'var(--syntax-name)' },
  '.syntax-type': { color: 'var(--syntax-type)' },
  '.syntax-operator': { color: 'var(--syntax-operator)' },
  '.syntax-punctuation': { color: 'var(--syntax-punctuation)' },
  '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': { backgroundColor: 'var(--color-control-active)', outline: 'none' },
});
