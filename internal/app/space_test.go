package app_test

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"testing"

	"github.com/tenesh/bava/internal/app"
	"github.com/tenesh/bava/internal/web"
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
	if res := s.Reveal(root, ""); res.Error != "" || revealed[0] != root || revealed[1] != "" {
		t.Errorf("Reveal(space) = %+v, %v", res, revealed)
	}
	s.Apply(root, app.Operation{Kind: "createPage", Name: "a"})
	if res := s.Reveal(root, "a.md"); res.Error != "" || revealed[0] != filepath.Join(root, "a.md") || revealed[1] != "select" {
		t.Errorf("Reveal(page) = %+v, %v", res, revealed)
	}
	// A refusal comes with its code, for the frontend to word.
	if res := s.Reveal(root, "../elsewhere"); res.Code != "outside" {
		t.Errorf("revealing outside the Space = %+v, want code outside", res)
	}
	if res := app.NewSpaceService(app.SpaceServiceOptions{}).Reveal(root, ""); res.Code != "revealUnavailable" {
		t.Errorf("Reveal with no file manager = %+v, want code revealUnavailable", res)
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
		{"OpResult", app.OpResult{}, []string{"code", "error", "id", "missed", "name", "path", "root"}},
		{"SpaceIndex", app.SpaceIndex{}, []string{"code", "error", "pages"}},
		{"IndexPage", app.IndexPage{}, []string{"name", "path", "text", "unreadable"}},
		{"PageEdit", app.PageEdit{}, []string{"after", "before", "path"}},
		{"TrashList", app.TrashList{}, []string{"code", "error", "items", "size"}},
		{"Operation", app.Operation{}, []string{"attachment", "data", "edits", "folder", "id", "index", "kind", "name", "path", "source", "width"}},
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
		if res := s.Reveal(root, ""); res.Error == "" {
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

// The smoke test build answers the folder picker from its scenario; the app
// otherwise shows the native one.
func TestChooseFolderUsesTheGivenPicker(t *testing.T) {
	s := app.NewSpaceService(app.SpaceServiceOptions{
		ChooseFolder: func(title string) (string, error) { return "/scratch/" + title, nil },
	})
	if got := s.ChooseFolder("Spaces"); got.Path != "/scratch/Spaces" || got.Error != "" {
		t.Errorf("ChooseFolder = %+v", got)
	}
}

func TestSpaceIndexListsPagesAndRelinkWritesUnchangedOnes(t *testing.T) {
	root := t.TempDir()
	s := spaceService(nil)
	s.Open(root)
	for name, text := range map[string]string{"Plan.md": "# Plan\n", "Roadmap.md": "[Plan](Plan.md)\n"} {
		if err := os.WriteFile(filepath.Join(root, name), []byte(text), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	index := s.Index(root, true)
	if index.Error != "" || len(index.Pages) != 2 || index.Pages[1].Text != "[Plan](Plan.md)\n" {
		t.Fatalf("Index = %+v", index)
	}
	if bare := s.Index(root, false); bare.Pages[1].Text != "" {
		t.Errorf("Index without text = %+v", bare)
	}
	res := s.Apply(root, app.Operation{Kind: "relink", Edits: []app.PageEdit{
		{Path: "Roadmap.md", Before: "[Plan](Plan.md)\n", After: "[Q4](Q4.md)\n"},
		{Path: "Plan.md", Before: "stale\n", After: "x\n"},
	}})
	if res.Error != "" || len(res.Missed) != 1 || res.Missed[0] != "Plan.md" {
		t.Fatalf("relink = %+v", res)
	}
	if got, _ := os.ReadFile(filepath.Join(root, "Roadmap.md")); string(got) != "[Q4](Q4.md)\n" {
		t.Errorf("Roadmap.md = %q", got)
	}
}

func TestSpaceAttachesFilesAndRenamesThem(t *testing.T) {
	root := t.TempDir()
	s := spaceService(nil)
	s.Open(root)
	source := filepath.Join(t.TempDir(), "logo.png")
	if err := os.WriteFile(source, []byte("one"), 0o644); err != nil {
		t.Fatal(err)
	}
	attached := s.Apply(root, app.Operation{Kind: "attach", Source: source})
	if attached.Error != "" || attached.Name != "logo.png" {
		t.Fatalf("attach = %+v", attached)
	}
	pasted := s.Apply(root, app.Operation{Kind: "attachData", Name: "Pasted image.png", Data: base64.StdEncoding.EncodeToString([]byte("png"))})
	if pasted.Error != "" || pasted.Name != "Pasted image.png" {
		t.Fatalf("attachData = %+v", pasted)
	}
	if bad := s.Apply(root, app.Operation{Kind: "attachData", Name: "x.png", Data: "not base64!"}); bad.Error == "" {
		t.Error("data that is not base64 was attached")
	}
	renamed := s.Apply(root, app.Operation{Kind: "renameAttachment", Attachment: "logo.png", Name: "brand"})
	if renamed.Error != "" || renamed.Name != "brand.png" {
		t.Fatalf("renameAttachment = %+v", renamed)
	}
}

// Bytes with no name, as a pasted screenshot has, are named by when they came.
func TestAttachDataWithNoNameIsAPastedImage(t *testing.T) {
	root := t.TempDir()
	s := spaceService(nil)
	s.Open(root)
	got := s.Apply(root, app.Operation{Kind: "attachData", Data: base64.StdEncoding.EncodeToString([]byte("png"))})
	if got.Error != "" || !regexp.MustCompile(`^Pasted image \d{4}-\d{2}-\d{2} \d{2}\.\d{2}\.\d{2}\.png$`).MatchString(got.Name) {
		t.Errorf("attachData = %+v", got)
	}
}

func fetching(details web.Details, err error) *app.SpaceService {
	return app.NewSpaceService(app.SpaceServiceOptions{Fetch: func(_ context.Context, address string, pictures bool) (web.Details, error) {
		if !pictures {
			details.Icon, details.Image = nil, nil
		}
		if address != "https://www.example.com/notes" {
			return web.Details{}, errors.New("asked for " + address)
		}
		return details, err
	}})
}

func TestFetchCardSavesTheSitesPicturesAsAttachments(t *testing.T) {
	root := t.TempDir()
	s := fetching(web.Details{Title: "Notes", Description: "Weekly.", Icon: &web.Picture{Data: []byte("i"), Ext: ".png"}, Image: &web.Picture{Data: []byte("p"), Ext: ".jpg"}}, nil)
	s.Open(root)
	got := s.FetchCard(root, "https://www.example.com/notes")
	if got.Error != "" || got.Title != "Notes" || got.Description != "Weekly." || got.Icon != "example.com icon.png" || got.Image != "example.com picture.jpg" {
		t.Fatalf("FetchCard = %+v", got)
	}
	for name, want := range map[string]string{got.Icon: "i", got.Image: "p"} {
		if b, err := os.ReadFile(filepath.Join(root, ".bava", "attachments", name)); err != nil || string(b) != want {
			t.Errorf("%s: %q, %v", name, b, err)
		}
	}
}

func TestFetchCardOutsideASpaceKeepsNoPictures(t *testing.T) {
	s := fetching(web.Details{Title: "Notes", Icon: &web.Picture{Data: []byte("i"), Ext: ".png"}}, nil)
	if got := s.FetchCard("", "https://www.example.com/notes"); got.Error != "" || got.Title != "Notes" || got.Icon != "" {
		t.Errorf("FetchCard = %+v", got)
	}
}

func TestFetchCardThatFailsSaysWhy(t *testing.T) {
	s := fetching(web.Details{}, errors.New("offline"))
	if got := s.FetchCard(t.TempDir(), "https://www.example.com/notes"); got.Error == "" {
		t.Errorf("FetchCard = %+v", got)
	}
}

func TestTheSpacesAttachmentsAreListedAndTrashed(t *testing.T) {
	root := t.TempDir()
	s := spaceService(nil)
	s.Open(root)
	if got := s.Attachments(root); got.Error != "" || got.Attachments == nil || len(got.Attachments) != 0 {
		t.Fatalf("none yet: %+v", got)
	}
	s.Apply(root, app.Operation{Kind: "attachData", Name: "a.png", Data: base64.StdEncoding.EncodeToString([]byte("png"))})
	if got := s.Attachments(root); len(got.Attachments) != 1 || got.Attachments[0].Name != "a.png" || got.Attachments[0].Size != 3 {
		t.Fatalf("Attachments = %+v", got)
	}
	trashed := s.Apply(root, app.Operation{Kind: "trashAttachment", Attachment: "a.png"})
	if trashed.Error != "" || trashed.ID == "" || len(s.Attachments(root).Attachments) != 0 {
		t.Errorf("trashAttachment = %+v", trashed)
	}
}

func TestAnAttachmentIsShownInItsFolder(t *testing.T) {
	root := t.TempDir()
	var revealed [2]string
	s := spaceService(&revealed)
	s.Open(root)
	s.Apply(root, app.Operation{Kind: "attachData", Name: "logo.png", Data: base64.StdEncoding.EncodeToString([]byte("png"))})
	if got := s.Reveal(root, ".bava/attachments/logo.png"); got.Error != "" || revealed[0] != filepath.Join(root, ".bava", "attachments", "logo.png") || revealed[1] != "select" {
		t.Errorf("Reveal = %+v, revealed %v", got, revealed)
	}
	for _, bad := range []string{".bava/attachments/../space.json", ".bava/space.json", ".bava/attachments/a/b.png"} {
		if got := s.Reveal(root, bad); got.Error == "" {
			t.Errorf("%s: revealed", bad)
		}
	}
}

// A page that cannot be read says so: its text is not "no links".
func TestIndexSaysWhichPagesCouldNotBeRead(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("a file cannot be made unreadable this way on Windows")
	}
	root := t.TempDir()
	s := spaceService(nil)
	s.Open(root)
	for _, name := range []string{"a.md", "b.md"} {
		if err := os.WriteFile(filepath.Join(root, name), []byte("# "+name), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.Chmod(filepath.Join(root, "b.md"), 0); err != nil {
		t.Fatal(err)
	}
	defer os.Chmod(filepath.Join(root, "b.md"), 0o644)
	if _, err := os.ReadFile(filepath.Join(root, "b.md")); err == nil {
		t.Skip("the file is still readable here")
	}
	got := s.Index(root, true)
	for _, page := range got.Pages {
		if page.Unreadable != (page.Path == "b.md") {
			t.Errorf("%s: unreadable %v", page.Path, page.Unreadable)
		}
	}
}
