package app_test

import (
	"encoding/base64"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/tenesh/bava/internal/app"
	"github.com/tenesh/bava/internal/export"
	"github.com/tenesh/bava/internal/pdfprint"
	"github.com/tenesh/bava/internal/testutil"
)

// An exported picture is the user's file, written where they asked. It is
// carried as base64 because the Wails bridge is JSON: bytes would arrive as a
// number array, several times the size.
func TestExportWritesTheBytesItWasGiven(t *testing.T) {
	path := filepath.Join(t.TempDir(), "diagram.png")
	// A PNG's first bytes, so the test would notice base64 that round-trips wrong.
	want := []byte{0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13}

	if msg := app.NewExportService(app.ExportServiceOptions{}).Save(path, base64.StdEncoding.EncodeToString(want)); msg != "" {
		t.Fatal(msg)
	}

	got, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != string(want) {
		t.Errorf("file = % x, want % x", got, want)
	}
}

func TestExportRefusesWhatItCannotWrite(t *testing.T) {
	dir := t.TempDir()
	cases := []struct {
		name     string
		path     string
		contents string
		want     string
	}{
		{"no path", "", "", "path"},
		{"malformed base64", filepath.Join(dir, "a.png"), "not base64!", "decode"},
		{"a folder that is not there", filepath.Join(dir, "missing", "a.png"), "", "export"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			msg := app.NewExportService(app.ExportServiceOptions{}).Save(tc.path, tc.contents)
			if msg == "" {
				t.Fatal("want an error message, got none")
			}
			if !strings.Contains(strings.ToLower(msg), tc.want) {
				t.Errorf("message = %q, want it to mention %q", msg, tc.want)
			}
		})
	}
}

// An export overwrites its own earlier version rather than appending to it.
func TestExportReplacesAnExistingFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "diagram.svg")
	if err := os.WriteFile(path, []byte("<svg>old and longer</svg>"), 0o600); err != nil {
		t.Fatal(err)
	}
	if msg := app.NewExportService(app.ExportServiceOptions{}).Save(path, base64.StdEncoding.EncodeToString([]byte("<svg/>"))); msg != "" {
		t.Fatal(msg)
	}
	got, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != "<svg/>" {
		t.Errorf("file = %q, want the new contents only", got)
	}
}

// pdfExport is an export service with one opened Space holding a logo,
// whose printer writes a two-page A4 PDF and keeps what it was given.
func pdfExport(t *testing.T) (*app.ExportService, string, *[]string) {
	t.Helper()
	root := t.TempDir()
	testutil.WriteTree(t, root, map[string]string{".bava/attachments/logo.png": "PNG"})
	folders := app.NewOpenedFolders()
	folders.Allow(root)
	var printed []string
	service := app.NewExportService(app.ExportServiceOptions{
		Folders: folders,
		Fonts:   fstest.MapFS{},
		Print: func(html string, _ pdfprint.PageSetup, out string) error {
			printed = append(printed, html)
			return os.WriteFile(out, testutil.BlankPDF(2, 210, 297), 0o644)
		},
	})
	return service, root, &printed
}

var a4 = pdfprint.PageSetup{Paper: pdfprint.A4, Margins: pdfprint.Margins{Top: 20, Right: 20, Bottom: 20, Left: 20}}

func TestAPagesPDFIsWrittenWithItsPicturesInside(t *testing.T) {
	service, root, printed := pdfExport(t)
	out := filepath.Join(t.TempDir(), "Launch plan.pdf")
	page := export.Page{HTML: `<img src="/bava-file/?root=` + url.QueryEscape(root) + `&amp;path=.bava%2Fattachments%2Flogo.png">`}
	if p := service.PagePDF(root, export.Request{Setup: a4, Document: &page}, out); p != (app.Problem{}) {
		t.Fatal(p)
	}
	if _, err := os.Stat(out); err != nil {
		t.Fatal(err)
	}
	if len(*printed) != 1 || !strings.Contains((*printed)[0], "data:image/png;base64,UE5H") {
		t.Errorf("printed = %q; want the page with its picture inside", *printed)
	}
}

func TestAPagesPDFIsRefusedWithACode(t *testing.T) {
	service, root, _ := pdfExport(t)
	out := filepath.Join(t.TempDir(), "x.pdf")
	page := &export.Page{HTML: "<p>x</p>"}
	for name, c := range map[string]struct {
		root string
		req  export.Request
		code string
	}{
		"a folder not opened": {t.TempDir(), export.Request{Setup: a4, Document: page}, "notOpened"},
		"nothing included":    {root, export.Request{Setup: a4}, "nothing"},
		"a paper too small":   {root, export.Request{Setup: pdfprint.PageSetup{Paper: pdfprint.A5, Margins: pdfprint.Margins{Left: 80, Right: 80}}, Document: page}, "setup"},
	} {
		p := service.PagePDF(c.root, c.req, out)
		if p.Code != c.code || p.Error == "" {
			t.Errorf("%s: %+v; want code %q and a message", name, p, c.code)
		}
	}
}

// A build with no way to print says so rather than failing quietly.
func TestAPDFWithoutPrintingSaysSo(t *testing.T) {
	root := t.TempDir()
	folders := app.NewOpenedFolders()
	folders.Allow(root)
	p := app.NewExportService(app.ExportServiceOptions{Folders: folders}).PagePDF(root, export.Request{Setup: a4, Document: &export.Page{}}, filepath.Join(t.TempDir(), "x.pdf"))
	if p.Code != "unavailable" {
		t.Errorf("problem = %+v; want unavailable", p)
	}
}

// A print that fails says so with a code, as every refusal does.
func TestAFailedPrintComesBackWithACode(t *testing.T) {
	root := t.TempDir()
	folders := app.NewOpenedFolders()
	folders.Allow(root)
	service := app.NewExportService(app.ExportServiceOptions{Folders: folders, Print: func(string, pdfprint.PageSetup, string) error { return os.ErrPermission }})
	p := service.PagePDF(root, export.Request{Setup: a4, Document: &export.Page{}}, filepath.Join(t.TempDir(), "x.pdf"))
	if p.Code != "failed" || p.Error == "" {
		t.Errorf("problem = %+v; want failed and a message", p)
	}
}
