package app

import (
	"errors"
	"io/fs"
	"log/slog"
	"os"

	"github.com/tharabyte/bava/internal/access"
	"github.com/tharabyte/bava/internal/icons"
	"github.com/wailsapp/wails/v3/pkg/application"
)

// IconServiceOptions wire the custom icon library to its folder and the platform.
type IconServiceOptions struct {
	// Dir is the library's folder (`config.IconsDir`).
	Dir func() (string, error)
	// ChooseFiles stands in for the file dialog; nil opens the real one.
	ChooseFiles func(kind string) ([]string, error)
	// Reveal shows a folder in the platform's file manager.
	Reveal func(path string) error
	Access *access.Store
}

// IconService is the custom icon library, shared by every Space.
type IconService struct {
	options IconServiceOptions
}

func NewIconService(options IconServiceOptions) *IconService {
	return &IconService{options: options}
}

// IconsResult is the library's icons, cleaned, by name.
type IconsResult struct {
	Icons []icons.Icon `json:"icons"`
	Error string       `json:"error"`
}

// AddResult is what was added, by name, and what could not be, a line each.
type AddResult struct {
	Added    []string `json:"added"`
	Problems []string `json:"problems"`
	Error    string   `json:"error"`
}

func (s *IconService) library() (*icons.Library, error) {
	if s.options.Dir == nil {
		return nil, errors.New("the icon library is unavailable")
	}
	dir, err := s.options.Dir()
	if err != nil {
		return nil, err
	}
	return icons.Open(dir), nil
}

// List reads the library, each icon cleaned as it is read.
func (s *IconService) List() IconsResult {
	library, err := s.library()
	if err != nil {
		return IconsResult{Icons: []icons.Icon{}, Error: err.Error()}
	}
	list, err := library.List()
	if err != nil {
		// Never the error: it names the folder.
		slog.Default().Warn("could not read the icon library")
		return IconsResult{Icons: []icons.Icon{}, Error: err.Error()}
	}
	return IconsResult{Icons: list}
}

// Add asks for SVG files and copies them into the library, cleaned.
func (s *IconService) Add() AddResult {
	none := AddResult{Added: []string{}, Problems: []string{}}
	library, err := s.library()
	if err != nil {
		none.Error = err.Error()
		return none
	}
	paths, err := s.choose()
	if err != nil {
		none.Error = err.Error()
		return none
	}
	if len(paths) == 0 {
		return none
	}
	allow(s.options.Access, paths...)
	added, problems, err := library.Add(paths)
	result := AddResult{Added: added, Problems: problems}
	if err != nil {
		result.Error = err.Error()
	}
	slog.Default().Info("icons added", "added", len(added), "refused", len(problems))
	return result
}

func (s *IconService) choose() ([]string, error) {
	if s.options.ChooseFiles != nil {
		return s.options.ChooseFiles("icon")
	}
	dialog := application.Get().Dialog.OpenFile()
	dialog.SetTitle("Add icons")
	dialog.CanChooseFiles(true)
	dialog.CanChooseDirectories(false)
	dialog.AddFilter("SVG icons", "*.svg")
	return dialog.PromptForMultipleSelection()
}

// Rename gives an icon, and its dark copy, a new name.
func (s *IconService) Rename(from, to string) Problem {
	library, err := s.library()
	if err != nil {
		return Problem{Error: err.Error(), Code: "unavailable"}
	}
	if err := library.Rename(from, to); err != nil {
		return iconProblem(err)
	}
	return Problem{}
}

// Delete moves an icon, and its dark copy, to the library's trash.
func (s *IconService) Delete(name string) Problem {
	library, err := s.library()
	if err != nil {
		return Problem{Error: err.Error(), Code: "unavailable"}
	}
	if err := library.Delete(name); err != nil {
		return iconProblem(err)
	}
	return Problem{}
}

// ShowFolder opens the library's folder in the file manager, made first if new.
func (s *IconService) ShowFolder() Problem {
	library, err := s.library()
	if err != nil {
		return Problem{Error: err.Error(), Code: "unavailable"}
	}
	if s.options.Reveal == nil {
		return Problem{Error: "showing folders is unavailable", Code: "revealUnavailable"}
	}
	if err := os.MkdirAll(library.Dir(), 0o755); err != nil {
		return Problem{Error: err.Error(), Code: "unavailable"}
	}
	if err := s.options.Reveal(library.Dir()); err != nil {
		return Problem{Error: err.Error(), Code: "revealUnavailable"}
	}
	return Problem{}
}

func iconProblem(err error) Problem {
	if errors.Is(err, fs.ErrNotExist) {
		return Problem{Error: err.Error(), Code: "notFound"}
	}
	return Problem{Error: err.Error(), Code: "refused"}
}
