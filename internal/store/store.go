// Package store reads and writes files on disk.
//
// It knows nothing about the format; that is internal/format's job. This
// package owns durability: an interrupted save must leave the previous file
// intact, and a file changed by another program must be noticed rather than
// silently overwritten.
package store

import (
	"errors"
	"fmt"
	"io"
	"math/rand/v2"
	"os"
	"path/filepath"
	"strings"
)

// Stamp is what a file looked like when it was read.
//
// Size and modification time, which is enough to prompt and cheap enough to
// check whenever the window regains focus. A content hash would be exact and
// would mean reading every open file on every focus change.
type Stamp struct {
	Size int64 `json:"size"`
	// ModifiedUnixNano crosses to the frontend as a decimal string: its 19
	// digits do not survive a JavaScript number, which rounded it and made
	// every file look changed on disk.
	ModifiedUnixNano int64 `json:"modifiedUnixNano,string"`
}

// File is a file read from disk.
type File struct {
	Path    string `json:"path"`
	Content string `json:"content"`
	Stamp   Stamp  `json:"stamp"`
}

// Open reads a file.
func Open(path string) (File, error) {
	info, err := os.Stat(path)
	if err != nil {
		return File{}, fmt.Errorf("open %s: %w", filepath.Base(path), err)
	}
	if info.IsDir() {
		return File{}, fmt.Errorf("open %s: is a directory", filepath.Base(path))
	}

	content, err := os.ReadFile(path)
	if err != nil {
		return File{}, fmt.Errorf("read %s: %w", filepath.Base(path), err)
	}

	return File{
		Path:    path,
		Content: string(content),
		Stamp:   stampOf(info),
	}, nil
}

// Save writes content to path atomically.
//
// The write goes to a temporary file in the *same directory* (a rename across
// filesystems is not atomic) and is then renamed over the target. A crash
// mid-save leaves either the old file or the new one, never a truncated one.
func Save(path, content string) error {
	return SaveFrom(path, strings.NewReader(content))
}

// SaveFrom writes what r holds to path atomically, as Save does, without
// holding it all in memory: a video can be large.
func SaveFrom(path string, r io.Reader) error {
	dir := filepath.Dir(path)

	// Deliberately not creating the directory: silently making folders turns a
	// typo in a path into a mess of empty ones. The user asked to save a file.
	info, err := os.Stat(dir)
	if err != nil {
		return fmt.Errorf("save %s: %w", filepath.Base(path), err)
	}
	if !info.IsDir() {
		return fmt.Errorf("save %s: %s is not a directory", filepath.Base(path), dir)
	}

	temp, err := createTemp(dir)
	if err != nil {
		return fmt.Errorf("save %s: %w", filepath.Base(path), err)
	}
	tempPath := temp.Name()

	// Any failure from here leaves the original untouched; the temporary file
	// is removed on the way out.
	defer func() {
		// A temporary file made read-only like its target cannot be removed
		// on Windows until it is writable again.
		_ = os.Chmod(tempPath, 0o600)
		_ = os.Remove(tempPath)
	}()

	// The file keeps its permissions. A new one has what any new file gets
	// (the temporary file is made as one). A disk that cannot set them (some
	// network shares) still saves.
	if existing, err := os.Stat(path); err == nil {
		_ = temp.Chmod(existing.Mode().Perm())
	}

	if _, err := io.Copy(temp, r); err != nil {
		temp.Close()
		return fmt.Errorf("save %s: %w", filepath.Base(path), err)
	}
	// Flushed before the rename, or a crash can rename an empty file into place.
	if err := temp.Sync(); err != nil {
		temp.Close()
		return fmt.Errorf("save %s: %w", filepath.Base(path), err)
	}
	if err := temp.Close(); err != nil {
		return fmt.Errorf("save %s: %w", filepath.Base(path), err)
	}

	if err := os.Rename(tempPath, path); err != nil {
		return fmt.Errorf("save %s: %w", filepath.Base(path), err)
	}
	return nil
}

// ChangedOnDisk reports whether a file differs from the stamp taken when it
// was read.
func ChangedOnDisk(path string, stamp Stamp) (bool, error) {
	info, err := os.Stat(path)
	if err != nil {
		return false, fmt.Errorf("check %s: %w", filepath.Base(path), err)
	}
	current := stampOf(info)
	return current != stamp, nil
}

func stampOf(info os.FileInfo) Stamp {
	return Stamp{
		Size:             info.Size(),
		ModifiedUnixNano: info.ModTime().UnixNano(),
	}
}

// createTemp makes a temporary file beside the target, with the permissions
// any new file gets there (0666 less the user's umask), where os.CreateTemp
// would make it readable by its owner only.
func createTemp(dir string) (*os.File, error) {
	for range 100 {
		name := filepath.Join(dir, fmt.Sprintf(".bava-%d.tmp", rand.Uint64()))
		file, err := os.OpenFile(name, os.O_RDWR|os.O_CREATE|os.O_EXCL, 0o666)
		if !errors.Is(err, os.ErrExist) {
			return file, err
		}
	}
	return nil, fmt.Errorf("no free temporary name in %s", dir)
}
