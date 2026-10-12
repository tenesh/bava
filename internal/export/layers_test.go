package export

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/tharabyte/bava/internal/pdfprint"
	"github.com/tharabyte/bava/internal/testutil"
)

// What a webview's print draws on A4: the whole sheet filled white first,
// as macOS does, then a sheet's number in grey, or a page's line of text.
const (
	whiteA4  = "q 0 0 595.28 841.89 re W n /Cs1 cs 1 1 1 sc 0 -0.00001180172 595.28 841.89 re f Q"
	numberA4 = "q /Cs1 cs 0.45 0.45 0.45 sc 294 20 7 9 re f Q"
	// A page's own drawing: a line of text, as a dark bar.
	textA4 = "q /Cs1 cs 0 0 0 sc 72 760 300 12 re f Q"
)

// A printer that fills every sheet white, as the macOS webview does, and
// draws a page as a line of text.
func whitePrinter(html string, setup pdfprint.PageSetup, out string) error {
	n := strings.Count(html, `class="sheet"`)
	page := whiteA4 + "\n" + numberA4
	if n == 0 {
		n, page = 1, whiteA4+"\n"+textA4
	}
	pages := make([]string, n)
	for i := range pages {
		pages[i] = page
	}
	return os.WriteFile(out, testutil.DrawnPDF(pages, 210, 297), 0o644)
}

// With page numbers on, every page still shows: nothing white is laid
// over it, whatever the webview fills a sheet with.
func TestNumberedPagesAreNotCovered(t *testing.T) {
	out := filepath.Join(t.TempDir(), "Launch plan.pdf")
	req := Request{Setup: a4, Numbers: true, Ink: "#737373", Document: &Page{HTML: "<p>one page</p>", WidthPx: 720}}
	if err := PagePDF(context.Background(), req, sources(), whitePrinter, out); err != nil {
		t.Fatal(err)
	}
	pdf, err := os.ReadFile(out)
	if err != nil {
		t.Fatal(err)
	}
	covering, err := CoveringSheets(context.Background(), pdf)
	if err != nil {
		t.Fatal(err)
	}
	if covering != 0 {
		t.Errorf("%d white sheets laid over the pages", covering)
	}
}
