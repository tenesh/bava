package e2e

import (
	"archive/zip"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestAZipStepNeedsAFileAndWhatItHolds(t *testing.T) {
	if err := check(Step{Do: "zip", Target: "Space.zip", Text: "holds=a.md; lacks=.bava/trash"}); err != nil {
		t.Errorf("a whole zip step was refused: %v", err)
	}
	if err := check(Step{Do: "zip", Target: "Space.zip"}); err == nil {
		t.Error("a zip step with nothing to check was accepted")
	}
}

func TestAZipIsCheckedForWhatItHoldsAndLacks(t *testing.T) {
	dir := t.TempDir()
	writeZip(t, filepath.Join(dir, "s.zip"), "First page.md", ".bava/attachments/logo.png")
	s := NewService(Options{Scratch: dir})
	if msg := s.CheckZip("s.zip", "holds=First page.md,.bava/attachments/logo.png; lacks=.bava/trash"); msg != "" {
		t.Errorf("a right zip failed: %s", msg)
	}
	if msg := s.CheckZip("s.zip", "holds=Goal.md"); !strings.Contains(msg, "Goal.md") {
		t.Errorf("a missing file passed: %q", msg)
	}
	if msg := s.CheckZip("s.zip", "lacks=.bava/attachments"); msg == "" {
		t.Error("a file that should be absent passed")
	}
}

func writeZip(t *testing.T, path string, names ...string) {
	t.Helper()
	f, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	w := zip.NewWriter(f)
	for _, n := range names {
		if _, err := w.Create(n); err != nil {
			t.Fatal(err)
		}
	}
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	f.Close()
}
