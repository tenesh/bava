package app_test

import (
	"encoding/json"
	"sort"
	"testing"

	"github.com/tenesh/bava/internal/app"
	"github.com/tenesh/bava/internal/render"
)

// The TypeScript side consumes these names. A Go field rename that forgets the
// json tag would compile, pass every other test, and break the frontend
// silently. This is the test that catches it.
func TestResultJSONFieldNames(t *testing.T) {
	b, err := json.Marshal(render.Result{})
	if err != nil {
		t.Fatalf("marshal Result: %v", err)
	}
	assertKeys(t, "Result", b, []string{"errors", "layout", "nodeMap", "svg"})
}

// The layout is what the canvas builds shapes from, so its names are a
// contract too. Colours are deliberately not among them: a generated shape
// arrives in Bava's own style (decided 2026-09-19).
func TestLayoutJSONFieldNames(t *testing.T) {
	b, err := json.Marshal(render.Layout{})
	if err != nil {
		t.Fatalf("marshal Layout: %v", err)
	}
	assertKeys(t, "Layout", b, []string{"connections", "shapes"})

	// Populated, not zero: `omitempty` hides exactly the names the frontend
	// reads for nesting, labels and arrowheads.
	shape, err := json.Marshal(render.LayoutShape{ID: "a.b", Type: "rectangle", Parent: "a", Label: "B", W: 1, H: 1})
	if err != nil {
		t.Fatalf("marshal LayoutShape: %v", err)
	}
	assertKeys(t, "LayoutShape", shape, []string{"h", "id", "label", "parent", "type", "w", "x", "y"})

	connection, err := json.Marshal(render.LayoutConnection{
		ID:       "(a -> b)[0]",
		Src:      "a",
		Dst:      "b",
		SrcArrow: "none",
		DstArrow: "triangle",
		Label:    "sends",
		Route:    []render.LayoutPoint{{X: 0, Y: 0}},
	})
	if err != nil {
		t.Fatalf("marshal LayoutConnection: %v", err)
	}
	assertKeys(t, "LayoutConnection", connection, []string{"dst", "dstArrow", "id", "label", "route", "src", "srcArrow"})
}

func TestDiagnosticJSONFieldNames(t *testing.T) {
	b, err := json.Marshal(render.Diagnostic{})
	if err != nil {
		t.Fatalf("marshal Diagnostic: %v", err)
	}
	assertKeys(t, "Diagnostic", b, []string{"from", "line", "message", "to"})
}

func TestSpanJSONFieldNames(t *testing.T) {
	b, err := json.Marshal(render.Span{})
	if err != nil {
		t.Fatalf("marshal Span: %v", err)
	}
	assertKeys(t, "Span", b, []string{"from", "line", "to"})
}

// Compile failures must reach the frontend as data on a successful call.
func TestServiceReturnsDiagnosticsWithoutError(t *testing.T) {
	svc := app.NewRenderService()
	res, err := svc.Render("broken: {", render.Options{})
	if err != nil {
		t.Fatalf("service returned a transport error for a compile failure: %v", err)
	}
	if len(res.Errors) == 0 {
		t.Error("service returned no diagnostics for source that does not compile")
	}
}

func TestServiceRendersValidSource(t *testing.T) {
	svc := app.NewRenderService()
	res, err := svc.Render("a -> b", render.Options{})
	if err != nil {
		t.Fatalf("service returned error: %v", err)
	}
	if res.SVG == "" {
		t.Error("service returned empty SVG for valid source")
	}
}

func assertKeys(t *testing.T, name string, b []byte, want []string) {
	t.Helper()
	var m map[string]any
	if err := json.Unmarshal(b, &m); err != nil {
		t.Fatalf("unmarshal %s: %v", name, err)
	}
	got := make([]string, 0, len(m))
	for k := range m {
		got = append(got, k)
	}
	sort.Strings(got)
	if len(got) != len(want) {
		t.Fatalf("%s JSON keys = %v, want %v", name, got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("%s JSON keys = %v, want %v", name, got, want)
			return
		}
	}
}
