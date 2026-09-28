package space

import (
	"fmt"
	"os"
	"path"
	"strings"

	"github.com/tenesh/bava/internal/store"
)

// Pages lists every page in the Space, depth first in the tree's order, each
// named without .md. A folder that cannot be read is passed over: its pages
// are missing from the list, never the whole Space.
func (s Space) Pages() ([]Entry, error) {
	var out []Entry
	var walk func(folder string) error
	walk = func(folder string) error {
		entries, err := s.List(folder)
		if err != nil {
			return err
		}
		for _, e := range entries {
			if e.Kind == KindFolder {
				_ = walk(e.Path)
				continue
			}
			out = append(out, Entry{Name: pageTitle(e.Path), Path: e.Path, Kind: e.Kind})
		}
		return nil
	}
	return out, walk("")
}

// pageTitle is a page's file name without .md.
func pageTitle(p string) string {
	base := path.Base(p)
	if strings.EqualFold(path.Ext(base), PageExt) {
		return base[:len(base)-len(PageExt)]
	}
	return base
}

// ReadPage is a page's text as it is on disk.
func (s Space) ReadPage(p string) (string, error) {
	rel, err := s.existingPage(p)
	if err != nil {
		return "", err
	}
	raw, err := os.ReadFile(s.abs(rel))
	if err != nil {
		return "", fmt.Errorf("read %s: %w", display(rel), err)
	}
	return string(raw), nil
}

// WriteIfUnchanged writes a page's new text, only when the page still reads
// as before: a page changed since it was read is left alone and refused with
// ErrChanged. Links following a rename are written this way, into pages the
// user may not have open.
func (s Space) WriteIfUnchanged(p, before, after string) error {
	current, err := s.ReadPage(p)
	if err != nil {
		return err
	}
	if current != before {
		return refuse(ErrChanged, "%s changed since it was read", display(p))
	}
	rel, _ := s.existingPage(p)
	if err := store.Save(s.abs(rel), after); err != nil {
		return fmt.Errorf("write %s: %w", display(rel), err)
	}
	return nil
}

// existingPage is a page of the Space that is there: a .md file, not hidden,
// not through a link.
func (s Space) existingPage(p string) (string, error) {
	rel, err := s.existing(p)
	if err != nil {
		return "", err
	}
	if s.kindOf(rel) != KindPage || !strings.EqualFold(path.Ext(rel), PageExt) {
		return "", fmt.Errorf("%s is not a page", display(rel))
	}
	return rel, nil
}
