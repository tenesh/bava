package app_test

import (
	"context"
	"encoding/base64"
	"errors"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"testing"

	"github.com/tenesh/bava/internal/app"
	"github.com/tenesh/bava/internal/format"
	"github.com/tenesh/bava/internal/space"
	"github.com/tenesh/bava/internal/testutil"
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
	testutil.WriteTree(t, root, map[string]string{"Press.md": "# Press\n"})
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
	testutil.WriteTree(t, root, map[string]string{"Plan.md": "# Plan\n", "Roadmap.md": "[Plan](Plan.md)\n"})
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
	testutil.WriteTree(t, root, map[string]string{"a.md": "# a.md", "b.md": "# b.md"})
	if err := os.Chmod(filepath.Join(root, "b.md"), 0); err != nil {
		t.Fatal(err)
	}
	// Readable again, so t.TempDir's cleanup can remove it.
	t.Cleanup(func() { _ = os.Chmod(filepath.Join(root, "b.md"), 0o644) })
	if _, err := os.ReadFile(filepath.Join(root, "b.md")); err == nil {
		t.Skip("a root user can still read a file with no permissions")
	}
	got := s.Index(root, true)
	for _, page := range got.Pages {
		if page.Unreadable != (page.Path == "b.md") {
			t.Errorf("%s: unreadable %v", page.Path, page.Unreadable)
		}
	}
}

// A canvas embed's picture: saved under its own name first, then redrawn in
// place; data that is not base64 is refused.
func TestSavePictureFirstThenInPlace(t *testing.T) {
	root := t.TempDir()
	s := spaceService(nil)
	s.Open(root)
	data := func(text string) string { return base64.StdEncoding.EncodeToString([]byte(text)) }
	first := s.Apply(root, app.Operation{Kind: "savePicture", Name: "Roadmap - Box.png", Data: data("one")})
	if first.Error != "" || first.Name != "Roadmap - Box.png" {
		t.Fatalf("savePicture = %+v", first)
	}
	second := s.Apply(root, app.Operation{Kind: "savePicture", Name: "Roadmap - Box.png", Data: data("two")})
	if second.Name != "Roadmap - Box 2.png" {
		t.Errorf("a second first picture took %q", second.Name)
	}
	redrawn := s.Apply(root, app.Operation{Kind: "savePicture", Name: "Roadmap - Box.png", Data: data("three"), Replace: true})
	if redrawn.Error != "" || redrawn.Name != "Roadmap - Box.png" {
		t.Fatalf("savePicture replace = %+v", redrawn)
	}
	if got, _ := os.ReadFile(filepath.Join(root, ".bava", "attachments", "Roadmap - Box.png")); string(got) != "three" {
		t.Errorf("the picture holds %q", got)
	}
	if bad := s.Apply(root, app.Operation{Kind: "savePicture", Name: "x.png", Data: "not base64!"}); bad.Error == "" {
		t.Error("data that is not base64 was saved")
	}
}

func TestDeleteSpaceDataKeepsThePages(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "Roadmap.md"), []byte("# Roadmap\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	s := spaceService(nil)
	s.Open(root)
	if result := s.Apply(root, app.Operation{Kind: "deleteSpaceData"}); result.Error != "" {
		t.Fatalf("deleteSpaceData = %+v", result)
	}
	if _, err := os.Stat(filepath.Join(root, ".bava")); !os.IsNotExist(err) {
		t.Errorf(".bava is still there: %v", err)
	}
	if _, err := os.Stat(filepath.Join(root, "Roadmap.md")); err != nil {
		t.Errorf("the page went: %v", err)
	}
}

func TestTemplatesSavedListedChangedAndUsed(t *testing.T) {
	root := t.TempDir()
	s := spaceService(nil)
	s.Open(root)
	scene := format.Scene{Version: format.Version, Elements: []format.Element{{ID: "e1", Type: "rect", W: 10, H: 10, Z: 1}}}

	saved := s.SaveTemplate(root, "Meetings", "Weekly sync", "---\ntags: [meeting]\n---\n# Weekly sync\n", scene, false)
	if saved.Error != "" || saved.Path != ".bava/templates/Meetings/Weekly sync.md" {
		t.Fatalf("SaveTemplate = %+v", saved)
	}
	if again := s.SaveTemplate(root, "Meetings", "Weekly sync", "x", scene, false); again.Code != "exists" {
		t.Errorf("a taken name = %+v, want the exists refusal", again)
	}
	list := s.Templates(root)
	if list.Error != "" || len(list.Templates) != 1 || list.Templates[0].Group != "Meetings" {
		t.Fatalf("Templates = %+v", list)
	}

	made := s.CreatePageFrom(root, "", "Monday", "---\ntags: [meeting]\n---\n# Weekly sync\n", scene)
	if made.Error != "" || made.Path != "Monday.md" {
		t.Fatalf("CreatePageFrom = %+v", made)
	}
	opened := app.NewFileService(app.FileServiceOptions{}).Open(filepath.Join(root, "Monday.md"))
	if opened.Source != "---\ntags: [meeting]\n---\n# Weekly sync\n" || len(opened.Scene.Elements) != 1 {
		t.Errorf("the page made = %q, %d elements", opened.Source, len(opened.Scene.Elements))
	}
	if entries := s.List(root, "").Entries; len(entries) != 1 || entries[0].Path != "Monday.md" {
		t.Errorf("the page is not in the tree: %+v", entries)
	}

	for _, op := range []app.Operation{
		{Kind: "renameTemplate", Path: ".bava/templates/Meetings/Weekly sync.md", Name: "Daily"},
		{Kind: "moveTemplate", Path: ".bava/templates/Meetings/Daily.md", Folder: "Rituals"},
		{Kind: "duplicateTemplate", Path: ".bava/templates/Rituals/Daily.md"},
		{Kind: "deleteTemplate", Path: ".bava/templates/Rituals/Daily 2.md"},
	} {
		if result := s.Apply(root, op); result.Error != "" {
			t.Fatalf("%s = %+v", op.Kind, result)
		}
	}
	if list := s.Templates(root); len(list.Templates) != 1 || list.Templates[0].Path != ".bava/templates/Rituals/Daily.md" {
		t.Errorf("after the changes = %+v", list.Templates)
	}
}

// Search goes through the Space's own rules: the root is checked, the open
// page's text is used, and a refusal comes back as data.
func TestSearchFindsPagesAndRefusesAnUnknownRoot(t *testing.T) {
	root := t.TempDir()
	s := spaceService(nil)
	s.Open(root)
	testutil.WriteTree(t, root, map[string]string{"a.md": "launch\n", "b.md": "nothing\n"})
	got := s.Search(root, "launch", &space.OpenPage{Path: "b.md", Source: "launch too\n"})
	if got.Error != "" || len(got.Hits) != 2 || got.More {
		t.Fatalf("Search = %+v; want both pages, one by its unsaved text", got)
	}
	if bad := s.Search(filepath.Join(root, "missing"), "launch", nil); bad.Error == "" || bad.Hits == nil {
		t.Errorf("Search on no Space = %+v; want an error and an empty list", bad)
	}
}
