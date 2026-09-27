/**
 * The source editor in Bava's colours. CodeMirror's own theme is light only,
 * so without this its gutter and current line stay light in the dark theme.
 * Every value is a token, so the editor follows the theme as it changes.
 */
import { EditorView } from '@codemirror/view';

export const editorTheme = EditorView.theme({
  '&': { color: 'var(--color-text-primary)', backgroundColor: 'transparent' },
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
});
