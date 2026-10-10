package pdfprint_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/tenesh/bava/internal/pdfprint"
)

func TestInspectReadsPagesAndTheirSize(t *testing.T) {
	info, err := pdfprint.Inspect(filepath.Join("testdata", "two-a4.pdf"))
	if err != nil {
		t.Fatal(err)
	}
	if info.Pages != 2 || len(info.Sizes) != 2 {
		t.Fatalf("info = %+v; want 2 pages", info)
	}
	for _, s := range info.Sizes {
		if s.WidthMM != 210 || s.HeightMM != 297 {
			t.Errorf("size = %+v; want 210 × 297 mm", s)
		}
	}
}

// A page with no MediaBox of its own takes its parent's, as the PDF format
// lets it.
func TestInspectTakesAnInheritedPageSize(t *testing.T) {
	info, err := pdfprint.Inspect(filepath.Join("testdata", "inherited-letter.pdf"))
	if err != nil {
		t.Fatal(err)
	}
	if info.Pages != 1 || info.Sizes[0].WidthMM != 215.9 || info.Sizes[0].HeightMM != 279.4 {
		t.Errorf("info = %+v; want one Letter page", info)
	}
}

// A landscape page may be printed as a portrait box turned a quarter: it
// reads as it shows.
func TestInspectTurnsARotatedPage(t *testing.T) {
	info, err := pdfprint.Inspect(filepath.Join("testdata", "rotated-letter.pdf"))
	if err != nil {
		t.Fatal(err)
	}
	if info.Sizes[0].WidthMM != 279.4 || info.Sizes[0].HeightMM != 215.9 {
		t.Errorf("size = %+v; want Letter landscape, 279.4 × 215.9", info.Sizes[0])
	}
}

func TestInspectRefusesWhatIsNotAPDF(t *testing.T) {
	path := filepath.Join(t.TempDir(), "x.pdf")
	if err := os.WriteFile(path, []byte("hello"), 0o600); err != nil {
		t.Fatal(err)
	}
	_, err := pdfprint.Inspect(path)
	if err == nil {
		t.Fatal("a text file was read as a PDF")
	}
	if !strings.Contains(err.Error(), "x.pdf") {
		t.Errorf("error %q does not name the file", err)
	}
}
