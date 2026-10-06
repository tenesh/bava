package space

import (
	"errors"
	"fmt"
	"os"
	"path"
	"path/filepath"
	"strings"
)

// CreatePage makes an empty page in a folder, at the end of its order.
// Returns its path. A name that exists is refused.
func (s Space) CreatePage(folder, name string) (string, error) {
	return s.CreatePageWith(folder, name, nil)
}

// CreatePageWith makes a page holding content (a page made from a template),
// as CreatePage does; a page whose content cannot be written is removed.
func (s Space) CreatePageWith(folder, name string, content []byte) (string, error) {
	dir, err := s.resolve(folder)
	if err != nil {
		return "", err
	}
	name, err = validName(name)
	if err != nil {
		return "", err
	}
	file := pageName(name)
	rel := join(dir, file)
	created, err := os.OpenFile(s.abs(rel), os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o644)
	if err != nil {
		if errors.Is(err, os.ErrExist) {
			return "", refuse(ErrExists, "%q already exists", file)
		}
		return "", fmt.Errorf("new page: %w", err)
	}
	_, werr := created.Write(content)
	if cerr := created.Close(); werr == nil {
		werr = cerr
	}
	if werr != nil {
		_ = os.Remove(s.abs(rel))
		return "", fmt.Errorf("new page: %w", werr)
	}
	return rel, s.update(func(f *File) error {
		f.Order[dir] = appendOnce(s.arranged(f, dir), file)
		return nil
	})
}

// CreateFolder makes a folder at the end of its parent's order.
func (s Space) CreateFolder(folder, name string) (string, error) {
	dir, err := s.resolve(folder)
	if err != nil {
		return "", err
	}
	name, err = validName(name)
	if err != nil {
		return "", err
	}
	rel := join(dir, name)
	if err := os.Mkdir(s.abs(rel), 0o755); err != nil {
		if errors.Is(err, os.ErrExist) {
			return "", refuse(ErrExists, "%q already exists", name)
		}
		return "", fmt.Errorf("new folder: %w", err)
	}
	return rel, s.update(func(f *File) error {
		f.Order[dir] = appendOnce(s.arranged(f, dir), name)
		return nil
	})
}

// Rename renames a page or folder in place, keeping its place in the order.
// A page keeps its .md whatever the name typed.
func (s Space) Rename(p, name string) (string, error) {
	rel, err := s.existing(p)
	if err != nil {
		return "", err
	}
	name, err = validName(name)
	if err != nil {
		return "", err
	}
	kind := s.kindOf(rel)
	next := name
	if kind == KindPage {
		next = pageName(name)
	}
	dir, old := parent(rel), path.Base(rel)
	target := join(dir, next)
	if s.replaces(s.abs(rel), s.abs(target)) {
		return "", refuse(ErrExists, "%q already exists", next)
	}
	var order []string
	if err := s.update(func(f *File) error {
		order = s.arranged(f, dir)
		return nil
	}); err != nil {
		return "", err
	}
	if err := os.Rename(s.abs(rel), s.abs(target)); err != nil {
		return "", fmt.Errorf("rename: %w", err)
	}
	return target, s.update(func(f *File) error {
		f.Order[dir] = replace(order, old, next)
		if kind == KindFolder {
			rekey(f, rel, target)
		}
		return nil
	})
}

// Move moves a page or folder into a folder at an index of its order (-1 or
// past the end for the end). Within the same folder, it reorders.
func (s Space) Move(p, folder string, index int) (string, error) {
	rel, err := s.existing(p)
	if err != nil {
		return "", err
	}
	dest, err := s.resolve(folder)
	if err != nil {
		return "", err
	}
	if info, err := os.Stat(s.abs(dest)); err != nil || !info.IsDir() {
		return "", refuse(ErrNotFolder, "%s is not a folder", display(dest))
	}
	kind := s.kindOf(rel)
	if kind == KindFolder && (dest == rel || strings.HasPrefix(dest, rel+"/")) {
		return "", refuse(ErrIntoItself, "a folder cannot go inside itself")
	}
	from, name := parent(rel), path.Base(rel)
	target := join(dest, name)
	var fromOrder, destOrder []string
	if err := s.update(func(f *File) error {
		fromOrder = s.arranged(f, from)
		destOrder = s.arranged(f, dest)
		return nil
	}); err != nil {
		return "", err
	}
	if from != dest {
		if _, err := os.Lstat(s.abs(target)); err == nil {
			return "", refuse(ErrExists, "%q already exists in %s", name, display(dest))
		}
		if err := os.Rename(s.abs(rel), s.abs(target)); err != nil {
			return "", fmt.Errorf("move: %w", err)
		}
	}
	return target, s.update(func(f *File) error {
		if from == dest {
			f.Order[dest] = insert(remove(destOrder, name), name, index)
			return nil
		}
		f.Order[from] = remove(fromOrder, name)
		f.Order[dest] = insert(remove(destOrder, name), name, index)
		if kind == KindFolder {
			rekey(f, rel, target)
		}
		return nil
	})
}

// Duplicate copies a page beside itself, numbered ("Launch plan 2.md"), just
// after the original in the order.
func (s Space) Duplicate(p string) (string, error) {
	rel, err := s.existing(p)
	if err != nil {
		return "", err
	}
	if s.kindOf(rel) != KindPage {
		return "", refuse(ErrOnlyPage, "only a page can be duplicated")
	}
	content, err := os.ReadFile(s.abs(rel))
	if err != nil {
		return "", fmt.Errorf("duplicate: %w", err)
	}
	dir, name := parent(rel), path.Base(rel)
	copyName := s.numbered(dir, strings.TrimSuffix(name, filepath.Ext(name)), filepath.Ext(name))
	target := join(dir, copyName)
	if err := os.WriteFile(s.abs(target), content, 0o644); err != nil {
		return "", fmt.Errorf("duplicate: %w", err)
	}
	return target, s.update(func(f *File) error {
		order := remove(s.arranged(f, dir), copyName)
		at := indexOf(order, name) + 1
		f.Order[dir] = insert(order, copyName, at)
		return nil
	})
}

// RenameSpace renames the Space's folder and returns the Space at its new
// place.
func (s Space) RenameSpace(name string) (Space, error) {
	name, err := validName(name)
	if err != nil {
		return s, err
	}
	target := filepath.Join(filepath.Dir(s.Root), name)
	if target == s.Root {
		return s, nil
	}
	if s.replaces(s.Root, target) {
		return s, refuse(ErrExists, "%q already exists", name)
	}
	if err := os.Rename(s.Root, target); err != nil {
		return s, fmt.Errorf("rename space: %w", err)
	}
	return Space{Root: target}, nil
}

// existing cleans a path that must name something in the Space.
func (s Space) existing(p string) (string, error) {
	rel, err := s.resolve(p)
	if err != nil {
		return "", err
	}
	if rel == "" {
		return "", refuse(ErrOutside, "the Space itself cannot be changed here")
	}
	if _, err := os.Lstat(s.abs(rel)); err != nil {
		return "", fmt.Errorf("%s: %w", rel, err)
	}
	return rel, nil
}

func (s Space) kindOf(rel string) string {
	if info, err := os.Stat(s.abs(rel)); err == nil && info.IsDir() {
		return KindFolder
	}
	return KindPage
}

// numbered finds "base 2ext", "base 3ext", … free in a folder.
func (s Space) numbered(dir, base, ext string) string {
	for n := 2; ; n++ {
		name := fmt.Sprintf("%s %d%s", base, n, ext)
		if _, err := os.Lstat(s.abs(join(dir, name))); errors.Is(err, os.ErrNotExist) {
			return name
		}
	}
}

// pageName gives a typed name its .md, unless it has one.
func pageName(name string) string {
	if strings.EqualFold(filepath.Ext(name), PageExt) {
		return name
	}
	return name + PageExt
}

// rekey moves the order kept for a folder and everything under it to its new
// path.
func rekey(f *File, from, to string) {
	for key, names := range f.Order {
		switch {
		case key == from:
			delete(f.Order, key)
			f.Order[to] = names
		case strings.HasPrefix(key, from+"/"):
			delete(f.Order, key)
			f.Order[to+strings.TrimPrefix(key, from)] = names
		}
	}
}

// drop forgets the order kept for a folder and everything under it.
func drop(f *File, rel string) {
	for key := range f.Order {
		if key == rel || strings.HasPrefix(key, rel+"/") {
			delete(f.Order, key)
		}
	}
}

func appendOnce(names []string, name string) []string {
	return append(remove(names, name), name)
}

func remove(names []string, name string) []string {
	out := make([]string, 0, len(names))
	for _, n := range names {
		if n != name {
			out = append(out, n)
		}
	}
	return out
}

func replace(names []string, old, next string) []string {
	out := make([]string, len(names))
	for i, n := range names {
		if n == old {
			n = next
		}
		out[i] = n
	}
	return out
}

func insert(names []string, name string, at int) []string {
	if at < 0 || at > len(names) {
		at = len(names)
	}
	out := make([]string, 0, len(names)+1)
	out = append(out, names[:at]...)
	out = append(out, name)
	return append(out, names[at:]...)
}

func indexOf(names []string, name string) int {
	for i, n := range names {
		if n == name {
			return i
		}
	}
	return len(names) - 1
}
