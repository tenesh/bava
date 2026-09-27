// Package space is a Space on disk: a folder of pages and folders, with the
// Space's own data in a hidden .bava folder (docs/file-format.md, "Spaces").
//
// Every operation is a real file operation; nothing here keeps a second copy
// of the tree. Paths given by callers are relative to the Space and never
// leave it.
package space

import (
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"sort"
	"strings"

	"github.com/tenesh/bava/internal/store"
)

// Version is the space.json version this code writes.
const Version = 1

// File is .bava/space.json: what belongs to the Space as a whole.
type File struct {
	Version int
	// Order holds, per folder (relative to the Space, "" for the top), the
	// names of its pages and folders as the user arranged them.
	Order map[string][]string
	// PageWidth is the Space's default page width: narrow, wide or full, or
	// empty for the user's own setting.
	PageWidth string

	// extra keeps keys this version does not know, so a save never drops them.
	extra map[string]json.RawMessage
}

// ReadFile reads space.json. A missing file reads as an empty version 1.
func ReadFile(path string) (File, error) {
	raw, err := os.ReadFile(path)
	if errors.Is(err, fs.ErrNotExist) {
		return File{Version: Version}, nil
	}
	if err != nil {
		return File{}, fmt.Errorf("read space file: %w", err)
	}
	var f File
	if err := json.Unmarshal(raw, &f); err != nil {
		return File{}, fmt.Errorf("read space file: %w", err)
	}
	return f, nil
}

// WriteFile writes space.json whole and atomically.
func WriteFile(path string, f File) error {
	raw, err := json.MarshalIndent(f, "", "  ")
	if err != nil {
		return fmt.Errorf("write space file: %w", err)
	}
	if err := store.Save(path, string(raw)+"\n"); err != nil {
		return fmt.Errorf("write space file: %w", err)
	}
	return nil
}

// UnmarshalJSON reads the known keys and keeps the rest.
func (f *File) UnmarshalJSON(raw []byte) error {
	var all map[string]json.RawMessage
	if err := json.Unmarshal(raw, &all); err != nil {
		return err
	}
	*f = File{Version: Version}
	if v, ok := all["version"]; ok {
		if err := json.Unmarshal(v, &f.Version); err != nil {
			return fmt.Errorf("version: %w", err)
		}
		delete(all, "version")
	}
	if v, ok := all["order"]; ok {
		if err := json.Unmarshal(v, &f.Order); err != nil {
			return fmt.Errorf("order: %w", err)
		}
		delete(all, "order")
	}
	if v, ok := all["pageWidth"]; ok {
		if err := json.Unmarshal(v, &f.PageWidth); err != nil {
			return fmt.Errorf("pageWidth: %w", err)
		}
		delete(all, "pageWidth")
	}
	if len(all) > 0 {
		f.extra = all
	}
	return nil
}

// MarshalJSON writes the known keys and every kept one.
func (f File) MarshalJSON() ([]byte, error) {
	out := map[string]any{}
	for k, v := range f.extra {
		out[k] = v
	}
	version := f.Version
	if version == 0 {
		version = Version
	}
	out["version"] = version
	if len(f.Order) > 0 {
		out["order"] = f.Order
	}
	if f.PageWidth != "" {
		out["pageWidth"] = f.PageWidth
	}
	return json.Marshal(out)
}

// Prune drops every listed name that exists reports gone, and folders left
// with nothing listed.
func (f *File) Prune(exists func(folder, name string) bool) {
	for folder, names := range f.Order {
		kept := names[:0:0]
		for _, name := range names {
			if exists(folder, name) {
				kept = append(kept, name)
			}
		}
		if len(kept) == 0 {
			delete(f.Order, folder)
		} else {
			f.Order[folder] = kept
		}
	}
}

// Ordered arranges present names: the listed ones that are present, in their
// order, then the rest by name, case-insensitively.
func Ordered(listed, present []string) []string {
	here := make(map[string]bool, len(present))
	for _, name := range present {
		here[name] = true
	}
	out := make([]string, 0, len(present))
	placed := map[string]bool{}
	for _, name := range listed {
		if here[name] && !placed[name] {
			out = append(out, name)
			placed[name] = true
		}
	}
	var rest []string
	for _, name := range present {
		if !placed[name] {
			rest = append(rest, name)
		}
	}
	// By name, case-insensitively; names that differ only in case keep a
	// fixed order too, not the order the folder happened to list them in.
	sort.Slice(rest, func(i, j int) bool {
		a, b := strings.ToLower(rest[i]), strings.ToLower(rest[j])
		if a != b {
			return a < b
		}
		return rest[i] < rest[j]
	})
	return append(out, rest...)
}
