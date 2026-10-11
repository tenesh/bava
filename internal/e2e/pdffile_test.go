package e2e

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/tharabyte/bava/internal/testutil"
)

func TestAPDFFileStepNeedsAFileAndWhatItHolds(t *testing.T) {
	if err := check(Step{Do: "pdffile", Target: "First page.pdf", Text: "min=2 first=210x297"}); err != nil {
		t.Errorf("a whole pdffile step was refused: %v", err)
	}
	if err := check(Step{Do: "pdffile", Target: "First page.pdf"}); err == nil {
		t.Error("a pdffile step with nothing to check was accepted")
	}
}

// A PDF the app wrote is read for its sheets: at least so many, the first
// and the last of a size, to the millimetre.
func TestAPDFFileIsCheckedForItsSheets(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "p.pdf"), testutil.BlankPDF(3, 210, 297), 0o644); err != nil {
		t.Fatal(err)
	}
	s := NewService(Options{Scratch: dir})
	if msg := s.CheckPDF("p.pdf", "min=2 first=210x297 last=210x297"); msg != "" {
		t.Errorf("a right PDF failed: %s", msg)
	}
	for _, wrong := range []string{"min=4", "first=297x210", "last=215.9x279.4"} {
		if msg := s.CheckPDF("p.pdf", wrong); msg == "" {
			t.Errorf("%q passed", wrong)
		}
	}
	if msg := s.CheckPDF("missing.pdf", "min=1"); !strings.Contains(msg, "missing.pdf") {
		t.Errorf("a missing PDF: %q", msg)
	}
	if msg := s.CheckPDF("p.pdf", "pages=3"); !strings.Contains(msg, "pages") {
		t.Errorf("an unknown check: %q", msg)
	}
}
