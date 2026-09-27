package app_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"github.com/tenesh/bava/internal/app"
)

func spaceService(revealed *[2]string) *app.SpaceService {
	return app.NewSpaceService(app.SpaceServiceOptions{
		Reveal: func(path string, selectFile bool) error {
			if revealed != nil {
				revealed[0] = path
				if selectFile {
					revealed[1] = "select"
				}
			}
			return nil
		},
	})
}

func TestSpaceOpenReportsTheSpace(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "Acme Product")
	if err := os.Mkdir(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	info := spaceService(nil).Open(dir)
	if info.Error != "" || info.Name != "Acme Product" || info.Root != dir {
		t.Fatalf("Open = %+v", info)
	}
	if _, err := os.Stat(filepath.Join(dir, ".bava", "space.json")); err != nil {
		t.Error("no space.json")
	}
}

// Errors are data: a problem the user can act on comes back in the result.
func TestSpaceErrorsComeBackInTheResult(t *testing.T) {
	s := spaceService(nil)
	if info := s.Open(filepath.Join(t.TempDir(), "missing")); info.Error == "" {
		t.Error("Open of a missing folder reported no error")
	}
	root := t.TempDir()
	s.Open(root)
	if res := s.Apply(root, app.Operation{Kind: "rename", Path: "../x.md", Name: "y"}); res.Error == "" {
		t.Error("an escaping path reported no error")
	}
	if res := s.Apply(root, app.Operation{Kind: "juggle"}); res.Error == "" {
		t.Error("an unknown operation reported no error")
	}
}

func TestSpaceApplyRunsEachOperation(t *testing.T) {
	root := t.TempDir()
	s := spaceService(nil)
	s.Open(root)
	steps := []struct {
		op   app.Operation
		want string
	}{
		{app.Operation{Kind: "createFolder", Name: "Marketing"}, "Marketing"},
		{app.Operation{Kind: "createPage", Folder: "Marketing", Name: "Launch plan"}, "Marketing/Launch plan.md"},
		{app.Operation{Kind: "duplicate", Path: "Marketing/Launch plan.md"}, "Marketing/Launch plan 2.md"},
		{app.Operation{Kind: "rename", Path: "Marketing/Launch plan 2.md", Name: "Press"}, "Marketing/Press.md"},
		{app.Operation{Kind: "move", Path: "Marketing/Press.md", Folder: "", Index: -1}, "Press.md"},
	}
	for _, step := range steps {
		res := s.Apply(root, step.op)
		if res.Error != "" || res.Path != step.want {
			t.Fatalf("%s = %+v, want path %q", step.op.Kind, res, step.want)
		}
	}
	list := s.List(root, "")
	if list.Error != "" || len(list.Entries) != 2 {
		t.Fatalf("List = %+v", list)
	}
	if err := os.WriteFile(filepath.Join(root, "Press.md"), []byte("# Press\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	trashed := s.Apply(root, app.Operation{Kind: "trash", Path: "Press.md"})
	if trashed.Error != "" || trashed.ID == "" {
		t.Fatalf("trash = %+v", trashed)
	}
	trash := s.Trash(root)
	if len(trash.Items) != 1 || trash.Size == 0 {
		t.Fatalf("Trash = %+v", trash)
	}
	if res := s.Apply(root, app.Operation{Kind: "restore", ID: trashed.ID}); res.Path != "Press.md" {
		t.Fatalf("restore = %+v", res)
	}
	if res := s.Apply(root, app.Operation{Kind: "setPageWidth", Width: "narrow"}); res.Error != "" {
		t.Fatalf("setPageWidth = %+v", res)
	}
	if info := s.Open(root); info.PageWidth != "narrow" {
		t.Errorf("page width = %q", info.PageWidth)
	}
}

func TestSpaceRevealShowsTheFolderOrSelectsAnItem(t *testing.T) {
	root := t.TempDir()
	var revealed [2]string
	s := spaceService(&revealed)
	s.Open(root)
	if msg := s.Reveal(root, ""); msg != "" || revealed[0] != root || revealed[1] != "" {
		t.Errorf("Reveal(space) = %q, %v", msg, revealed)
	}
	s.Apply(root, app.Operation{Kind: "createPage", Name: "a"})
	if msg := s.Reveal(root, "a.md"); msg != "" || revealed[0] != filepath.Join(root, "a.md") || revealed[1] != "select" {
		t.Errorf("Reveal(page) = %q, %v", msg, revealed)
	}
	if msg := s.Reveal(root, "../elsewhere"); msg == "" {
		t.Error("revealing outside the Space was allowed")
	}
}

func TestSpaceJSONFieldNames(t *testing.T) {
	cases := []struct {
		name string
		v    any
		keys []string
	}{
		{"SpaceInfo", app.SpaceInfo{}, []string{"code", "error", "name", "pageWidth", "root"}},
		{"SpaceList", app.SpaceList{}, []string{"code", "entries", "error"}},
		{"OpResult", app.OpResult{}, []string{"code", "error", "id", "path", "root"}},
		{"TrashList", app.TrashList{}, []string{"code", "error", "items", "size"}},
		{"Operation", app.Operation{}, []string{"folder", "id", "index", "kind", "name", "path", "width"}},
	}
	for _, c := range cases {
		b, err := json.Marshal(c.v)
		if err != nil {
			t.Fatal(err)
		}
		assertKeys(t, c.name, b, c.keys)
	}
}

// A root that is empty, relative or not a Space must be refused, or every
// operation would run against the process's working folder.
func TestSpaceServiceRefusesARootThatIsNotASpace(t *testing.T) {
	s := spaceService(nil)
	plain := t.TempDir()
	for _, root := range []string{"", "relative/dir", plain} {
		if res := s.Apply(root, app.Operation{Kind: "emptyTrash"}); res.Error == "" {
			t.Errorf("Apply(%q) was allowed", root)
		}
		if list := s.List(root, ""); list.Error == "" {
			t.Errorf("List(%q) was allowed", root)
		}
		if trash := s.Trash(root); trash.Error == "" {
			t.Errorf("Trash(%q) was allowed", root)
		}
		if msg := s.Reveal(root, ""); msg == "" {
			t.Errorf("Reveal(%q) was allowed", root)
		}
	}
}

// A refusal the user can act on comes with a code, so the frontend words it
// in the user's language.
func TestSpaceRefusalsComeWithACode(t *testing.T) {
	s := spaceService(nil)
	root := t.TempDir()
	s.Open(root)
	s.Apply(root, app.Operation{Kind: "createPage", Name: "a"})
	s.Apply(root, app.Operation{Kind: "createPage", Name: "b"})
	if res := s.Apply(root, app.Operation{Kind: "rename", Path: "a.md", Name: "b"}); res.Code != "exists" {
		t.Errorf("Code = %q, want exists (%s)", res.Code, res.Error)
	}
	if res := s.Apply(root, app.Operation{Kind: "juggle"}); res.Code != "" {
		t.Errorf("an unknown failure has code %q", res.Code)
	}
}

func TestSpaceCreateReportsTheNewSpace(t *testing.T) {
	parent := t.TempDir()
	info := spaceService(nil).Create(parent, "Acme")
	if info.Error != "" || info.Name != "Acme" || info.Root != filepath.Join(parent, "Acme") {
		t.Fatalf("Create = %+v", info)
	}
	if again := spaceService(nil).Create(parent, "Acme"); again.Code != "exists" {
		t.Errorf("a second Create = %+v, want code exists", again)
	}
}
