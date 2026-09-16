package render_test

import (
	"context"
	"flag"
	"os"
	"path/filepath"
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
func TestGolden(t *testing.T) {
	for _, name := range []string{"architecture", "containers"} {
		t.Run(name, func(t *testing.T) {
			sourcePath := filepath.Join("..", "..", "testdata", "golden", name+".d2")
			goldenPath := filepath.Join("..", "..", "testdata", "golden", name+".svg")

			source, err := os.ReadFile(sourcePath)
			if err != nil {
				t.Fatalf("read fixture: %v", err)
			}

			res, err := render.Render(context.Background(), string(source), render.Options{})
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
