package app_test

import (
	"errors"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/wailsapp/wails/v3/pkg/application"

	"github.com/tenesh/bava/internal/app"
	"github.com/tenesh/bava/internal/logs"
	"github.com/tenesh/bava/internal/render"
)

// A log never contains document prose, D2 source, canvas content or labels,
// and never the home directory, at any level, including verbose. This runs
// the real services at debug level over a fixture full of sentinels and reads
// the whole log back.
func TestLogsNeverContainContent(t *testing.T) {
	home := t.TempDir()
	session, err := logs.Start(logs.Options{Dir: filepath.Join(home, "logs"), Home: home, Verbose: true})
	if err != nil {
		t.Fatal(err)
	}
	// Closed after the test: the log is read while it is open, but Windows
	// cannot delete an open file and t.TempDir's cleanup would fail.
	t.Cleanup(func() { _ = session.Close() })
	previous := slog.Default()
	slog.SetDefault(session.Logger)
	t.Cleanup(func() { slog.SetDefault(previous) })

	sentinels := []string{"PROSE-SENTINEL-7731", "D2LABEL-SENTINEL-4410", "CANVAS-TEXT-SENTINEL-9902", "SHAPE-LABEL-SENTINEL-1187"}
	content := "# Plan\n\nPROSE-SENTINEL-7731 is confidential.\n\n```d2 id=flow\na: D2LABEL-SENTINEL-4410\n```\n\n```bava-canvas\n{\n  \"version\": 1,\n  \"elements\": [\n    { \"id\": \"t1\", \"type\": \"text\", \"x\": 0, \"y\": 0, \"w\": 10, \"h\": 10, \"z\": 1, \"text\": \"CANVAS-TEXT-SENTINEL-9902\" },\n    { \"id\": \"r1\", \"type\": \"rect\", \"x\": 0, \"y\": 0, \"w\": 10, \"h\": 10, \"z\": 2, \"label\": \"SHAPE-LABEL-SENTINEL-1187\" }\n  ]\n}\n```\n"
	path := filepath.Join(home, "Documents", "secret-plan.md")
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}

	files := app.NewFileService()
	opened := files.Open(path)
	if opened.Error != "" {
		t.Fatal(opened.Error)
	}
	if saved := files.Save(path, opened.Source, opened.Scene); saved.Error != "" {
		t.Fatal(saved.Error)
	}
	// A path that does not exist, so an error path is logged too.
	files.Open(filepath.Join(home, "Documents", "missing-PROSE-SENTINEL-7731.md"))

	if _, err := app.NewRenderService().Render("a: D2LABEL-SENTINEL-4410\na -> b", render.Options{}); err != nil {
		t.Fatal(err)
	}
	app.NewRenderService().Render("a: D2LABEL-SENTINEL-4410 {", render.Options{})

	// A frontend report carries a kind and frames, never a message; a
	// sentinel in the stack's surrounding text stays out.
	logService := app.NewLogService(app.LogServiceOptions{Session: session})
	logService.Report(app.LogEntry{Level: "error", Kind: "SyntaxError", Stack: "parse@app.js:1:2", Source: "window"})

	app.PanicHandler(session.Logger, nil)(&application.PanicDetails{Error: errors.New("bound method failed"), StackTrace: "stack"})

	logged, err := os.ReadFile(session.Path())
	if err != nil {
		t.Fatal(err)
	}
	text := string(logged)

	for _, sentinel := range sentinels {
		// The missing file's *name* carries a sentinel; a path is not content,
		// but a file name can be, so it must not appear either.
		if strings.Contains(text, sentinel) {
			t.Errorf("log contains %q:\n%s", sentinel, text)
		}
	}
	if strings.Contains(text, home) {
		t.Errorf("log contains the home directory:\n%s", text)
	}
	// The services did log something at debug level; an empty log would pass
	// every check above and prove nothing.
	for _, want := range []string{"file opened", "file saved", "render", "bound method failed"} {
		if !strings.Contains(text, want) {
			t.Errorf("log is missing %q, so the test is not exercising it:\n%s", want, text)
		}
	}
}
