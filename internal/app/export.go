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

	"github.com/tenesh/bava/internal/export"

	"github.com/tenesh/bava/internal/store"
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
}

// NewExportService constructs the service registered with the application.
func NewExportService(options ExportServiceOptions) *ExportService {
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
