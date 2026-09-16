import { describe, expect, it } from 'vitest';
import { toEditorDiagnostics } from './diagnostics';
import type { Diagnostic as GoDiagnostic } from '../../bindings/github.com/tenesh/bava/internal/render/models';

const doc = 'users: Users\nweb: Web App\nbroken: {\n';

const go = (over: Partial<GoDiagnostic> = {}): GoDiagnostic => ({
  message: 'maps must be terminated with }',
  from: 26,
  to: 34,
  line: 3,
  ...over,
});

describe('toEditorDiagnostics', () => {
  // Go addresses the document by byte offset and so does CodeMirror, so a
  // diagnostic must land on exactly the characters Go pointed at.
  it('preserves the offsets Go reported', () => {
    const [d] = toEditorDiagnostics(doc, [go()]);
    expect(d.from).toBe(26);
    expect(d.to).toBe(34);
    expect(doc.slice(d.from, d.to)).toBe('broken: ');
  });

  it('carries the message through unchanged', () => {
    const [d] = toEditorDiagnostics(doc, [go()]);
    expect(d.message).toBe('maps must be terminated with }');
    expect(d.severity).toBe('error');
  });

  // The editor document can be a keystroke ahead of the response that
  // described it. An out-of-range offset throws inside CodeMirror, so it is
  // clamped rather than trusted.
  it('clamps offsets that fall past the end of the document', () => {
    const [d] = toEditorDiagnostics(doc, [go({ from: 900, to: 1000 })]);
    expect(d.from).toBeLessThanOrEqual(doc.length);
    expect(d.to).toBeLessThanOrEqual(doc.length);
    expect(d.from).toBeLessThanOrEqual(d.to);
  });

  it('gives a zero-width diagnostic something to attach to', () => {
    const [d] = toEditorDiagnostics(doc, [go({ from: 5, to: 5 })]);
    expect(d.to).toBeGreaterThan(d.from);
  });

  it('never inverts a range', () => {
    const [d] = toEditorDiagnostics(doc, [go({ from: 20, to: 4 })]);
    expect(d.from).toBeLessThanOrEqual(d.to);
  });

  it('maps every diagnostic it is given', () => {
    const out = toEditorDiagnostics(doc, [go(), go({ from: 0, to: 5 })]);
    expect(out).toHaveLength(2);
  });
});
