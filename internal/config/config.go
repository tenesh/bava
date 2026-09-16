// Package config holds user preferences.
//
// Preferences are Bava's own state, not the user's work: they live in the
// platform config directory rather than in a document, and losing them costs a
// preference rather than a file. A settings file that cannot be read never
// stops the app starting.
package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/tenesh/bava/internal/layout"
)

// Settings are the values a user can change.
//
// The render values started life as compile-time constants in Milestone 1 and
// are named here so a change is a preference rather than a rebuild.
type Settings struct {
	// DebounceMS is the quiet period before a render is issued. 250 is the
	// measured value: dagre 12ms, elk 7ms, TALA 96ms on a ~25 node diagram.
	DebounceMS int `json:"debounceMs"`
	// LayoutEngine is the default for diagrams that do not name one.
	LayoutEngine string `json:"layoutEngine"`
	// Autosave is when an open, titled document is written without being
	// asked: never, a quiet period after the last change, or when the window
	// loses focus. The names follow VS Code's files.autoSave.
	Autosave string `json:"autosave"`
	// AutosaveDelayMS is the quiet period for AutosaveAfterDelay.
	AutosaveDelayMS int `json:"autosaveDelayMs"`
}

// Autosave modes.
const (
	AutosaveOff           = "off"
	AutosaveAfterDelay    = "afterDelay"
	AutosaveOnFocusChange = "onFocusChange"
)

// The autosave delay's range. Below the minimum a save lands mid-word; above
// the maximum it is not autosave in any sense a user would recognise.
const (
	MinAutosaveDelayMS = 200
	MaxAutosaveDelayMS = 60_000
)

// Defaults are what a fresh install uses.
func Defaults() Settings {
	return Settings{
		DebounceMS:   250,
		LayoutEngine: layout.DefaultEngine,
		// Off: writing to someone's files unasked is a choice they make.
		Autosave:        AutosaveOff,
		AutosaveDelayMS: 1000,
	}
}

// Path is where settings live on this platform.
func Path() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", fmt.Errorf("locate config directory: %w", err)
	}
	return filepath.Join(dir, "bava", "settings.json"), nil
}

// Load reads the user's settings, falling back to defaults.
func Load() (Settings, error) {
	path, err := Path()
	if err != nil {
		return Defaults(), err
	}
	return LoadFrom(path)
}

// LoadFrom reads settings from a specific file.
//
// A missing, unreadable or malformed file yields defaults and no error: a
// preference file someone hand-edited badly must not stop the app starting.
// Individual values that make no sense are replaced the same way.
func LoadFrom(path string) (Settings, error) {
	settings := Defaults()

	content, err := os.ReadFile(path)
	if err != nil {
		return settings, nil
	}

	// Decoded over the defaults, so a key the file omits keeps its default —
	// which is the normal case once a newer version adds one.
	if err := json.Unmarshal(content, &settings); err != nil {
		return Defaults(), nil
	}

	return sanitise(settings), nil
}

// SaveTo writes settings, creating the directory if needed.
//
// Unlike a document, this file is ours: creating its directory is expected
// rather than a surprise.
func SaveTo(path string, settings Settings) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("create config directory: %w", err)
	}

	content, err := json.MarshalIndent(sanitise(settings), "", "  ")
	if err != nil {
		return fmt.Errorf("encode settings: %w", err)
	}
	if err := os.WriteFile(path, append(content, '\n'), 0o644); err != nil {
		return fmt.Errorf("write settings: %w", err)
	}
	return nil
}

// sanitise replaces values that would otherwise reach the render pipeline or
// the debounce as nonsense.
func sanitise(settings Settings) Settings {
	if settings.DebounceMS <= 0 {
		settings.DebounceMS = Defaults().DebounceMS
	}
	if _, err := layout.Resolve(settings.LayoutEngine); err != nil {
		settings.LayoutEngine = Defaults().LayoutEngine
	}
	switch settings.Autosave {
	case AutosaveOff, AutosaveAfterDelay, AutosaveOnFocusChange:
	default:
		// Includes a mode from a newer version: never guess a different one.
		settings.Autosave = AutosaveOff
	}
	switch {
	case settings.AutosaveDelayMS <= 0:
		settings.AutosaveDelayMS = Defaults().AutosaveDelayMS
	case settings.AutosaveDelayMS < MinAutosaveDelayMS:
		settings.AutosaveDelayMS = MinAutosaveDelayMS
	case settings.AutosaveDelayMS > MaxAutosaveDelayMS:
		settings.AutosaveDelayMS = MaxAutosaveDelayMS
	}
	return settings
}
