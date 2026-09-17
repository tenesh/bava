package app

import (
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"

	"github.com/tenesh/bava/internal/config"
	"github.com/tenesh/bava/internal/format"
	"github.com/tenesh/bava/internal/store"
)

// FileService is the file surface. It stays thin: read, write, and tell the
// caller whether the file moved underneath them. Everything about *what* a
// file contains lives in internal/format.
type FileService struct{}

// NewFileService constructs the service registered with the application.
func NewFileService() *FileService { return &FileService{} }

// OpenResult is a file, parsed.
//
// Problems the user can act on — a missing file, a permission denial, a
// malformed canvas block — come back in Error rather than as a failed call,
// the same way compile diagnostics do. A returned error means the request
// itself was malformed.
type OpenResult struct {
	Path     string            `json:"path"`
	Source   string            `json:"source"`
	Diagrams map[string]string `json:"diagrams"`
	Scene    format.Scene      `json:"scene"`
	Stamp    store.Stamp       `json:"stamp"`
	Error    string            `json:"error"`
}

// SaveResult reports a completed write.
type SaveResult struct {
	Path  string      `json:"path"`
	Stamp store.Stamp `json:"stamp"`
	Error string      `json:"error"`
}

// Open reads and parses a file.
func (s *FileService) Open(path string) OpenResult {
	started := time.Now()
	file, err := store.Open(path)
	if err != nil {
		// Never the path or the error text: a file name can be content, and
		// the message carries the path. The frontend shows the user both.
		slog.Debug("file open failed", "duration", time.Since(started))
		return OpenResult{Path: path, Error: err.Error()}
	}

	parsed, err := format.Read(file.Content)
	// A malformed canvas block still yields the prose, so the user sees their
	// document rather than an empty window.
	result := OpenResult{
		Path:     path,
		Source:   parsed.Source,
		Diagrams: parsed.Diagrams,
		Scene:    parsed.Scene,
		Stamp:    file.Stamp,
	}
	if err != nil {
		result.Error = err.Error()
	}
	slog.Debug("file opened",
		"bytes", len(file.Content),
		"elements", len(parsed.Scene.Elements),
		"canvasReadable", err == nil,
		"duration", time.Since(started),
	)
	return result
}

// Save writes a file, replacing only the canvas block within it.
func (s *FileService) Save(path string, source string, scene format.Scene) SaveResult {
	started := time.Now()
	file := format.File{Source: source, Scene: scene}

	rendered, err := format.Write(file)
	if err != nil {
		slog.Debug("file save failed", "stage", "encode", "duration", time.Since(started))
		return SaveResult{Path: path, Error: fmt.Sprintf("render: %v", err)}
	}
	if err := store.Save(path, rendered); err != nil {
		slog.Debug("file save failed", "stage", "write", "duration", time.Since(started))
		return SaveResult{Path: path, Error: err.Error()}
	}

	saved, err := store.Open(path)
	if err != nil {
		slog.Debug("file save failed", "stage", "reread", "duration", time.Since(started))
		return SaveResult{Path: path, Error: err.Error()}
	}
	slog.Debug("file saved", "bytes", len(rendered), "elements", len(scene.Elements), "duration", time.Since(started))
	return SaveResult{Path: path, Stamp: saved.Stamp}
}

// ChangedOnDisk reports whether the file moved underneath the editor.
func (s *FileService) ChangedOnDisk(path string, stamp store.Stamp) bool {
	changed, err := store.ChangedOnDisk(path, stamp)
	if err != nil {
		// A file that has vanished has certainly changed.
		return true
	}
	return changed
}

// Settings returns the user's preferences, falling back to defaults.
//
// The frontend reads these once at start-up: the debounce and the default
// layout engine were compile-time constants until Milestone 5.
func (s *FileService) Settings() config.Settings {
	settings, err := config.Load()
	if err != nil {
		// Locating the config directory failed; defaults still work.
		return config.Defaults()
	}
	return settings
}

// SaveSettings writes the user's preferences.
func (s *FileService) SaveSettings(settings config.Settings) string {
	path, err := config.Path()
	if err != nil {
		return err.Error()
	}
	if err := config.SaveTo(path, settings); err != nil {
		return err.Error()
	}
	return ""
}

// ChooseFileToOpen shows the native open dialog.
//
// Cancelling is not an error: an empty path means the user changed their mind,
// which is a normal outcome and not something to report as a failure.
func (s *FileService) ChooseFileToOpen() DialogResult {
	dialog := application.Get().Dialog.OpenFile()
	dialog.SetTitle("Open")
	dialog.CanChooseFiles(true)
	dialog.CanChooseDirectories(false)

	path, err := dialog.PromptForSingleSelection()
	if err != nil {
		return DialogResult{Error: err.Error()}
	}
	return DialogResult{Path: path}
}

// ChooseFileToSave shows the native save dialog.
func (s *FileService) ChooseFileToSave(suggestedName string) DialogResult {
	dialog := application.Get().Dialog.SaveFile()
	dialog.SetMessage("Save As")
	if suggestedName != "" {
		dialog.SetFilename(suggestedName)
	}

	path, err := dialog.PromptForSingleSelection()
	if err != nil {
		return DialogResult{Error: err.Error()}
	}
	return DialogResult{Path: path}
}

// DialogResult is a chosen path, or an empty one when the user cancelled.
type DialogResult struct {
	Path  string `json:"path"`
	Error string `json:"error"`
}

// Entry is a file or folder in a workspace.
type Entry struct {
	Name  string `json:"name"`
	Path  string `json:"path"`
	IsDir bool   `json:"isDir"`
}

// ListWorkspace lists the Bava files and folders directly under dir.
//
// Only `.md` and `.d2`: a workspace is usually a project folder full of things
// Bava has no business showing. Folders are listed whatever they contain,
// because the files inside are only discovered on expansion.
func (s *FileService) ListWorkspace(dir string) ListResult {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return ListResult{Error: err.Error()}
	}

	var out []Entry
	for _, entry := range entries {
		name := entry.Name()
		// Hidden entries are Bava's own state or the user's tooling.
		if strings.HasPrefix(name, ".") {
			continue
		}
		if !entry.IsDir() && !isBavaFile(name) {
			continue
		}
		out = append(out, Entry{
			Name:  name,
			Path:  filepath.Join(dir, name),
			IsDir: entry.IsDir(),
		})
	}

	// Folders first, then files, each alphabetically — the order a person
	// scanning a sidebar expects.
	sort.Slice(out, func(i, j int) bool {
		if out[i].IsDir != out[j].IsDir {
			return out[i].IsDir
		}
		return strings.ToLower(out[i].Name) < strings.ToLower(out[j].Name)
	})

	return ListResult{Entries: out}
}

// ListResult is a workspace listing.
type ListResult struct {
	Entries []Entry `json:"entries"`
	Error   string  `json:"error"`
}

func isBavaFile(name string) bool {
	switch strings.ToLower(filepath.Ext(name)) {
	case ".md", ".d2":
		return true
	default:
		return false
	}
}
