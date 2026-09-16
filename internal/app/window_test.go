package app_test

import (
	"testing"

	"github.com/tenesh/bava/internal/app"
)

// Pinned rather than asserted for correctness: the point is that a later edit
// to the window size is a deliberate act with a test to update, not a silent
// drift back to something too narrow for four panes.
func TestWindowFitsFourRegions(t *testing.T) {
	if app.WindowWidth < 1280 {
		t.Errorf("WindowWidth = %d, want at least 1280 — the width the shell was designed against", app.WindowWidth)
	}
	if app.WindowHeight < 800 {
		t.Errorf("WindowHeight = %d, want at least 800", app.WindowHeight)
	}
}
