package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/tenesh/bava/internal/app"
	"github.com/tenesh/bava/internal/logs"
)

// On macOS [NSApp terminate:] exits the process once Wails' cleanup has run,
// so wailsApp.Run never returns and nothing after it runs. The session must
// close from PostShutdown, the last step of that cleanup, or every quit is
// reported as a crash at the next launch.
func TestPostShutdownClosesTheSession(t *testing.T) {
	dir := t.TempDir()
	session, err := logs.Start(logs.Options{Dir: dir, Now: time.Date(2026, 9, 17, 10, 0, 0, 0, time.UTC), PID: 42})
	if err != nil {
		t.Fatal(err)
	}

	options := appOptions(session, nil, func(app.AppError) {})
	if options.PostShutdown == nil {
		t.Fatal("PostShutdown is not set")
	}
	options.PostShutdown()

	markers, _ := filepath.Glob(filepath.Join(dir, "*.running"))
	if len(markers) != 0 {
		t.Errorf("session marker left after shutdown: %v", markers)
	}
	body, err := os.ReadFile(session.Path())
	if err != nil {
		t.Fatalf("session log missing: %v", err)
	}
	if n := strings.Count(string(body), "session end"); n != 1 {
		t.Errorf("session end logged %d times, want 1", n)
	}

	// What the user sees: the next launch does not report a crash.
	next, err := logs.Start(logs.Options{Dir: dir, Now: time.Date(2026, 9, 17, 10, 1, 0, 0, time.UTC), PID: 43})
	if err != nil {
		t.Fatal(err)
	}
	defer next.Close()
	if next.Previous.Unexpected {
		t.Error("a quit through PostShutdown was reported as unexpected at the next launch")
	}
}
