package layout_test

import (
	"strings"
	"testing"

	"github.com/tenesh/bava/internal/layout"
)

// TALA is the default engine. dagre and elk are user-selectable alternatives,
// never fallbacks, so an empty engine name must resolve to TALA specifically
// and not to whichever engine happens to be first in a switch.
func TestResolveDefaultsToTALA(t *testing.T) {
	engine, err := layout.Resolve("")
	if err != nil {
		t.Fatalf("Resolve(%q) returned error: %v", "", err)
	}
	if engine.Name != "tala" {
		t.Errorf("Resolve(%q).Name = %q, want %q", "", engine.Name, "tala")
	}
	if engine.Layout == nil {
		t.Error("Resolve(\"\").Layout is nil, want a layout function")
	}
}

func TestResolveNamedEngines(t *testing.T) {
	for _, tc := range []struct {
		name string
		want string
	}{
		{name: "tala", want: "tala"},
		{name: "dagre", want: "dagre"},
		{name: "elk", want: "elk"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			engine, err := layout.Resolve(tc.name)
			if err != nil {
				t.Fatalf("Resolve(%q) returned error: %v", tc.name, err)
			}
			if engine.Name != tc.want {
				t.Errorf("Resolve(%q).Name = %q, want %q", tc.name, engine.Name, tc.want)
			}
			if engine.Layout == nil {
				t.Errorf("Resolve(%q).Layout is nil, want a layout function", tc.name)
			}
		})
	}
}

// A misspelled engine must fail loudly. Silently falling back to TALA would
// mean a typo changes layout engine and nobody notices for a month.
func TestResolveUnknownEngineReturnsError(t *testing.T) {
	_, err := layout.Resolve("nomnoml")
	if err == nil {
		t.Fatal("Resolve(\"nomnoml\") returned nil error, want an error")
	}
	if !strings.Contains(err.Error(), "nomnoml") {
		t.Errorf("error %q does not name the offending engine", err.Error())
	}
}

// d2lib.Compile takes a LayoutResolver of exactly this shape. The adapter is
// what lets internal/render hand our resolver straight to D2.
func TestResolverAdaptsToD2(t *testing.T) {
	resolver := layout.Resolver()
	layoutFn, err := resolver("dagre")
	if err != nil {
		t.Fatalf("Resolver()(%q) returned error: %v", "dagre", err)
	}
	if layoutFn == nil {
		t.Fatal("Resolver()(\"dagre\") returned nil layout function")
	}
	if _, err := resolver("nomnoml"); err == nil {
		t.Error("Resolver()(\"nomnoml\") returned nil error, want an error")
	}
}
