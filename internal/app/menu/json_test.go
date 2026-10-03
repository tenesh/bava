package menu_test

import (
	"testing"

	"github.com/tenesh/bava/internal/app/menu"
	"github.com/tenesh/bava/internal/testutil"
)

// The frontend sends the state and receives the commands by these names.
func TestMenuTypesKeepTheirJSONKeys(t *testing.T) {
	cases := []struct {
		name  string
		value any
		keys  []string
	}{
		// Populated, not zero: omitempty hides the argument.
		{"Command", menu.Command{ID: "file.openRecent", Arg: "/a.md"}, []string{"arg", "id"}},
		{"State", menu.State{}, []string{
			"canPasteStyles", "hasDocument", "hasLocked", "hasSelection", "hasSpace", "objectSnap",
			"recents", "showsAI", "showsCanvas", "showsFiles", "theme", "tool", "viewMode",
		}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			testutil.AssertJSONKeys(t, tc.value, tc.keys...)
		})
	}
}
