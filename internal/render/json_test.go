package render_test

import (
	"testing"

	"github.com/tenesh/bava/internal/render"
	"github.com/tenesh/bava/internal/testutil"
)

// The frontend reads these names. A Go field renamed without its json tag
// would compile, pass every other test, and break the frontend silently.
func TestRenderTypesKeepTheirJSONKeys(t *testing.T) {
	cases := []struct {
		name  string
		value any
		keys  []string
	}{
		{"Result", render.Result{}, []string{"errors", "layout", "nodeMap", "svg"}},
		{"Diagnostic", render.Diagnostic{}, []string{"from", "line", "message", "to"}},
		{"Span", render.Span{}, []string{"from", "line", "to"}},
		// Colours are deliberately not among the layout's names: a generated
		// shape arrives in Bava's own style.
		{"Layout", render.Layout{}, []string{"connections", "shapes"}},
		// Populated, not zero: `omitempty` hides exactly the names the frontend
		// reads for nesting, labels and arrowheads.
		{"LayoutShape", render.LayoutShape{ID: "a.b", Type: "rectangle", Parent: "a", Label: "B", W: 1, H: 1},
			[]string{"h", "id", "label", "parent", "type", "w", "x", "y"}},
		{"LayoutConnection", render.LayoutConnection{
			ID: "(a -> b)[0]", Src: "a", Dst: "b", SrcArrow: "none", DstArrow: "triangle", Label: "sends",
			Route: []render.LayoutPoint{{X: 0, Y: 0}},
		}, []string{"dst", "dstArrow", "id", "label", "route", "src", "srcArrow"}},
		{"LayoutPoint", render.LayoutPoint{}, []string{"x", "y"}},
		// The frontend sends these; populated, as omitempty hides the rest.
		{"Options", render.Options{Engine: "elk", Direction: "right", Theme: darkTheme()},
			[]string{"direction", "engine", "theme"}},
		{"Theme", render.Theme{}, []string{"background", "containerFill", "edge", "edgeLabel", "label", "nodeFill", "nodeStroke"}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			testutil.AssertJSONKeys(t, tc.value, tc.keys...)
		})
	}
}
