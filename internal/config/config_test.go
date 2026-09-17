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
	want := config.Settings{DebounceMS: 400, LayoutEngine: "dagre", Autosave: config.AutosaveAfterDelay, AutosaveDelayMS: 2500}

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

// Autosave writes to the user's files without being asked. It is opt-in.
func TestAutosaveDefaultsToOff(t *testing.T) {
	settings := config.Defaults()
	if settings.Autosave != config.AutosaveOff {
		t.Errorf("Autosave = %q, want %q", settings.Autosave, config.AutosaveOff)
	}
	if settings.AutosaveDelayMS != 1000 {
		t.Errorf("AutosaveDelayMS = %d, want 1000", settings.AutosaveDelayMS)
	}
}

// A mode this version does not know (a typo, or a newer version's setting)
// must not turn into some other kind of autosave. Off is the only safe guess.
func TestUnknownAutosaveModeFallsBackToOff(t *testing.T) {
	path := filepath.Join(t.TempDir(), "settings.json")
	if err := os.WriteFile(path, []byte(`{"autosave": "onWindowChange"}`), 0o644); err != nil {
		t.Fatal(err)
	}
	settings, err := config.LoadFrom(path)
	if err != nil {
		t.Fatalf("LoadFrom: %v", err)
	}
	if settings.Autosave != config.AutosaveOff {
		t.Errorf("Autosave = %q, want off", settings.Autosave)
	}
}

func TestAutosaveDelayIsClampedToASensibleRange(t *testing.T) {
	cases := []struct {
		name string
		in   int
		want int
	}{
		{"zero takes the default", 0, 1000},
		{"negative takes the default", -5, 1000},
		{"too fast writes on every keystroke", 10, config.MinAutosaveDelayMS},
		{"in range is kept", 3000, 3000},
		{"too slow is not autosave any more", 10_000_000, config.MaxAutosaveDelayMS},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			path := filepath.Join(t.TempDir(), "settings.json")
			if err := config.SaveTo(path, config.Settings{AutosaveDelayMS: tc.in}); err != nil {
				t.Fatal(err)
			}
			got, err := config.LoadFrom(path)
			if err != nil {
				t.Fatal(err)
			}
			if got.AutosaveDelayMS != tc.want {
				t.Errorf("AutosaveDelayMS = %d, want %d", got.AutosaveDelayMS, tc.want)
			}
		})
	}
}

// Verbose logging records more detail (still never content) and is opt-in.
func TestVerboseLoggingDefaultsToOff(t *testing.T) {
	if config.Defaults().VerboseLogging {
		t.Error("VerboseLogging defaults to on")
	}
	path := filepath.Join(t.TempDir(), "settings.json")
	if err := config.SaveTo(path, config.Settings{VerboseLogging: true}); err != nil {
		t.Fatal(err)
	}
	got, err := config.LoadFrom(path)
	if err != nil {
		t.Fatal(err)
	}
	if !got.VerboseLogging {
		t.Error("VerboseLogging did not survive a save")
	}
}
