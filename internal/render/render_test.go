package render_test

import (
	"context"
	"strings"
	"testing"

	"github.com/tenesh/bava/internal/render"
)

const validSource = `users: Users
web: Web App
users -> web: request
`

func TestRenderReturnsSVGForValidSource(t *testing.T) {
	res, err := render.Render(context.Background(), validSource, render.Options{})
	if err != nil {
		t.Fatalf("Render returned error: %v", err)
	}
	if res.SVG == "" {
		t.Fatal("Render returned empty SVG for valid source")
	}
	if len(res.Errors) != 0 {
		t.Errorf("Render reported %d errors for valid source: %v", len(res.Errors), res.Errors)
	}
}

// The canvas injects this string into a div it owns. An XML declaration is
// invalid in that position, so D2's default output cannot be used as-is.
func TestRenderOmitsXMLDeclaration(t *testing.T) {
	res, err := render.Render(context.Background(), validSource, render.Options{})
	if err != nil {
		t.Fatalf("Render returned error: %v", err)
	}
	if !strings.HasPrefix(res.SVG, "<svg") {
		t.Errorf("SVG starts with %q, want it to start with %q", first(res.SVG, 40), "<svg")
	}
}

// D2 stamps a build-time version that does not track the module version: it
// reports v0.8.1-HEAD while we run v0.9.0. Recording that in a golden file
// would commit a false fact, so it is omitted at the source.
func TestRenderOmitsStaleVersionAttribute(t *testing.T) {
	res, err := render.Render(context.Background(), validSource, render.Options{})
	if err != nil {
		t.Fatalf("Render returned error: %v", err)
	}
	if strings.Contains(res.SVG, "data-d2-version") {
		t.Error("SVG contains data-d2-version, which is stale and must be omitted")
	}
}

func TestRenderHonoursSelectedEngine(t *testing.T) {
	tala, err := render.Render(context.Background(), validSource, render.Options{Engine: "tala"})
	if err != nil {
		t.Fatalf("Render(tala) returned error: %v", err)
	}
	dagre, err := render.Render(context.Background(), validSource, render.Options{Engine: "dagre"})
	if err != nil {
		t.Fatalf("Render(dagre) returned error: %v", err)
	}
	if tala.SVG == dagre.SVG {
		t.Error("tala and dagre produced identical SVG, so the engine option is being ignored")
	}
}

// An unrecognised engine is a programming error in the caller, not a diagram
// problem, so it comes back as a real error rather than in Result.Errors.
func TestRenderUnknownEngineReturnsError(t *testing.T) {
	_, err := render.Render(context.Background(), validSource, render.Options{Engine: "nomnoml"})
	if err == nil {
		t.Fatal("Render with unknown engine returned nil error")
	}
	if !strings.Contains(err.Error(), "nomnoml") {
		t.Errorf("error %q does not name the offending engine", err.Error())
	}
}

func first(s string, n int) string {
	if len(s) < n {
		return s
	}
	return s[:n]
}

// Direction comes from the dialog's control. It applies only when the source
// sets none: the code the user wrote wins. dagre honours
// direction; TALA ignores it, which is why the control hides for TALA.
func TestRenderAppliesDirection(t *testing.T) {
	cases := []struct {
		name, source, direction string
		rightward               bool
	}{
		{"right lays out left to right", "a -> b", "right", true},
		{"down lays out top to bottom", "a -> b", "down", false},
		{"the source's own direction wins", "direction: down\na -> b", "right", false},
		// Quoted, "direction" is a shape's name, not the keyword: the option applies.
		{"a quoted direction is a shape, not a setting", "\"direction\": down\na -> b", "right", true},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			result, err := render.Render(context.Background(), c.source, render.Options{Engine: "dagre", Direction: c.direction})
			if err != nil {
				t.Fatal(err)
			}
			at := map[string]render.LayoutShape{}
			for _, shape := range result.Layout.Shapes {
				at[shape.ID] = shape
			}
			a, b := at["a"], at["b"]
			rightward := b.X > a.X+a.W/2 && b.Y < a.Y+a.H
			if rightward != c.rightward {
				t.Errorf("a at (%v, %v), b at (%v, %v): rightward = %v, want %v", a.X, a.Y, b.X, b.Y, rightward, c.rightward)
			}
		})
	}
}

// Appending the direction must not move anything the user wrote: every
// diagnostic still points at its own line.
func TestRenderDirectionKeepsDiagnosticLines(t *testing.T) {
	// Parses (so the direction is appended) but does not compile: the error
	// is on line 2, and would be on line 3 if the direction were prepended.
	result, err := render.Render(context.Background(), "a -> b\nb.style.fill: 5\n", render.Options{Engine: "dagre", Direction: "right"})
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Errors) == 0 || result.Errors[0].Line != 2 {
		t.Errorf("diagnostics %+v should point at line 2, where the fault is", result.Errors)
	}
}

func TestRenderUnknownDirectionReturnsError(t *testing.T) {
	_, err := render.Render(context.Background(), validSource, render.Options{Direction: "sideways"})
	if err == nil || !strings.Contains(err.Error(), "sideways") {
		t.Fatalf("got %v, want an error naming the direction", err)
	}
}
