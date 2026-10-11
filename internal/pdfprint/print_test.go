package pdfprint

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"
)

// A setup that cannot be printed is refused before any webview is made.
func TestAJobIsMadeOnlyFromAPrintableSetup(t *testing.T) {
	ok := PageSetup{Paper: A4, Margins: Margins{Top: 20, Right: 20, Bottom: 20, Left: 20}}
	out := filepath.Join(t.TempDir(), "x.pdf")
	j, err := newJob("<p>x</p>", ok, out)
	if err != nil || j.widthMM != 210 || j.heightMM != 297 {
		t.Fatalf("job = %+v (%v); want A4", j, err)
	}
	for name, setup := range map[string]PageSetup{
		"margins wider than the paper": {Paper: A5, Margins: Margins{Left: 80, Right: 80}},
		"a negative margin":            {Paper: A4, Margins: Margins{Top: -1}},
		"an unknown paper":             {Paper: "A9"},
	} {
		if _, err := newJob("<p>x</p>", setup, out); err == nil {
			t.Errorf("%s: accepted", name)
		}
	}
	if _, err := newJob("<p>x</p>", ok, "relative.pdf"); err == nil {
		t.Error("a relative output path was accepted")
	}
}

// The page is handed to the webview as a file of its own in the system's
// temporary folder, holding the HTML, and is gone once the print is over,
// whether it worked or not.
func TestAPrintLoadsThePageFromATemporaryFileItRemoves(t *testing.T) {
	setup := PageSetup{Paper: A4}
	for name, fails := range map[string]bool{"printed": false, "failed": true} {
		var page string
		printer := func(j job, _ RunOnMain, _ time.Duration) error {
			page = j.page
			b, err := os.ReadFile(j.page)
			if err != nil || string(b) != "<p>big</p>" {
				t.Errorf("%s: the page file holds %q (%v)", name, b, err)
			}
			if fails {
				return errors.New("no printer")
			}
			return nil
		}
		err := printWith(printer, "<p>big</p>", setup, filepath.Join(t.TempDir(), "x.pdf"), nil)
		if (err != nil) != fails {
			t.Errorf("%s: err = %v", name, err)
		}
		if filepath.Dir(page) != filepath.Clean(os.TempDir()) || filepath.Ext(page) != ".html" {
			t.Errorf("%s: page file at %s; want an .html in %s", name, page, os.TempDir())
		}
		if _, err := os.Stat(page); !errors.Is(err, os.ErrNotExist) {
			t.Errorf("%s: %s was left behind", name, page)
		}
	}
}

// A page's file address, as WebView2 is given it.
func TestAFileAddressHasThreeSlashesAndForwardOnes(t *testing.T) {
	for path, want := range map[string]string{
		`C:/Users/me/AppData/Local/Temp/bava-print-1.html`: "file:///C:/Users/me/AppData/Local/Temp/bava-print-1.html",
		"/tmp/bava print.html":                             "file:///tmp/bava%20print.html",
	} {
		if got := fileURL(path); got != want {
			t.Errorf("fileURL(%q) = %q; want %q", path, got, want)
		}
	}
}
