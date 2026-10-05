package app_test

import (
	"testing"

	"github.com/tenesh/bava/internal/app"
	"github.com/tenesh/bava/internal/testutil"
)

// The frontend reads these names, and sends some back. A Go field renamed
// without its json tag would compile, pass every other test, and break the
// frontend silently.
func TestServiceTypesKeepTheirJSONKeys(t *testing.T) {
	cases := []struct {
		name  string
		value any
		keys  []string
	}{
		{"OpenResult", app.OpenResult{}, []string{"diagrams", "error", "path", "scene", "source", "stamp"}},
		{"SaveResult", app.SaveResult{}, []string{"error", "path", "stamp"}},
		{"DialogResult", app.DialogResult{}, []string{"error", "path"}},
		{"PathsResult", app.PathsResult{}, []string{"error", "paths"}},
		{"FileDetailsResult", app.FileDetailsResult{}, []string{"error", "exists", "modified", "size"}},
		{"FilesDropped", app.FilesDropped{}, []string{"paths", "x", "y"}},
		{"LogEntry", app.LogEntry{}, []string{"kind", "level", "source", "stack"}},
		{"Notice", app.Notice{}, []string{"kind", "session"}},
		{"AppError", app.AppError{}, []string{"id"}},
		{"SpaceInfo", app.SpaceInfo{}, []string{"code", "error", "name", "pageWidth", "root"}},
		{"SpaceList", app.SpaceList{}, []string{"code", "entries", "error"}},
		{"OpResult", app.OpResult{}, []string{"code", "error", "id", "missed", "name", "path", "root"}},
		{"SpaceIndex", app.SpaceIndex{}, []string{"code", "error", "pages"}},
		{"IndexPage", app.IndexPage{}, []string{"name", "path", "text", "unreadable"}},
		{"PageEdit", app.PageEdit{}, []string{"after", "before", "path"}},
		{"TrashList", app.TrashList{}, []string{"code", "error", "items", "size"}},
		{"Operation", app.Operation{}, []string{"attachment", "data", "edits", "folder", "id", "index", "kind", "name", "path", "replace", "source", "width"}},
		{"Problem", app.Problem{}, []string{"code", "error"}},
		{"CardDetails", app.CardDetails{}, []string{"description", "error", "icon", "image", "title"}},
		{"AttachmentList", app.AttachmentList{}, []string{"attachments", "error"}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			testutil.AssertJSONKeys(t, tc.value, tc.keys...)
		})
	}
}
