package e2e_test

import (
	"path/filepath"
	"testing"

	"github.com/tenesh/bava/internal/e2e"
)

// The committed scenarios parse, so a typo fails here rather than on CI.
func TestTheCommittedScenariosParse(t *testing.T) {
	files, err := filepath.Glob("../../tests/e2e/scenarios/*.json")
	if err != nil || len(files) == 0 {
		t.Fatalf("no scenarios found: %v", err)
	}
	for _, file := range files {
		if _, err := e2e.Load(file, map[string]string{"SCRATCH": "/tmp/scratch"}); err != nil {
			t.Errorf("%s: %v", file, err)
		}
	}
}
