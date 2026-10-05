package app

import (
	"encoding/base64"
	"fmt"
	"log/slog"
	"path/filepath"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"

	"github.com/tenesh/bava/internal/config"
	"github.com/tenesh/bava/internal/format"
	"github.com/tenesh/bava/internal/store"
)

// FileService is the file surface. It stays thin: read, write, and tell the
// caller whether the file moved underneath them. Everything about *what* a
// file contains lives in internal/format.
type FileService struct {
	options FileServiceOptions
}

// FileServiceOptions are the hooks the service needs.
type FileServiceOptions struct {
	// Folders learns the folder of each page opened, so the page may be
	// shown its images and videos. Nil allows nothing.
	Folders *OpenedFolders
	// ClipboardImage reads the clipboard's image as PNG, or nil when it holds
	// none. Nil means no image is ever read.
	ClipboardImage func() []byte
	// ChooseFiles answers the media picker instead of showing the native
	// one: the smoke test build takes its answers from the scenario. Nil
	// shows the native picker.
	ChooseFiles func(kind string) ([]string, error)
	// Open opens a file in its own app; nil uses the platform's.
	Open func(path string) error
	// Reveal shows a file in its folder; nil uses the platform's file manager.
	Reveal func(path string) error
}

// NewFileService constructs the service registered with the application.
func NewFileService(options FileServiceOptions) *FileService {
	return &FileService{options: options}
}

// ClipboardImage is the clipboard's image as PNG in base64, for a paste into
// the Document; empty when the clipboard holds no image. Wails reads text
// only, so the image comes through here.
func (s *FileService) ClipboardImage() string {
	if s.options.ClipboardImage == nil {
		return ""
	}
	data := s.options.ClipboardImage()
	if len(data) == 0 {
		return ""
	}
	return base64.StdEncoding.EncodeToString(data)
}

// OpenResult is a file, parsed.
//
// Problems the user can act on (a missing file, a permission denial, a
// malformed canvas block) come back in Error rather than as a failed call,
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
	// The page may now show images and videos from its folder.
	s.options.Folders.Allow(filepath.Dir(path))

	parsed, err := format.Read(file.Content)
	// A malformed canvas block still yields the prose, so the user sees their
	// document rather than an empty window.
	result := OpenResult{
		Path: path,
		// The page edits the prose; the canvas block is written from Scene.
		Source:   format.Prose(parsed.Source),
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
// The frontend reads these once at start-up.
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

// mediaFilters are the file types the media picker offers, by kind.
var mediaFilters = map[string]struct{ name, pattern string }{
	"image": {"Images", "*.png;*.jpg;*.jpeg;*.gif;*.webp;*.svg"},
	"video": {"Videos", "*.mp4;*.webm;*.mov"},
	// Any file, shown in the page as a card.
	"file": {"Files", ""},
}

// ChooseMedia shows the native open dialog for images, videos or any file
// ("image", "video" or "file"), several at once. Cancelling returns no paths
// and no error.
func (s *FileService) ChooseMedia(kind string) PathsResult {
	filter, ok := mediaFilters[kind]
	if !ok {
		return PathsResult{Paths: []string{}, Error: fmt.Sprintf("no media of kind %q", kind)}
	}
	var paths []string
	var err error
	if s.options.ChooseFiles != nil {
		paths, err = s.options.ChooseFiles(kind)
	} else {
		dialog := application.Get().Dialog.OpenFile()
		dialog.SetTitle(filter.name)
		dialog.CanChooseFiles(true)
		dialog.CanChooseDirectories(false)
		if filter.pattern != "" {
			dialog.AddFilter(filter.name, filter.pattern)
		}
		paths, err = dialog.PromptForMultipleSelection()
	}
	if err != nil {
		return PathsResult{Paths: []string{}, Error: err.Error()}
	}
	if paths == nil {
		paths = []string{}
	}
	return PathsResult{Paths: paths}
}

// PathsResult is the paths chosen, none when the user cancelled.
type PathsResult struct {
	Paths []string `json:"paths"`
	Error string   `json:"error"`
}

// DialogResult is a chosen path, or an empty one when the user cancelled.
type DialogResult struct {
	Path  string `json:"path"`
	Error string `json:"error"`
}
