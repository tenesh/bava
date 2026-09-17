/**
 * Maps compiler diagnostics from the render response onto CodeMirror.
 *
 * The positions come from the response and are never recomputed here: Go
 * compiles with UTF16Pos set, so offsets arrive in UTF-16 code units, the
 * units JavaScript and CodeMirror index by. They are not byte offsets, and a
 * non-ASCII label would shift every marker if they were. Re-parsing in the
 * frontend to find a position would be a second source of truth.
 */
import type { Diagnostic as EditorDiagnostic } from '@codemirror/lint';
import type { Diagnostic as GoDiagnostic } from '../../bindings/github.com/tenesh/bava/internal/render/models';

export function toEditorDiagnostics(doc: string, diagnostics: GoDiagnostic[]): EditorDiagnostic[] {
  const end = doc.length;
  return diagnostics.map((d) => {
    // The document can be a keystroke ahead of the response describing it, so
    // an offset past the end is expected rather than exceptional. CodeMirror
    // throws on an out-of-range position, so clamp instead of trusting.
    let from = clamp(d.from, 0, end);
    let to = clamp(d.to, 0, end);
    if (to < from) [from, to] = [to, from];
    // A zero-width range renders as nothing at all; give it one character to
    // attach to, unless the document is empty.
    if (to === from && from < end) to = from + 1;
    return {
      from,
      to,
      severity: 'error' as const,
      message: d.message,
    };
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
