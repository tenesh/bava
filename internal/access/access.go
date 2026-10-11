// Package access keeps the folders and files the user let Bava reach, across
// launches, where a store's sandbox would otherwise forget them: on macOS a
// security-scoped bookmark per grant, under Flatpak the portal's own path.
// Where nothing is sandboxed it keeps nothing, and whatever exists is
// reachable.
package access

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/tharabyte/bava/internal/store"
)

// Keeper keeps access to a path the user granted, for a later launch.
type Keeper interface {
	// Sandboxed reports whether access must be granted and kept at all.
	Sandboxed() bool
	// Keep returns what regains access to path later; nil where nothing is
	// needed beyond the path.
	Keep(path string) ([]byte, error)
	// Restore regains access from what Keep returned: the path as it is now,
	// and whether the token is stale and should be kept again.
	Restore(token []byte) (path string, stale bool, err error)
}

// None is a system without a sandbox: nothing to keep, everything reachable.
type None struct{}

// Sandboxed is false: there is no sandbox.
func (None) Sandboxed() bool { return false }

// Keep keeps nothing.
func (None) Keep(string) ([]byte, error) { return nil, nil }

// Restore is never called without a sandbox.
func (None) Restore([]byte) (string, bool, error) { return "", false, errors.New("no sandbox") }

// grant is one folder or file the user allowed, and what restores it.
type grant struct {
	Path  string `json:"path"`
	Token []byte `json:"token,omitempty"`
}

type file struct {
	Grants []grant `json:"grants"`
}

// Store is the grants of this launch: which are reachable, which are lost.
type Store struct {
	path   string
	keeper Keeper

	mu        sync.Mutex
	grants    []grant
	reachable map[string]bool
	// chosen is everything allowed this launch, or restored: what Granted
	// answers from, with or without a sandbox.
	chosen map[string]bool
}

// Open reads the grants kept at path and restores each. A file that cannot
// be read leaves an empty, usable store and is reported; a grant the system
// refuses, or whose folder is gone, is kept and listed as lost, never
// silently dropped.
func Open(path string, keeper Keeper) (*Store, error) {
	s := &Store{path: path, keeper: keeper, reachable: map[string]bool{}, chosen: map[string]bool{}}
	if !keeper.Sandboxed() {
		return s, nil
	}
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return s, nil
	}
	if err != nil {
		return s, fmt.Errorf("read access grants: %w", err)
	}
	var f file
	if err := json.Unmarshal(data, &f); err != nil {
		return s, fmt.Errorf("read access grants: %w", err)
	}
	s.grants = f.Grants
	changed := false
	for i, g := range s.grants {
		now, stale, err := keeper.Restore(g.Token)
		if err != nil {
			continue
		}
		if _, err := os.Stat(now); err != nil {
			continue
		}
		if stale {
			if token, err := keeper.Keep(now); err == nil {
				s.grants[i].Token = token
				changed = true
			}
		}
		s.reachable[filepath.Clean(g.Path)] = true
		s.chosen[filepath.Clean(g.Path)] = true
	}
	if changed {
		if err := s.save(); err != nil {
			return s, err
		}
	}
	return s, nil
}

// Allow keeps a folder or file the user just chose through the system's
// dialog, or dropped, so a later launch may reach it again.
func (s *Store) Allow(path string) error {
	path = filepath.Clean(path)
	s.mu.Lock()
	s.chosen[path] = true
	s.mu.Unlock()
	if !s.keeper.Sandboxed() {
		return nil
	}
	token, err := s.keeper.Keep(path)
	if err != nil {
		return fmt.Errorf("keep access to %s: %w", filepath.Base(path), err)
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.drop(path)
	s.grants = append(s.grants, grant{Path: path, Token: token})
	s.reachable[path] = true
	return s.save()
}

// Forget drops a grant, as when a Space is removed from the recent list.
func (s *Store) Forget(path string) error {
	s.mu.Lock()
	delete(s.chosen, filepath.Clean(path))
	s.mu.Unlock()
	if !s.keeper.Sandboxed() {
		return nil
	}
	path = filepath.Clean(path)
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.drop(path) {
		return nil
	}
	delete(s.reachable, path)
	return s.save()
}

// Reachable reports whether Bava may reach path now: without a sandbox,
// whether it exists; within one, whether it or a folder holding it was
// allowed and restored.
func (s *Store) Reachable(path string) bool {
	path = filepath.Clean(path)
	if !s.keeper.Sandboxed() {
		_, err := os.Stat(path)
		return err == nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	for granted := range s.reachable {
		if path == granted || strings.HasPrefix(path, granted+string(filepath.Separator)) {
			return true
		}
	}
	return false
}

// Granted reports whether the user chose path, or a folder holding it,
// through a dialog or a drop: this launch, or kept from an earlier one inside
// a sandbox. Unlike Reachable, a file merely existing is not enough.
func (s *Store) Granted(path string) bool {
	path = filepath.Clean(path)
	s.mu.Lock()
	defer s.mu.Unlock()
	for chosen := range s.chosen {
		if path == chosen || strings.HasPrefix(path, chosen+string(filepath.Separator)) {
			return true
		}
	}
	return false
}

// Lost is the grants kept but not reachable this launch: to be found again.
func (s *Store) Lost() []string {
	s.mu.Lock()
	defer s.mu.Unlock()
	var out []string
	for _, g := range s.grants {
		if !s.reachable[filepath.Clean(g.Path)] {
			out = append(out, g.Path)
		}
	}
	return out
}

// drop removes the grant for path; it reports whether there was one.
func (s *Store) drop(path string) bool {
	for i, g := range s.grants {
		if filepath.Clean(g.Path) == path {
			s.grants = append(s.grants[:i], s.grants[i+1:]...)
			return true
		}
	}
	return false
}

// save writes the grants atomically; Bava's state folder is made if missing.
func (s *Store) save() error {
	data, err := json.MarshalIndent(file{Grants: s.grants}, "", "  ")
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(s.path), 0o700); err != nil {
		return fmt.Errorf("save access grants: %w", err)
	}
	if err := store.Save(s.path, string(data)+"\n"); err != nil {
		return fmt.Errorf("save access grants: %w", err)
	}
	return nil
}
