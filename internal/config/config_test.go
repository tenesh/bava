package config_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/tenesh/bava/internal/config"
)

func TestDefaultsWhenTheFileIsAbsent(t *testing.T) {
	settings, err := config.LoadFrom(filepath.Join(t.TempDir(), "settings.json"))
	if err != nil {
		t.Fatalf("LoadFrom: %v", err)
	}
	if settings.DebounceMS != config.Defaults().DebounceMS {
		t.Errorf("DebounceMS = %d, want the default", settings.DebounceMS)
	}
	if settings.LayoutEngine != config.Defaults().LayoutEngine {
		t.Errorf("LayoutEngine = %q, want the default", settings.LayoutEngine)
	}
}

func TestRoundTrip(t *testing.T) {
	path := filepath.Join(t.TempDir(), "settings.json")
	want := config.Settings{DebounceMS: 400, LayoutEngine: "dagre"}

	if err := config.SaveTo(path, want); err != nil {
		t.Fatalf("SaveTo: %v", err)
	}
	got, err := config.LoadFrom(path)
	if err != nil {
		t.Fatalf("LoadFrom: %v", err)
	}
	if got != want {
		t.Errorf("round trip: got %+v, want %+v", got, want)
	}
}

// A settings file someone hand-edited into invalid JSON must not stop the app
// starting. Settings are a preference; the app is the point.
func TestMalformedFileFallsBackToDefaults(t *testing.T) {
	path := filepath.Join(t.TempDir(), "settings.json")
	if err := os.WriteFile(path, []byte("{not json"), 0o644); err != nil {
		t.Fatal(err)
	}

	settings, err := config.LoadFrom(path)
	if err != nil {
		t.Fatalf("LoadFrom returned an error rather than falling back: %v", err)
	}
	if settings != config.Defaults() {
		t.Errorf("settings = %+v, want defaults", settings)
	}
}

// A partial file is the normal case once a newer version adds a key.
func TestMissingKeysTakeTheirDefault(t *testing.T) {
	path := filepath.Join(t.TempDir(), "settings.json")
	if err := os.WriteFile(path, []byte(`{"debounceMs": 500}`), 0o644); err != nil {
		t.Fatal(err)
	}

	settings, err := config.LoadFrom(path)
	if err != nil {
		t.Fatal(err)
	}
	if settings.DebounceMS != 500 {
		t.Errorf("DebounceMS = %d", settings.DebounceMS)
	}
	if settings.LayoutEngine != config.Defaults().LayoutEngine {
		t.Errorf("LayoutEngine = %q, want the default", settings.LayoutEngine)
	}
}

// Nonsense values would otherwise reach the render pipeline and the debounce.
func TestInvalidValuesAreRejected(t *testing.T) {
	path := filepath.Join(t.TempDir(), "settings.json")
	if err := os.WriteFile(path, []byte(`{"debounceMs": -1, "layoutEngine": "nomnoml"}`), 0o644); err != nil {
		t.Fatal(err)
	}

	settings, err := config.LoadFrom(path)
	if err != nil {
		t.Fatal(err)
	}
	if settings.DebounceMS != config.Defaults().DebounceMS {
		t.Errorf("a negative debounce was accepted: %d", settings.DebounceMS)
	}
	if settings.LayoutEngine != config.Defaults().LayoutEngine {
		t.Errorf("an unknown engine was accepted: %q", settings.LayoutEngine)
	}
}

func TestPathIsUnderTheUsersConfigDirectory(t *testing.T) {
	path, err := config.Path()
	if err != nil {
		t.Fatalf("Path: %v", err)
	}
	if filepath.Base(path) != "settings.json" {
		t.Errorf("path = %q", path)
	}
	if !filepath.IsAbs(path) {
		t.Errorf("path %q is not absolute", path)
	}
}
