package store_test

import (
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/tenesh/bava/internal/store"
)

func TestSaveThenOpenReturnsTheSameContent(t *testing.T) {
	path := filepath.Join(t.TempDir(), "notes.md")
	const content = "# Title\n\nProse.\n"

	if err := store.Save(path, content); err != nil {
		t.Fatalf("Save: %v", err)
	}
	got, err := store.Open(path)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	if got.Content != content {
		t.Errorf("content = %q, want %q", got.Content, content)
	}
}

// A crash mid-save must leave the old file, not a truncated one. The write
// goes to a temporary file in the same directory and is renamed over the
// target, which is atomic on every platform we ship.
func TestSaveDoesNotLeaveATemporaryFileBehind(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "notes.md")

	if err := store.Save(path, "content\n"); err != nil {
		t.Fatalf("Save: %v", err)
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatal(err)
	}
	if len(entries) != 1 {
		var names []string
		for _, e := range entries {
			names = append(names, e.Name())
		}
		t.Errorf("directory holds %v, want just the saved file", names)
	}
}

func TestSaveOverwritesAtomically(t *testing.T) {
	path := filepath.Join(t.TempDir(), "notes.md")
	if err := store.Save(path, "first\n"); err != nil {
		t.Fatal(err)
	}
	if err := store.Save(path, "second\n"); err != nil {
		t.Fatal(err)
	}

	got, err := store.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	if got.Content != "second\n" {
		t.Errorf("content = %q", got.Content)
	}
}

// Silently creating directories turns a typo in a path into a mess of empty
// folders. The user asked to save one file.
func TestSaveIntoAMissingDirectoryIsAnError(t *testing.T) {
	path := filepath.Join(t.TempDir(), "nope", "notes.md")

	err := store.Save(path, "content\n")

	if err == nil {
		t.Fatal("expected an error saving into a directory that does not exist")
	}
}

func TestOpenRejectsADirectory(t *testing.T) {
	if _, err := store.Open(t.TempDir()); err == nil {
		t.Fatal("expected an error opening a directory")
	}
}

func TestOpenMissingFileSaysSo(t *testing.T) {
	_, err := store.Open(filepath.Join(t.TempDir(), "absent.md"))
	if err == nil {
		t.Fatal("expected an error")
	}
	if !strings.Contains(err.Error(), "absent.md") {
		t.Errorf("error %q does not name the file", err)
	}
}

func TestOpenRecordsModificationState(t *testing.T) {
	path := filepath.Join(t.TempDir(), "notes.md")
	if err := store.Save(path, "content\n"); err != nil {
		t.Fatal(err)
	}

	file, err := store.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	if file.Stamp.Size == 0 {
		t.Error("Stamp.Size is zero")
	}
	if file.Stamp.ModifiedUnixNano == 0 {
		t.Error("Stamp.ModifiedUnixNano is zero")
	}
}

// A saved file keeps its permissions; a new one gets what any new file gets,
// never a temporary file's owner-only mode.
func TestSaveKeepsTheFilesPermissions(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("Windows files have no Unix permissions")
	}
	dir := t.TempDir()
	kept := filepath.Join(dir, "shared.md")
	if err := os.WriteFile(kept, []byte("before"), 0o664); err != nil {
		t.Fatal(err)
	}
	if err := os.Chmod(kept, 0o664); err != nil {
		t.Fatal(err)
	}
	fresh := filepath.Join(dir, "new.md")
	for _, path := range []string{kept, fresh} {
		if err := store.Save(path, "after"); err != nil {
			t.Fatal(err)
		}
	}
	// A new page gets what any new file here gets: 0666 less the user's umask.
	probe := filepath.Join(dir, "probe")
	if err := os.WriteFile(probe, nil, 0o666); err != nil {
		t.Fatal(err)
	}
	usual, err := os.Stat(probe)
	if err != nil {
		t.Fatal(err)
	}
	for path, want := range map[string]os.FileMode{kept: 0o664, fresh: usual.Mode().Perm()} {
		info, err := os.Stat(path)
		if err != nil {
			t.Fatal(err)
		}
		if got := info.Mode().Perm(); got != want {
			t.Errorf("%s: mode %v; want %v", filepath.Base(path), got, want)
		}
	}
}
