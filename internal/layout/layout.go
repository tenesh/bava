// Package layout resolves D2 layout engine names to layout functions.
//
// TALA is the default. dagre and elk are user-selectable alternatives, never
// fallbacks: an unrecognised name is an error, because a typo that silently
// changed the layout engine would not be noticed for a long time.
package layout

import (
	"fmt"

	"github.com/d2lang/d2/d2graph"
	"github.com/d2lang/d2/d2layouts/d2dagrelayout"
	"github.com/d2lang/d2/d2layouts/d2elklayout"
	"github.com/d2lang/d2/d2layouts/d2talalayout"
)

// DefaultEngine is the engine used when none is named. TALA produces markedly
// more compact architecture layouts than the alternatives. It ships inside the
// D2 module as of v0.9.0, so selecting it needs no external binary.
//
// TALA ignores `direction`; do not expose that control while it is active.
const DefaultEngine = "tala"

// Engine is a named layout algorithm.
type Engine struct {
	// Name is the canonical engine name, never empty.
	Name string
	// Layout runs the algorithm against a compiled graph, mutating it.
	Layout d2graph.LayoutGraph
}

// Engines lists the selectable engine names, in the order a picker should
// present them.
func Engines() []string {
	return []string{"tala", "dagre", "elk"}
}

// Resolve maps an engine name to its Engine. An empty name selects
// DefaultEngine. An unrecognised name is an error.
func Resolve(name string) (Engine, error) {
	if name == "" {
		name = DefaultEngine
	}
	switch name {
	case "tala":
		return Engine{Name: "tala", Layout: d2talalayout.DefaultLayout}, nil
	case "dagre":
		return Engine{Name: "dagre", Layout: d2dagrelayout.DefaultLayout}, nil
	case "elk":
		return Engine{Name: "elk", Layout: d2elklayout.DefaultLayout}, nil
	default:
		return Engine{}, fmt.Errorf("unknown layout engine %q: want one of tala, dagre, elk", name)
	}
}

// Resolver returns Resolve in the shape d2lib.CompileOptions.LayoutResolver
// expects, so the pipeline can hand D2 our resolver directly.
func Resolver() func(engine string) (d2graph.LayoutGraph, error) {
	return func(engine string) (d2graph.LayoutGraph, error) {
		e, err := Resolve(engine)
		if err != nil {
			return nil, err
		}
		return e.Layout, nil
	}
}
