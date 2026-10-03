package store_test

import (
	"encoding/json"
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
	// change is also a change in size: it is noticed even within one tick.
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

// A stamp crosses to the frontend as JSON, where a number keeps only 15 to
// 17 digits: a nanosecond time has 19 and came back rounded, so every file
// read the same way was reported as changed on disk. Round-tripped through
// JSON numbers as a browser reads them, the stamp must still match.
func TestStampSurvivesTheFrontend(t *testing.T) {
	path := filepath.Join(t.TempDir(), "notes.md")
	if err := store.Save(path, "content\n"); err != nil {
		t.Fatal(err)
	}
	// A time whose nanoseconds a float64 cannot hold exactly.
	odd := time.Unix(1790444150, 393195667)
	if err := os.Chtimes(path, odd, odd); err != nil {
		t.Fatal(err)
	}
	file, err := store.Open(path)
	if err != nil {
		t.Fatal(err)
	}

	encoded, err := json.Marshal(file.Stamp)
	if err != nil {
		t.Fatal(err)
	}
	// What JavaScript's JSON.parse and JSON.stringify do to it: numbers
	// become float64.
	var browser map[string]any
	if err := json.Unmarshal(encoded, &browser); err != nil {
		t.Fatal(err)
	}
	back, err := json.Marshal(browser)
	if err != nil {
		t.Fatal(err)
	}
	var returned store.Stamp
	if err := json.Unmarshal(back, &returned); err != nil {
		t.Fatalf("the stamp did not survive the frontend: %v (%s)", err, back)
	}

	changed, err := store.ChangedOnDisk(path, returned)
	if err != nil {
		t.Fatal(err)
	}
	if changed {
		t.Errorf("an untouched file was reported as changed after its stamp crossed to the frontend: %s", back)
	}
}
