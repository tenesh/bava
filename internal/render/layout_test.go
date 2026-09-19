package render_test

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/tenesh/bava/internal/render"
)

func containersSource(t *testing.T) string {
	t.Helper()
	source, err := os.ReadFile(filepath.Join("..", "..", "testdata", "golden", "containers.d2"))
	if err != nil {
		t.Fatal(err)
	}
	return string(source)
}

// The canvas builds shapes from this geometry, so every node and every edge
// in the diagram has to appear in it: a node that is missing is a box the
// user typed and never got.
func TestLayoutCarriesEveryNodeAndConnection(t *testing.T) {
	result, err := render.Render(context.Background(), containersSource(t), render.Options{})
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Errors) > 0 {
		t.Fatalf("the fixture did not compile: %+v", result.Errors)
	}

	shapes := map[string]render.LayoutShape{}
	for _, shape := range result.Layout.Shapes {
		shapes[shape.ID] = shape
	}

	// Two containers and six children, as the fixture declares.
	for _, id := range []string{
		"frontend", "frontend.editor", "frontend.canvas",
		"backend", "backend.compile", "backend.layout", "backend.render",
	} {
		shape, ok := shapes[id]
		if !ok {
			t.Errorf("%s is missing from the layout", id)
			continue
		}
		if shape.W <= 0 || shape.H <= 0 {
			t.Errorf("%s has no size: %+v", id, shape)
		}
		if shape.Label == "" {
			t.Errorf("%s lost its label", id)
		}
	}

	// A nested shape names the container it sits in, so conversion can put it
	// in a frame without parsing ids itself.
	if parent := shapes["frontend.editor"].Parent; parent != "frontend" {
		t.Errorf("frontend.editor parent = %q, want %q", parent, "frontend")
	}
	if parent := shapes["frontend"].Parent; parent != "" {
		t.Errorf("a top-level shape has parent %q, want none", parent)
	}

	if len(result.Layout.Connections) != 4 {
		t.Fatalf("connections = %d, want 4", len(result.Layout.Connections))
	}
	for _, connection := range result.Layout.Connections {
		if _, ok := shapes[connection.Src]; !ok {
			t.Errorf("connection %s starts at %q, which is not a shape", connection.ID, connection.Src)
		}
		if _, ok := shapes[connection.Dst]; !ok {
			t.Errorf("connection %s ends at %q, which is not a shape", connection.ID, connection.Dst)
		}
		if len(connection.Route) < 2 {
			t.Errorf("connection %s has no route", connection.ID)
		}
	}

	// The labelled edges keep their labels.
	labels := map[string]bool{}
	for _, connection := range result.Layout.Connections {
		if connection.Label != "" {
			labels[connection.Label] = true
		}
	}
	for _, want := range []string{"source", "svg"} {
		if !labels[want] {
			t.Errorf("no connection carries the label %q", want)
		}
	}
}

// Colours are deliberately absent: a generated shape arrives in Bava's own
// style, so nothing downstream can come to depend on D2's palette.
func TestLayoutCarriesNoColours(t *testing.T) {
	result, err := render.Render(context.Background(), containersSource(t), render.Options{})
	if err != nil {
		t.Fatal(err)
	}
	encoded, err := json.Marshal(result.Layout)
	if err != nil {
		t.Fatal(err)
	}
	lowered := strings.ToLower(string(encoded))
	for _, absent := range []string{"fill", "stroke", "opacity", "#"} {
		if strings.Contains(lowered, absent) {
			t.Errorf("the layout mentions %q: %s", absent, lowered)
		}
	}
}

// A source that does not compile has no layout to speak of, and says so the
// same way it says everything else: in Errors, with the call succeeding.
func TestLayoutIsEmptyWhenTheSourceDoesNotCompile(t *testing.T) {
	result, err := render.Render(context.Background(), "a -> ", render.Options{})
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Errors) == 0 {
		t.Fatal("want diagnostics for a broken source")
	}
	if len(result.Layout.Shapes) != 0 || len(result.Layout.Connections) != 0 {
		t.Errorf("layout = %+v, want nothing", result.Layout)
	}
}
