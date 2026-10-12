package e2e

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/pdfcpu/pdfcpu/pkg/api"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/types"

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

// "clear": no sheet laid over the pages (page numbers, a fill) hides them
// under white, as a webview's print can paint a sheet.
func TestAPDFFileIsCheckedForPagesHiddenUnderWhite(t *testing.T) {
	dir := t.TempDir()
	page := testutil.DrawnPDF([]string{"q /Cs1 cs 0 0 0 sc 72 760 300 12 re f Q"}, 210, 297)
	white := testutil.DrawnPDF([]string{"q 0 0 595.28 841.89 re W n /Cs1 cs 1 1 1 sc 0 0 595.28 841.89 re f Q"}, 210, 297)
	wm, err := api.PDFMultiWatermarkForReadSeeker(context.Background(), bytes.NewReader(white), 1, 1, "scale:1 abs, rot:0", true, false, types.POINTS)
	if err != nil {
		t.Fatal(err)
	}
	var covered bytes.Buffer
	if err := api.AddWatermarks(context.Background(), bytes.NewReader(page), &covered, nil, wm, nil); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "covered.pdf"), covered.Bytes(), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "page.pdf"), page, 0o644); err != nil {
		t.Fatal(err)
	}
	s := NewService(Options{Scratch: dir})
	if msg := s.CheckPDF("page.pdf", "clear"); msg != "" {
		t.Errorf("a page with nothing over it failed: %s", msg)
	}
	if msg := s.CheckPDF("covered.pdf", "clear"); !strings.Contains(msg, "white") {
		t.Errorf("a page under a white sheet passed: %q", msg)
	}
}

// "numbered": each page carries its own number, 1 upwards, in order.
func TestAPDFFileIsCheckedForItsPageNumbers(t *testing.T) {
	dir := t.TempDir()
	blank := testutil.BlankPDF(3, 210, 297)
	wm, err := api.TextWatermark(context.Background(), "%p", "fontname:Helvetica, points:9, position:bc, scalefactor:1 abs, rotation:0", true, false, types.POINTS, nil)
	if err != nil {
		t.Fatal(err)
	}
	var numbered bytes.Buffer
	if err := api.AddWatermarks(context.Background(), bytes.NewReader(blank), &numbered, nil, wm, nil); err != nil {
		t.Fatal(err)
	}
	for name, data := range map[string][]byte{"numbered.pdf": numbered.Bytes(), "bare.pdf": blank} {
		if err := os.WriteFile(filepath.Join(dir, name), data, 0o644); err != nil {
			t.Fatal(err)
		}
	}
	s := NewService(Options{Scratch: dir})
	if msg := s.CheckPDF("numbered.pdf", "numbered"); msg != "" {
		t.Errorf("a numbered PDF failed: %s", msg)
	}
	if msg := s.CheckPDF("bare.pdf", "numbered"); !strings.Contains(msg, "number") {
		t.Errorf("a PDF with no numbers passed: %q", msg)
	}
}
