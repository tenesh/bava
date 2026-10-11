package space_test

import (
	"testing"

	"github.com/tharabyte/bava/internal/space"
	"github.com/tharabyte/bava/internal/testutil"
)

// These reach the frontend inside the Space service's results, by these names.
func TestSpaceTypesKeepTheirJSONKeys(t *testing.T) {
	cases := []struct {
		name  string
		value any
		keys  []string
	}{
		{"Entry", space.Entry{}, []string{"kind", "name", "path"}},
		{"Attachment", space.Attachment{}, []string{"modified", "name", "size"}},
		{"TrashItem", space.TrashItem{}, []string{"deletedAt", "id", "kind", "path", "size"}},
		{"Template", space.Template{}, []string{"group", "name", "path"}},
		{"Hit", space.Hit{}, []string{"best", "count", "folder", "kind", "name", "path"}},
		{"Match", space.Match{}, []string{"element", "occurrence", "text", "where", "word"}},
		{"OpenPage", space.OpenPage{}, []string{"path", "scene", "source"}},
		{"ZipScope", space.ZipScope{}, []string{"attachments", "kind", "path"}},
		{"ZipFile", space.ZipFile{}, []string{"path", "size"}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			testutil.AssertJSONKeys(t, tc.value, tc.keys...)
		})
	}
}
