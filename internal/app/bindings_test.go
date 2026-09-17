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
	assertKeys(t, "Result", b, []string{"errors", "nodeMap", "svg"})
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
