package render_test

import (
	"context"
	"flag"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/tenesh/bava/internal/render"
)

// -update rewrites the committed SVG. Use it only after deciding the new
// output is correct, which means opening the file and looking at it. A golden
// regenerated because the test went red asserts nothing.
var update = flag.Bool("update", false, "rewrite golden SVG files")

// Golden files are the primary safety net: they are what makes a D2, font or
// Wails bump safe to do at all. Compared byte-for-byte, with no normalisation
// — output was measured stable across processes, so any scrubbing step would
// only hide a real regression.
// The dark values, from frontend/src/styles/tokens/_color.scss. The token
// layer is the source of truth; this is the fixture that proves the mapping
// reaches the renderer.
func goldenDarkTheme() *render.Theme {
	return &render.Theme{
		Background:    "#1b1c1f",
		ContainerFill: "#1e2023",
		NodeFill:      "#262a2f",
		NodeStroke:    "#4a5058",
		Label:         "#dcdcd8",
		Edge:          "#7f857f",
		EdgeLabel:     "#8b8f8a",
	}
}

func TestGolden(t *testing.T) {
	cases := []struct {
		name  string
		theme *render.Theme
	}{
		{name: "architecture"},
		{name: "containers"},
		{name: "architecture-dark", theme: goldenDarkTheme()},
		{name: "containers-dark", theme: goldenDarkTheme()},
	}
	for _, tc := range cases {
		name := tc.name
		t.Run(name, func(t *testing.T) {
			// The dark fixtures render the same source as their light
			// counterparts, so a difference can only come from the theme.
			sourceName := strings.TrimSuffix(name, "-dark")
			sourcePath := filepath.Join("..", "..", "testdata", "golden", sourceName+".d2")
			goldenPath := filepath.Join("..", "..", "testdata", "golden", name+".svg")

			source, err := os.ReadFile(sourcePath)
			if err != nil {
				t.Fatalf("read fixture: %v", err)
			}

			res, err := render.Render(context.Background(), string(source), render.Options{Theme: tc.theme})
			if err != nil {
				t.Fatalf("Render returned error: %v", err)
			}
			if len(res.Errors) != 0 {
				t.Fatalf("fixture does not compile: %v", res.Errors)
			}

			if *update {
				if err := os.WriteFile(goldenPath, []byte(res.SVG), 0o644); err != nil {
					t.Fatalf("write golden: %v", err)
				}
				t.Logf("wrote %s — open it and look at it before committing", goldenPath)
				return
			}

			want, err := os.ReadFile(goldenPath)
			if err != nil {
				t.Fatalf("read golden (regenerate with -update, then review it by eye): %v", err)
			}
			if res.SVG != string(want) {
				t.Errorf("rendered SVG differs from %s (%d bytes vs %d). If this change is intended, regenerate with -update and review the diff by eye.",
					goldenPath, len(res.SVG), len(want))
			}
		})
	}
}
