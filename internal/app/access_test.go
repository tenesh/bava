package app_test

import (
	"path/filepath"
	"testing"

	"github.com/tharabyte/bava/internal/access"
	"github.com/tharabyte/bava/internal/app"
)

// sandbox stands in for a store's sandbox: a path is the token.
type sandbox struct{}

func (sandbox) Sandboxed() bool                        { return true }
func (sandbox) Keep(path string) ([]byte, error)       { return []byte(path), nil }
func (sandbox) Restore(t []byte) (string, bool, error) { return string(t), false, nil }

func sandboxed(t *testing.T) *access.Store {
	t.Helper()
	s, err := access.Open(filepath.Join(t.TempDir(), "access.json"), sandbox{})
	if err != nil {
		t.Fatal(err)
	}
	return s
}

// Whatever the user picks through a dialog is kept, so a later launch may
// reach it inside a sandbox.
func TestWhatTheUserPicksIsKept(t *testing.T) {
	grants := sandboxed(t)
	folder, file, saved := t.TempDir(), filepath.Join(t.TempDir(), "logo.png"), filepath.Join(t.TempDir(), "Plan.pdf")
	spaces := app.NewSpaceService(app.SpaceServiceOptions{Access: grants, ChooseFolder: func(string) (string, error) { return folder, nil }})
	files := app.NewFileService(app.FileServiceOptions{
		Access:      grants,
		ChooseFiles: func(string) ([]string, error) { return []string{file}, nil },
		ChooseSave:  func(string) (string, error) { return saved, nil },
	})
	spaces.ChooseFolder("Open Space", "")
	files.ChooseMedia("image")
	files.ChooseFileToSave("Plan.pdf")
	for _, p := range []string{folder, file, saved} {
		if !grants.Reachable(p) {
			t.Errorf("%s was not kept", p)
		}
	}
}

// The frontend asks which recent Spaces can be opened.
func TestWhichPathsAreReachable(t *testing.T) {
	grants := sandboxed(t)
	open := t.TempDir()
	if err := grants.Allow(open); err != nil {
		t.Fatal(err)
	}
	got := app.NewSpaceService(app.SpaceServiceOptions{Access: grants}).Reachable([]string{open, t.TempDir()})
	if len(got) != 2 || !got[0] || got[1] {
		t.Errorf("reachable = %v; want [true false]", got)
	}
	// Without a store, whatever exists is reachable.
	if got := app.NewSpaceService(app.SpaceServiceOptions{}).Reachable([]string{open, "/no/such/folder"}); !got[0] || got[1] {
		t.Errorf("without a store: %v", got)
	}
}

// "Find it again" opens the folder dialog where the Space last was, or the
// nearest folder above it that is still there.
func TestAFolderDialogStartsAtTheNearestPlaceStillThere(t *testing.T) {
	root := t.TempDir()
	gone := filepath.Join(root, "Moved", "Acme Product")
	if got := app.StartFolder(gone); got != root {
		t.Errorf("start = %q; want %q", got, root)
	}
	if got := app.StartFolder(root); got != root {
		t.Errorf("start = %q; want the folder itself", got)
	}
	if got := app.StartFolder(""); got != "" {
		t.Errorf("start = %q; want none", got)
	}
}
