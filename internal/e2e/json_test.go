package e2e_test

import (
	"testing"

	"github.com/tenesh/bava/internal/e2e"
	"github.com/tenesh/bava/internal/testutil"
)

// The page side of the driver reads these names.
func TestDriverTypesKeepTheirJSONKeys(t *testing.T) {
	cases := []struct {
		name  string
		value any
		keys  []string
	}{
		// Populated, not zero: omitempty hides the optional names.
		{"Scenario", e2e.Scenario{Name: "create", Folders: []string{"a"}, Files: [][]string{{"b"}}},
			[]string{"files", "folders", "name", "steps"}},
		{"Step", e2e.Step{Do: "drag", Target: "t", Text: "x", Name: "n", From: []float64{0}, To: []float64{1}, TimeoutMs: 1, Modifiers: []string{"shift"}},
			[]string{"do", "from", "modifiers", "name", "target", "text", "timeoutMs", "to"}},
		{"FileText", e2e.FileText{}, []string{"error", "text"}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			testutil.AssertJSONKeys(t, tc.value, tc.keys...)
		})
	}
}
