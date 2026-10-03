package render_test

import (
	"context"
	"strings"
	"testing"

	"github.com/tenesh/bava/internal/render"
	"github.com/tenesh/bava/internal/testutil"
)

// Golden files are the primary safety net: they are what makes a D2, font or
// Wails bump safe to do at all. Compared byte-for-byte, with no normalisation:
// output was measured stable across processes, so any scrubbing step would
// only hide a real regression. -update rewrites them.
func TestRenderMatchesGoldenSVG(t *testing.T) {
	cases := []struct {
		name  string
		theme *render.Theme
	}{
		{name: "architecture"},
		{name: "containers"},
		{name: "architecture-dark", theme: darkTheme()},
		{name: "containers-dark", theme: darkTheme()},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			// The dark fixtures render the same source as their light
			// counterparts, so a difference can only come from the theme.
			sourceName := strings.TrimSuffix(tc.name, "-dark")
			source := testutil.ReadRepoFile(t, "testdata/golden/"+sourceName+".d2")

			res, err := render.Render(context.Background(), source, render.Options{Theme: tc.theme})
			if err != nil {
				t.Fatalf("Render returned error: %v", err)
			}
			if len(res.Errors) != 0 {
				t.Fatalf("fixture does not compile: %v", res.Errors)
			}
			testutil.Golden(t, testutil.RepoPath(t, "testdata/golden", tc.name+".svg"), res.SVG)
		})
	}
}
