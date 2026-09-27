package app_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/tenesh/bava/internal/app"
	"github.com/tenesh/bava/internal/format"
)

func TestOpenReturnsProseAndScene(t *testing.T) {
	path := filepath.Join(t.TempDir(), "notes.md")
	source := "# T\n\n```d2 id=a\nx -> y\n```\n"
	if err := os.WriteFile(path, []byte(source), 0o644); err != nil {
		t.Fatal(err)
	}

	result := app.NewFileService().Open(path)

	if result.Error != "" {
		t.Fatalf("Error = %q", result.Error)
	}
	if result.Source != source {
		t.Errorf("Source = %q", result.Source)
	}
	if result.Diagrams["a"] != "x -> y\n" {
		t.Errorf("Diagrams = %v", result.Diagrams)
	}
}

// A missing file is something the user can act on, so it is data rather than
// a failed call, the same shape as a compile diagnostic.
func TestOpenMissingFileReportsInError(t *testing.T) {
	result := app.NewFileService().Open(filepath.Join(t.TempDir(), "absent.md"))
	if result.Error == "" {
		t.Fatal("expected an error message")
	}
	if !strings.Contains(result.Error, "absent.md") {
		t.Errorf("Error = %q, want it to name the file", result.Error)
	}
}

func TestSaveThenOpenRoundTrips(t *testing.T) {
	path := filepath.Join(t.TempDir(), "notes.md")
	service := app.NewFileService()
	scene := format.Scene{
		Version:  format.Version,
		Elements: []format.Element{{ID: "e1", Type: "rect", W: 10, H: 10, Z: 1}},
	}

	saved := service.Save(path, "# T\n\nProse.\n", scene)
	if saved.Error != "" {
		t.Fatalf("Save error: %q", saved.Error)
	}

	opened := service.Open(path)
	if opened.Error != "" {
		t.Fatalf("Open error: %q", opened.Error)
	}
	if len(opened.Scene.Elements) != 1 || opened.Scene.Elements[0].ID != "e1" {
		t.Errorf("scene did not round trip: %+v", opened.Scene)
	}
	if !strings.HasPrefix(opened.Source, "# T\n\nProse.\n") {
		t.Errorf("prose did not survive: %q", opened.Source)
	}
}

func TestChangedOnDiskNoticesAnotherWriter(t *testing.T) {
	path := filepath.Join(t.TempDir(), "notes.md")
	service := app.NewFileService()
	saved := service.Save(path, "one\n", format.Scene{})
	if saved.Error != "" {
		t.Fatal(saved.Error)
	}

	if service.ChangedOnDisk(path, saved.Stamp) {
		t.Error("an untouched file was reported as changed")
	}

	if err := os.WriteFile(path, []byte("someone else\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if !service.ChangedOnDisk(path, saved.Stamp) {
		t.Error("an externally rewritten file was not reported as changed")
	}
}

// TypeScript consumes these names, and a Go field rename would compile and
// break the frontend.
func TestFileResultJSONFieldNames(t *testing.T) {
	assertKeys(t, "OpenResult", mustMarshal(t, app.OpenResult{}),
		[]string{"diagrams", "error", "path", "scene", "source", "stamp"})
	assertKeys(t, "SaveResult", mustMarshal(t, app.SaveResult{}),
		[]string{"error", "path", "stamp"})
}

func mustMarshal(t *testing.T, value any) []byte {
	t.Helper()
	b, err := json.Marshal(value)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	return b
}
