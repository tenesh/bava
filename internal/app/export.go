package app

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"github.com/tharabyte/bava/internal/export"

	"github.com/tharabyte/bava/internal/store"
)

// ExportService writes an exported picture to disk.
//
// The picture itself is drawn in the frontend, which owns the canvas: this
// side only puts bytes where the user asked. It is deliberately not part of
// FileService, which is about the user's documents; an export is a copy, and
// nothing here touches the document or its stamp.
type ExportService struct {
	options ExportServiceOptions
}

// ExportServiceOptions are what a PDF export reads from and prints with.
type ExportServiceOptions struct {
	// Folders are the folders opened this session: a PDF is made only of a
	// page in one, and shows only pictures from them.
	Folders *OpenedFolders
	// Fonts are the app's own files, where the page's fonts are read.
	Fonts fs.FS
	// Print has the system's webview print a page; nil where it cannot.
	Print export.Printer
	// Failed learns why a PDF failed, its words included; only the
	// end-to-end build sets it, to show the run why. Nil learns nothing:
	// the words name the user's files, so the app never logs them.
	Failed func(error)
	// Runs are the long tasks the page can stop, shared with the
	// SpaceService, whose Cancel stops them; nil keeps the service's own.
	Runs *Runs
}

// NewExportService constructs the service registered with the application.
func NewExportService(options ExportServiceOptions) *ExportService {
	if options.Runs == nil {
		options.Runs = NewRuns()
	}
	return &ExportService{options: options}
}

// Save writes base64-encoded bytes to path, returning a message the user can
// act on, or "" when it worked.
//
// The contents arrive base64-encoded because the bridge is JSON: raw bytes
// would cross as an array of numbers, several times the size of the image.
// The write is the same atomic temp-and-rename a document save uses, so a
// failure never leaves half a PNG where a whole one used to be, and a missing
// folder is an error rather than something silently created.
func (s *ExportService) Save(path, contentsBase64 string) string {
	if path == "" {
		return "export: no path was given"
	}
	contents, err := base64.StdEncoding.DecodeString(contentsBase64)
	if err != nil {
		return fmt.Sprintf("export: could not decode the image: %v", err)
	}
	if err := store.Save(path, string(contents)); err != nil {
		return fmt.Sprintf("export: %v", err)
	}
	return ""
}

// PagePDF prints a page of the Space at root to a PDF at out: its
// Document, its Canvas or both, as the request says. The page's HTML and
// its Canvas's picture are drawn in the frontend; this side puts the fonts
// and pictures inside, prints, and writes. A zero Problem means it worked.
func (s *ExportService) PagePDF(root string, req export.Request, out string) Problem {
	if !s.options.Folders.Allowed(root) {
		return Problem{Error: "export: that folder is not open", Code: "notOpened"}
	}
	if s.options.Print == nil {
		return Problem{Error: "export: printing to PDF is not available on this system", Code: "unavailable"}
	}
	if err := req.Setup.Check(); err != nil {
		return Problem{Error: fmt.Sprintf("export: %v", err), Code: "setup"}
	}
	src := export.Sources{Fonts: s.options.Fonts, Picture: s.picture}
	err := export.PagePDF(context.Background(), req, src, s.options.Print, out)
	switch {
	case err == nil:
		return Problem{}
	case errors.Is(err, export.ErrNothing):
		return Problem{Error: err.Error(), Code: "nothing"}
	}
	s.failed(err)
	return Problem{Error: fmt.Sprintf("export: %v", err), Code: "failed"}
}

// picture reads a picture a page shows, by the same rules the page is shown
// it: an image in an opened folder, never through a link.
func (s *ExportService) picture(root, rel string) ([]byte, string, error) {
	clean, kind, err := servable(s.options.Folders, root, rel)
	if err != nil {
		return nil, "", err
	}
	// A video is printed as its card: never carried whole into the page.
	if !strings.HasPrefix(kind, "image/") {
		return nil, "", errors.New("not a picture")
	}
	dir, err := os.OpenRoot(filepath.Clean(root))
	if err != nil {
		return nil, "", err
	}
	defer dir.Close()
	data, err := dir.ReadFile(clean)
	if err != nil {
		return nil, "", err
	}
	return data, kind, nil
}

// SpacePDFResult is how a folder's or the Space's PDF went: empty when it
// was written; else why not, with a code, and the page that failed.
type SpacePDFResult struct {
	Error string `json:"error"`
	Code  string `json:"code"`
	// Page is the path of the page that could not be printed, for "page".
	Page string `json:"page"`
}

// SpacePDF prints a folder or the Space at root to one PDF at out: the
// contents, then each page as the request draws it. Codes are as PagePDF's,
// "page" when a page could not be printed (Page names it), and
// CodeCancelled when SpaceService.Cancel(run) stopped it: it stops between
// pages and writes nothing.
func (s *ExportService) SpacePDF(ctx context.Context, root, run string, req export.SpaceRequest, out string) SpacePDFResult {
	ctx, done := s.options.Runs.start(ctx, run)
	defer done()
	if !s.options.Folders.Allowed(root) {
		return SpacePDFResult{Error: "export: that folder is not open", Code: "notOpened"}
	}
	if s.options.Print == nil {
		return SpacePDFResult{Error: "export: printing to PDF is not available on this system", Code: "unavailable"}
	}
	if err := req.Setup.Check(); err != nil {
		return SpacePDFResult{Error: fmt.Sprintf("export: %v", err), Code: "setup"}
	}
	src := export.Sources{Fonts: s.options.Fonts, Picture: s.picture}
	err := export.SpacePDF(ctx, req, src, s.options.Print, out)
	var failed *export.PageError
	switch {
	case err == nil:
		return SpacePDFResult{}
	case errors.Is(err, context.Canceled):
		// Before a failed page: a cancel can surface while a page is read.
		return SpacePDFResult{Error: err.Error(), Code: CodeCancelled}
	case errors.As(err, &failed):
		return SpacePDFResult{Error: fmt.Sprintf("export: %v", err), Code: "page", Page: failed.Path}
	case errors.Is(err, export.ErrNothing):
		return SpacePDFResult{Error: err.Error(), Code: "nothing"}
	}
	s.failed(err)
	return SpacePDFResult{Error: fmt.Sprintf("export: %v", err), Code: "failed"}
}

func (s *ExportService) failed(err error) {
	if s.options.Failed != nil {
		s.options.Failed(err)
	}
}
