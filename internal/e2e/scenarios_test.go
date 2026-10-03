package e2e_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/tenesh/bava/internal/e2e"
	"github.com/tenesh/bava/internal/testutil"
)

// The committed scenarios parse, so a typo fails here rather than on CI.
func TestTheCommittedScenariosParse(t *testing.T) {
	repo := testutil.RepoRoot(t)
	files, err := filepath.Glob(filepath.Join(repo, "tests", "e2e", "scenarios", "*.json"))
	if err != nil || len(files) == 0 {
		t.Fatalf("no scenarios found: %v", err)
	}
	for _, file := range files {
		t.Run(filepath.Base(file), func(t *testing.T) {
			sc, err := e2e.Load(file, map[string]string{"SCRATCH": "/tmp/scratch", "REPO": repo})
			if err != nil {
				t.Fatal(err)
			}
			// A file a picker is answered with is in the repository.
			for _, answer := range sc.Files {
				for _, picked := range answer {
					if _, err := os.Stat(picked); err != nil {
						t.Error(err)
					}
				}
			}
		})
	}
}
