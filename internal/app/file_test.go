package app_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/tenesh/bava/internal/app"
	"github.com/tenesh/bava/internal/config"
	"github.com/tenesh/bava/internal/format"
)

func TestOpenReturnsProseAndScene(t *testing.T) {
	path := filepath.Join(t.TempDir(), "notes.md")
	source := "# T\n\n```d2 id=a\nx -> y\n```\n"
	if err := os.WriteFile(path, []byte(source), 0o644); err != nil {
		t.Fatal(err)
	}

	result := app.NewFileService(app.FileServiceOptions{}).Open(path)

	if result.Error != "" {
		t.Fatalf("Error = %q", result.Error)
	}
	if result.Source != source {
		t.Errorf("Source = %q", result.Source)
	}
	if result.Diagrams["a"] != "x -> y\n" {
		t.Errorf("Diagrams = %v", result.Diagrams)
	}
}

// A missing file is something the user can act on, so it is data rather than
// a failed call, the same shape as a compile diagnostic.
func TestOpenMissingFileReportsInError(t *testing.T) {
	result := app.NewFileService(app.FileServiceOptions{}).Open(filepath.Join(t.TempDir(), "absent.md"))
	if result.Error == "" {
		t.Fatal("expected an error message")
	}
	if !strings.Contains(result.Error, "absent.md") {
		t.Errorf("Error = %q, want it to name the file", result.Error)
	}
}

func TestSaveThenOpenRoundTrips(t *testing.T) {
	path := filepath.Join(t.TempDir(), "notes.md")
	service := app.NewFileService(app.FileServiceOptions{})
	scene := format.Scene{
		Version:  format.Version,
		Elements: []format.Element{{ID: "e1", Type: "rect", W: 10, H: 10, Z: 1}},
	}

	saved := service.Save(path, "# T\n\nProse.\n", scene)
	if saved.Error != "" {
		t.Fatalf("Save error: %q", saved.Error)
	}

	opened := service.Open(path)
	if opened.Error != "" {
		t.Fatalf("Open error: %q", opened.Error)
	}
	if len(opened.Scene.Elements) != 1 || opened.Scene.Elements[0].ID != "e1" {
		t.Errorf("scene did not round trip: %+v", opened.Scene)
	}
	if !strings.HasPrefix(opened.Source, "# T\n\nProse.\n") {
		t.Errorf("prose did not survive: %q", opened.Source)
	}
}

func TestChangedOnDiskNoticesAnotherWriter(t *testing.T) {
	path := filepath.Join(t.TempDir(), "notes.md")
	service := app.NewFileService(app.FileServiceOptions{})
	saved := service.Save(path, "one\n", format.Scene{})
	if saved.Error != "" {
		t.Fatal(saved.Error)
	}

	if service.ChangedOnDisk(path, saved.Stamp) {
		t.Error("an untouched file was reported as changed")
	}

	if err := os.WriteFile(path, []byte("someone else\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if !service.ChangedOnDisk(path, saved.Stamp) {
		t.Error("an externally rewritten file was not reported as changed")
	}
}

// configIn points the platform's config folder into a temporary one, so the
// user's own settings are never read or written.
func configIn(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	// os.UserConfigDir reads HOME on macOS, XDG_CONFIG_HOME on Linux and
	// AppData on Windows.
	t.Setenv("HOME", dir)
	t.Setenv("XDG_CONFIG_HOME", dir)
	t.Setenv("AppData", dir)
	path, err := config.Path()
	if err != nil {
		t.Fatal(err)
	}
	if rel, err := filepath.Rel(dir, path); err != nil || strings.HasPrefix(rel, "..") {
		t.Fatalf("settings would live at %s, outside the test's folder", path)
	}
	return path
}

func TestSettingsSavedAreTheSettingsRead(t *testing.T) {
	path := configIn(t)
	service := app.NewFileService(app.FileServiceOptions{})
	want := config.Defaults()
	want.Autosave = config.AutosaveAfterDelay
	want.PageWidth = "narrow"

	if msg := service.SaveSettings(want); msg != "" {
		t.Fatal(msg)
	}
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("no settings file: %v", err)
	}
	if got := service.Settings(); got != want {
		t.Errorf("Settings = %+v, want %+v", got, want)
	}
}

func TestSettingsWithNoFileAreTheDefaults(t *testing.T) {
	configIn(t)
	if got := app.NewFileService(app.FileServiceOptions{}).Settings(); got != config.Defaults() {
		t.Errorf("Settings = %+v, want the defaults", got)
	}
}
