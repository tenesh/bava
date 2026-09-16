package render_test

import (
	"context"
	"strings"
	"testing"

	"github.com/tenesh/bava/internal/render"
)

// Line 3 opens a map that is never closed. D2 reports this at its own
// 0-indexed line 2.
const brokenSource = `users: Users
web: Web App
broken: {
`

// Users type through invalid states constantly. A compile failure is an
// expected response, not a failed call.
func TestBrokenSourceReturnsDiagnosticsNotError(t *testing.T) {
	res, err := render.Render(context.Background(), brokenSource, render.Options{})
	if err != nil {
		t.Fatalf("Render returned a transport error for a compile failure: %v", err)
	}
	if len(res.Errors) == 0 {
		t.Fatal("Render reported no diagnostics for source that does not compile")
	}
	if res.SVG != "" {
		t.Errorf("Render returned SVG for source that does not compile: %q", first(res.SVG, 40))
	}
}

// D2 reports 0-indexed lines; editors count from 1. The conversion happens in
// Go, once. This test fails if it is dropped or applied twice.
func TestDiagnosticLineIsOneIndexed(t *testing.T) {
	res, err := render.Render(context.Background(), brokenSource, render.Options{})
	if err != nil {
		t.Fatalf("Render returned error: %v", err)
	}
	if len(res.Errors) == 0 {
		t.Fatal("no diagnostics to check")
	}
	got := res.Errors[0].Line
	if got != 3 {
		t.Errorf("diagnostic Line = %d, want 3 (the 1-indexed line holding the unclosed map)", got)
	}
}

func TestDiagnosticCarriesMessage(t *testing.T) {
	res, err := render.Render(context.Background(), brokenSource, render.Options{})
	if err != nil {
		t.Fatalf("Render returned error: %v", err)
	}
	if len(res.Errors) == 0 {
		t.Fatal("no diagnostics to check")
	}
	if strings.TrimSpace(res.Errors[0].Message) == "" {
		t.Error("diagnostic has an empty message")
	}
}

// The offsets address the document the way CodeMirror does. They must be
// within the source and ordered, or a lint marker lands on the wrong text.
func TestDiagnosticOffsetsAreUsable(t *testing.T) {
	res, err := render.Render(context.Background(), brokenSource, render.Options{})
	if err != nil {
		t.Fatalf("Render returned error: %v", err)
	}
	if len(res.Errors) == 0 {
		t.Fatal("no diagnostics to check")
	}
	d := res.Errors[0]
	if d.From < 0 || d.To > len(brokenSource) {
		t.Errorf("offsets [%d,%d) fall outside the source of length %d", d.From, d.To, len(brokenSource))
	}
	if d.From > d.To {
		t.Errorf("offsets are inverted: From=%d To=%d", d.From, d.To)
	}
}

// D2 prefixes its messages with a 1-indexed "line:col: " that duplicates the
// position we already carry structurally. Shown next to a marked line in the
// editor, that prefix is noise, so it is stripped at the boundary.
func TestDiagnosticMessageHasNoPositionPrefix(t *testing.T) {
	res, err := render.Render(context.Background(), brokenSource, render.Options{})
	if err != nil {
		t.Fatalf("Render returned error: %v", err)
	}
	if len(res.Errors) == 0 {
		t.Fatal("no diagnostics to check")
	}
	got := res.Errors[0].Message
	if got != "maps must be terminated with }" {
		t.Errorf("Message = %q, want the bare message with no position prefix", got)
	}
}
