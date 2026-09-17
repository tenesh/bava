package store_test

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/tenesh/bava/internal/store"
)

func TestUnchangedFileIsNotReportedAsChanged(t *testing.T) {
	path := filepath.Join(t.TempDir(), "notes.md")
	if err := store.Save(path, "content\n"); err != nil {
		t.Fatal(err)
	}
	file, err := store.Open(path)
	if err != nil {
		t.Fatal(err)
	}

	changed, err := store.ChangedOnDisk(path, file.Stamp)
	if err != nil {
		t.Fatal(err)
	}
	if changed {
		t.Error("an untouched file was reported as changed")
	}
}

// Another editor writing the file is the case this exists for: the user is
// told rather than silently overwriting someone else's work.
func TestDetectsAChangeOnDisk(t *testing.T) {
	path := filepath.Join(t.TempDir(), "notes.md")
	if err := store.Save(path, "content\n"); err != nil {
		t.Fatal(err)
	}
	file, err := store.Open(path)
	if err != nil {
		t.Fatal(err)
	}

	// Modification time has coarse resolution on some filesystems, so the
	// change is also a change in size.
	time.Sleep(10 * time.Millisecond)
	if err := os.WriteFile(path, []byte("someone else wrote this\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	changed, err := store.ChangedOnDisk(path, file.Stamp)
	if err != nil {
		t.Fatal(err)
	}
	if !changed {
		t.Error("a file rewritten by another program was not reported as changed")
	}
}

func TestChangedOnDiskReportsADeletedFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "notes.md")
	if err := store.Save(path, "content\n"); err != nil {
		t.Fatal(err)
	}
	file, err := store.Open(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Remove(path); err != nil {
		t.Fatal(err)
	}

	if _, err := store.ChangedOnDisk(path, file.Stamp); err == nil {
		t.Error("expected an error for a file that no longer exists")
	}
}
