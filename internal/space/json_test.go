package space_test

import (
	"testing"

	"github.com/tenesh/bava/internal/space"
	"github.com/tenesh/bava/internal/testutil"
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
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			testutil.AssertJSONKeys(t, tc.value, tc.keys...)
		})
	}
}
