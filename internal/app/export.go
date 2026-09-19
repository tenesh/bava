package app

import (
	"encoding/base64"
	"fmt"

	"github.com/tenesh/bava/internal/store"
)

// ExportService writes an exported picture to disk.
//
// The picture itself is drawn in the frontend, which owns the canvas: this
// side only puts bytes where the user asked. It is deliberately not part of
// FileService, which is about the user's documents; an export is a copy, and
// nothing here touches the document or its stamp.
type ExportService struct{}

// NewExportService constructs the service registered with the application.
func NewExportService() *ExportService { return &ExportService{} }

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
