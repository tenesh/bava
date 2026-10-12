package space_test

import (
	"archive/zip"
	"context"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"

	"github.com/tharabyte/bava/internal/space"
	"github.com/tharabyte/bava/internal/testutil"
)

// outside is a folder on disk, outside any Space, holding files.
func outside(t *testing.T, files map[string]string) string {
	t.Helper()
	dir := t.TempDir()
	testutil.WriteTree(t, dir, files)
	return dir
}

// zipOf writes a zip holding files, at their paths, and returns its path.
func zipOf(t *testing.T, files map[string]string) string {
	t.Helper()
	out := filepath.Join(t.TempDir(), "Export.zip")
	f, err := os.Create(out)
	if err != nil {
		t.Fatal(err)
	}
	w := zip.NewWriter(f)
	names := make([]string, 0, len(files))
	for name := range files {
		names = append(names, name)
	}
	sort.Strings(names)
	for _, name := range names {
		part, err := w.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := part.Write([]byte(files[name])); err != nil {
			t.Fatal(err)
		}
	}
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	if err := f.Close(); err != nil {
		t.Fatal(err)
	}
	return out
}

// landing lists the plan's entries as kind and place, for comparing.
func landing(plan space.ImportPlan) []string {
	var out []string
	for _, e := range plan.Entries {
		out = append(out, e.Kind+" "+e.To)
	}
	return out
}

func equal(t *testing.T, got, want []string) {
	t.Helper()
	sort.Strings(got)
	sort.Strings(want)
	if len(got) != len(want) {
		t.Fatalf("got %q, want %q", got, want)
	}
	for i := range got {
		if got[i] != want[i] {
			t.Fatalf("got %q, want %q", got, want)
		}
	}
}

func TestAnImportedFolderComesInWholeAndIsNumberedOnAClash(t *testing.T) {
	s := newSpace(t, "Marketing/Q4 notes/Old.md")
	src := outside(t, map[string]string{"Q4 notes/Goals.md": "# Goals\n", "Q4 notes/Research/Survey.md": "# Survey\n"})
	plan, err := s.ImportPlan([]string{filepath.Join(src, "Q4 notes")}, "Marketing")
	if err != nil {
		t.Fatal(err)
	}
	equal(t, landing(plan), []string{
		"folder Marketing/Q4 notes 2",
		"page Marketing/Q4 notes 2/Goals.md",
		"folder Marketing/Q4 notes 2/Research",
		"page Marketing/Q4 notes 2/Research/Survey.md",
	})
	if len(plan.Renames) != 1 || plan.Renames[0] != (space.ImportRename{From: "Q4 notes", To: "Q4 notes 2"}) {
		t.Errorf("renames = %+v, want Q4 notes to Q4 notes 2", plan.Renames)
	}
	if plan.Pages != 2 || plan.Files != 0 {
		t.Errorf("counts = %d pages, %d files; want 2, 0", plan.Pages, plan.Files)
	}
}

func TestImportedPagesLandInTheFolderEachNumberedOnAClash(t *testing.T) {
	s := newSpace(t, "Marketing/Launch plan.md")
	a := outside(t, map[string]string{"Launch plan.md": "# Mine\n", "Notes.md": "# Notes\n"})
	b := outside(t, map[string]string{"Notes.md": "# Other notes\n"})
	plan, err := s.ImportPlan([]string{filepath.Join(a, "Launch plan.md"), filepath.Join(a, "Notes.md"), filepath.Join(b, "Notes.md")}, "Marketing")
	if err != nil {
		t.Fatal(err)
	}
	equal(t, landing(plan), []string{"page Marketing/Launch plan 2.md", "page Marketing/Notes.md", "page Marketing/Notes 2.md"})
	if len(plan.Renames) != 2 {
		t.Errorf("renames = %+v, want Launch plan and the second Notes", plan.Renames)
	}
}

func TestHiddenFilesAndLinksStayBehind(t *testing.T) {
	s := newSpace(t)
	src := outside(t, map[string]string{
		"Notes/Page.md":          "# Page\n",
		"Notes/.git/config":      "[core]\n",
		"Notes/.settings/a.json": "{}\n",
		"Notes/.DS_Store":        "x",
	})
	if err := os.Symlink(filepath.Join(src, "Notes", "Page.md"), filepath.Join(src, "Notes", "Link.md")); err != nil {
		t.Skip("links unavailable:", err)
	}
	plan, err := s.ImportPlan([]string{filepath.Join(src, "Notes")}, "")
	if err != nil {
		t.Fatal(err)
	}
	equal(t, landing(plan), []string{"folder Notes", "page Notes/Page.md"})
}

// A name the Space would trim stays behind, as any name it cannot hold: it
// would land under another name than its links say.
// On disk the names lead with a space: Windows cannot make one ending in one.
func TestANameWithSpacesAtItsEndsStaysBehind(t *testing.T) {
	s := newSpace(t)
	src := outside(t, map[string]string{"Notes/Page.md": "# Page\n", "Notes/ Padded.md": "x", "Notes/ Sub/A.md": "a"})
	if _, err := s.Import(context.Background(), []string{filepath.Join(src, "Notes")}, "", nil); err != nil {
		t.Fatal(err)
	}
	equal(t, names(t, s, "Notes"), []string{"Page.md"})
	z := zipOf(t, map[string]string{"Notes/Page.md": "# Page\n", "Notes/ Padded.md": "x", "Sub /A.md": "a"})
	plan, err := s.ImportPlan([]string{z}, "")
	if err != nil {
		t.Fatal(err)
	}
	equal(t, landing(plan), []string{"folder Notes 2", "page Notes 2/Page.md"})

	// Picked by name, it comes in under the name the Space holds.
	picked := outside(t, map[string]string{" Picked.md": "# Picked\n", " Box/A.md": "a"})
	if _, err := s.Import(context.Background(), []string{filepath.Join(picked, " Picked.md"), filepath.Join(picked, " Box")}, "", nil); err != nil {
		t.Fatal(err)
	}
	for _, landed := range []string{"Picked.md", "Box/A.md"} {
		if _, err := os.Stat(filepath.Join(s.Root, landed)); err != nil {
			t.Error(err)
		}
	}
}

// A Space's folders reached through a link stay behind, as any link does.
func TestALinkedBavaFolderStaysBehind(t *testing.T) {
	s := newSpace(t)
	elsewhere := outside(t, map[string]string{"secret.png": "x", "Plan.md": "# Plan\n"})
	src := outside(t, map[string]string{"Notes/Page.md": "# Page\n", "Other/Page.md": "# Page\n", "Other/.bava/space.json": "{}"})
	links := map[string]string{
		filepath.Join(src, "Notes", ".bava"):                elsewhere,
		filepath.Join(src, "Other", ".bava", "attachments"): elsewhere,
		filepath.Join(src, "Other", ".bava", "templates"):   elsewhere,
	}
	for link, to := range links {
		if err := os.Symlink(to, link); err != nil {
			t.Skip("links unavailable:", err)
		}
	}
	plan, err := s.ImportPlan([]string{filepath.Join(src, "Notes"), filepath.Join(src, "Other")}, "")
	if err != nil {
		t.Fatal(err)
	}
	equal(t, landing(plan), []string{"folder Notes", "page Notes/Page.md", "folder Other", "page Other/Page.md"})
}

func TestEveryOtherFileComesInAsAnAttachment(t *testing.T) {
	s := newSpace(t)
	src := outside(t, map[string]string{"Notes/Page.md": "# Page\n", "Notes/chart.png": "png", "Notes/Data/budget.xlsx": "xlsx"})
	plan, err := s.ImportPlan([]string{filepath.Join(src, "Notes")}, "")
	if err != nil {
		t.Fatal(err)
	}
	equal(t, landing(plan), []string{"folder Notes", "page Notes/Page.md", "folder Notes/Data", "file chart.png", "file budget.xlsx"})
	if plan.Files != 2 || plan.Bytes != int64(len("# Page\n")+len("png")+len("xlsx")) {
		t.Errorf("files %d, bytes %d", plan.Files, plan.Bytes)
	}
}

func TestAFolderThatIsASpaceBringsItsAttachmentsAndTemplatesButNotItsSettings(t *testing.T) {
	s := newSpace(t)
	src := outside(t, map[string]string{
		"Old/Page.md":                        "# Page\n",
		"Old/.bava/space.json":               `{"version":1}`,
		"Old/.bava/attachments/logo.png":     "png",
		"Old/.bava/templates/Weekly sync.md": "# Sync\n",
		"Old/.bava/templates/Team/Retro.md":  "# Retro\n",
		"Old/.bava/trash/1/Gone.md":          "# Gone\n",
	})
	plan, err := s.ImportPlan([]string{filepath.Join(src, "Old")}, "")
	if err != nil {
		t.Fatal(err)
	}
	equal(t, landing(plan), []string{"folder Old", "page Old/Page.md", "file logo.png", "template Weekly sync.md", "template Team/Retro.md"})
	if plan.Templates != 2 {
		t.Errorf("templates = %d, want 2", plan.Templates)
	}
}

func TestAZipsPagesKeepTheirFolders(t *testing.T) {
	s := newSpace(t, "First page.md")
	zipped := zipOf(t, map[string]string{
		"First page.md":              "# First\n",
		"Marketing/Launch plan.md":   "# Plan\n",
		".bava/space.json":           `{"version":1}`,
		".bava/attachments/logo.png": "png",
		".bava/trash/1/Gone.md":      "# Gone\n",
		"Marketing/.hidden":          "x",
	})
	plan, err := s.ImportPlan([]string{zipped}, "")
	if err != nil {
		t.Fatal(err)
	}
	equal(t, landing(plan), []string{"page First page 2.md", "folder Marketing", "page Marketing/Launch plan.md", "file logo.png"})
}

func TestAZipsTemplatesAreNumberedOnAClash(t *testing.T) {
	s := newSpace(t)
	if _, err := s.SaveTemplate("", "Weekly sync", []byte("# Mine\n"), false); err != nil {
		t.Fatal(err)
	}
	zipped := zipOf(t, map[string]string{".bava/templates/Weekly sync.md": "# Theirs\n"})
	plan, err := s.ImportPlan([]string{zipped}, "")
	if err != nil {
		t.Fatal(err)
	}
	equal(t, landing(plan), []string{"template Weekly sync 2.md"})
}

// An entry that would leave the zip, or is a link, stays behind.
func TestAZipEntryThatLeavesTheZipOrIsALinkStaysBehind(t *testing.T) {
	s := newSpace(t)
	out := filepath.Join(t.TempDir(), "Export.zip")
	f, err := os.Create(out)
	if err != nil {
		t.Fatal(err)
	}
	w := zip.NewWriter(f)
	for _, name := range []string{"../evil.md", "/abs.md", "a/../../evil.md", `..\win.md`, ".bava/attachments/../../../up.png", "Notes/Page.md"} {
		part, err := w.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := part.Write([]byte("x")); err != nil {
			t.Fatal(err)
		}
	}
	link := &zip.FileHeader{Name: "Notes/Link.md"}
	link.SetMode(os.ModeSymlink | 0o777)
	part, err := w.CreateHeader(link)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := part.Write([]byte("/etc/passwd")); err != nil {
		t.Fatal(err)
	}
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	if err := f.Close(); err != nil {
		t.Fatal(err)
	}
	plan, err := s.ImportPlan([]string{out}, "")
	if err != nil {
		t.Fatal(err)
	}
	equal(t, landing(plan), []string{"folder Notes", "page Notes/Page.md"})
	if _, err := s.Import(context.Background(), []string{out}, "", nil); err != nil {
		t.Fatal(err)
	}
	for _, escaped := range []string{"evil.md", "abs.md", "win.md", "up.png"} {
		if _, err := os.Stat(filepath.Join(filepath.Dir(s.Root), escaped)); err == nil {
			t.Errorf("%s was written outside the Space", escaped)
		}
	}
}

// A zip's file at its top goes to the attachments: it takes no name in the
// folder, and renames nothing there.
func TestAZipsTopFileTakesNoNameInTheFolder(t *testing.T) {
	s := newSpace(t, "Marketing/Launch plan.md")
	plan, err := s.ImportPlan([]string{zipOf(t, map[string]string{"Marketing": "x", "Notes.md": "# Notes\n"})}, "")
	if err != nil {
		t.Fatal(err)
	}
	if len(plan.Renames) != 0 {
		t.Errorf("renames = %+v, want none", plan.Renames)
	}
	equal(t, landing(plan), []string{"file Marketing", "page Notes.md"})
}

// Names inside what comes in that differ only in case are kept apart: a disk
// that ignores case would take them for one.
func TestNamesDifferingOnlyInCaseAreNumbered(t *testing.T) {
	s := newSpace(t)
	z := zipOf(t, map[string]string{"D/A.md": "a", "D/a.md": "b", "D/Sub/x.md": "x", "D/sub/y.md": "y", "D/Sub/z.md": "z"})
	plan, err := s.ImportPlan([]string{z}, "")
	if err != nil {
		t.Fatal(err)
	}
	equal(t, landing(plan), []string{
		"folder D", "page D/A.md", "folder D/Sub", "page D/Sub/x.md", "page D/Sub/z.md",
		"page D/a 2.md", "folder D/sub 2", "page D/sub 2/y.md",
	})
	if _, err := s.Import(context.Background(), []string{z}, "", nil); err != nil {
		t.Fatal(err)
	}
	for _, landed := range []string{"D/A.md", "D/a 2.md", "D/Sub/x.md", "D/Sub/z.md", "D/sub 2/y.md"} {
		if _, err := os.Stat(filepath.Join(s.Root, filepath.FromSlash(landed))); err != nil {
			t.Error(err)
		}
	}
}

// A folder from a disk that tells case apart is numbered the same way.
func TestAFoldersNamesDifferingOnlyInCaseAreNumbered(t *testing.T) {
	src := outside(t, map[string]string{"D/A.md": "a", "D/a.md": "b"})
	if items, err := os.ReadDir(filepath.Join(src, "D")); err != nil || len(items) != 2 {
		t.Skip("this disk ignores case")
	}
	plan, err := newSpace(t).ImportPlan([]string{filepath.Join(src, "D")}, "")
	if err != nil {
		t.Fatal(err)
	}
	equal(t, landing(plan), []string{"folder D", "page D/A.md", "page D/a 2.md"})
}

func TestAFileThatIsNotAZipIsRefused(t *testing.T) {
	s := newSpace(t)
	src := outside(t, map[string]string{"Broken.zip": "not a zip"})
	_, err := s.ImportPlan([]string{filepath.Join(src, "Broken.zip")}, "")
	if !errors.Is(err, space.ErrNotImport) {
		t.Errorf("err = %v, want a not-importable refusal", err)
	}
}

func TestAnImportGoesIntoAFolderOfTheSpaceOnly(t *testing.T) {
	s := newSpace(t, "Page.md")
	src := outside(t, map[string]string{"Notes.md": "# Notes\n"})
	if _, err := s.ImportPlan([]string{filepath.Join(src, "Notes.md")}, "Page.md"); !errors.Is(err, space.ErrNotFolder) {
		t.Errorf("into a page: err = %v, want not a folder", err)
	}
	if _, err := s.ImportPlan([]string{filepath.Join(src, "Notes.md")}, "../elsewhere"); !errors.Is(err, space.ErrOutside) {
		t.Errorf("outside: err = %v, want outside", err)
	}
}

// tree lists every file under root with its bytes, .bava included, for
// comparing a Space before and after.
func tree(t *testing.T, root string) map[string]string {
	t.Helper()
	out := map[string]string{}
	err := filepath.WalkDir(root, func(p string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, _ := filepath.Rel(root, p)
		if d.IsDir() {
			out[filepath.ToSlash(rel)+"/"] = ""
			return nil
		}
		data, err := os.ReadFile(p)
		if err != nil {
			return err
		}
		out[filepath.ToSlash(rel)] = string(data)
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	return out
}

func TestImportedPagesArriveByteForByte(t *testing.T) {
	s := newSpace(t)
	odd := "# Notes\n\n*one*  \r\n- a\n* b\n\n[x](Other.md)\n"
	src := outside(t, map[string]string{"Notes/Page.md": odd})
	if _, err := s.Import(context.Background(), []string{filepath.Join(src, "Notes")}, "", nil); err != nil {
		t.Fatal(err)
	}
	got, err := os.ReadFile(filepath.Join(s.Root, "Notes", "Page.md"))
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != odd {
		t.Errorf("page = %q, want it byte for byte", got)
	}
	if names(t, s, "") == nil || names(t, s, "Notes")[0] != "Page.md" {
		t.Errorf("the imported folder is not in the tree: %v", names(t, s, "Notes"))
	}
}

func TestAnImportedFileWithBytesAlreadyAttachedReusesThem(t *testing.T) {
	s := newSpace(t)
	have, err := s.AttachData("logo.png", []byte("png"))
	if err != nil {
		t.Fatal(err)
	}
	src := outside(t, map[string]string{"Notes/brand.png": "png"})
	res, err := s.Import(context.Background(), []string{filepath.Join(src, "Notes")}, "", nil)
	if err != nil {
		t.Fatal(err)
	}
	if got := res.Attached["0:Notes/brand.png"]; got != have {
		t.Errorf("attached as %q, want the existing %q", got, have)
	}
}

func TestAnImportCountsEveryItemAsItLands(t *testing.T) {
	s := newSpace(t)
	src := outside(t, map[string]string{"Notes/A.md": "a", "Notes/B.md": "b", "Notes/c.png": "c"})
	var seen []string
	_, err := s.Import(context.Background(), []string{filepath.Join(src, "Notes")}, "", func(done, total int) {
		seen = append(seen, fmt.Sprintf("%d/%d", done, total))
	})
	if err != nil {
		t.Fatal(err)
	}
	equalOrdered(t, seen, []string{"1/4", "2/4", "3/4", "4/4"})
}

func TestACancelledImportLeavesTheSpaceAsItWas(t *testing.T) {
	s := newSpace(t, "Marketing/Launch plan.md")
	if _, err := s.AttachData("logo.png", []byte("png")); err != nil {
		t.Fatal(err)
	}
	if _, err := s.SaveTemplate("", "Weekly sync", []byte("# Mine\n"), false); err != nil {
		t.Fatal(err)
	}
	before := tree(t, s.Root)
	src := outside(t, map[string]string{
		"Old/A.md": "a", "Old/B.md": "b", "Old/Sub/C.md": "c",
		"Old/.bava/attachments/logo.png":     "png",
		"Old/.bava/attachments/new.png":      "new",
		"Old/.bava/templates/Team/Retro.md":  "# Retro\n",
		"Old/.bava/templates/Weekly sync.md": "# Theirs\n",
	})
	ctx, cancel := context.WithCancel(context.Background())
	_, err := s.Import(ctx, []string{filepath.Join(src, "Old")}, "Marketing", func(done, total int) {
		if done == total-1 {
			cancel()
		}
	})
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("err = %v, want cancelled", err)
	}
	after := tree(t, s.Root)
	// space.json may now spell out an order it left implicit: what the tree
	// shows is compared below, not its bytes.
	delete(before, ".bava/space.json")
	delete(after, ".bava/space.json")
	if len(after) != len(before) {
		t.Fatalf("the Space changed:\nbefore %v\nafter  %v", before, after)
	}
	for name, content := range before {
		if after[name] != content {
			t.Errorf("%s changed or went: %q", name, after[name])
		}
	}
	equalOrdered(t, names(t, s, "Marketing"), []string{"Launch plan.md"})
}

// folders lists the folders under the Space's .bava folder.
func folders(t *testing.T, s space.Space) []string {
	t.Helper()
	var got []string
	err := filepath.WalkDir(filepath.Join(s.Root, space.Dir), func(p string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			rel, _ := filepath.Rel(s.Root, p)
			got = append(got, filepath.ToSlash(rel))
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	return got
}

// Undone, an import takes only the folders it made: an empty template
// group the Space had stays, and a templates folder it made goes.
func TestACancelledImportLeavesTemplateFoldersAsTheyWere(t *testing.T) {
	// The template lands before the last page, where the import is stopped.
	src := outside(t, map[string]string{"Old/A.md": "a", "Old/.bava/templates/Team/Retro.md": "# Retro\n", "Last.md": "last"})
	cancelled := func(s space.Space) {
		t.Helper()
		ctx, cancel := context.WithCancel(context.Background())
		_, err := s.Import(ctx, []string{filepath.Join(src, "Old"), filepath.Join(src, "Last.md")}, "", func(done, total int) {
			if done == total-1 {
				cancel()
			}
		})
		if !errors.Is(err, context.Canceled) {
			t.Fatalf("err = %v, want cancelled", err)
		}
	}

	none := newSpace(t)
	before := folders(t, none)
	cancelled(none)
	equal(t, folders(t, none), before)

	kept := newSpace(t)
	if err := os.MkdirAll(filepath.Join(kept.Root, space.Dir, "templates", "Empty"), 0o755); err != nil {
		t.Fatal(err)
	}
	before = folders(t, kept)
	cancelled(kept)
	equal(t, folders(t, kept), before)
}

func TestANameTakenAfterThePlanIsNumberedNotOverwritten(t *testing.T) {
	s := newSpace(t)
	src := outside(t, map[string]string{"Notes.md": "# Theirs\n"})
	plan, err := s.ImportPlan([]string{filepath.Join(src, "Notes.md")}, "")
	if err != nil {
		t.Fatal(err)
	}
	if plan.Entries[0].To != "Notes.md" {
		t.Fatalf("planned %q", plan.Entries[0].To)
	}
	if _, err := s.CreatePageWith("", "Notes", []byte("# Mine\n")); err != nil {
		t.Fatal(err)
	}
	res, err := s.Import(context.Background(), []string{filepath.Join(src, "Notes.md")}, "", nil)
	if err != nil {
		t.Fatal(err)
	}
	if res.Pages[0].Path != "Notes 2.md" {
		t.Errorf("landed at %q, want Notes 2.md", res.Pages[0].Path)
	}
	if mine, _ := os.ReadFile(filepath.Join(s.Root, "Notes.md")); string(mine) != "# Mine\n" {
		t.Errorf("the page there was overwritten: %q", mine)
	}
}

func TestAZipImportBringsPagesFilesAndTemplates(t *testing.T) {
	s := newSpace(t)
	zipped := zipOf(t, map[string]string{
		"Marketing/Launch plan.md":       "# Plan\n![](../.bava/attachments/logo.png)\n",
		".bava/attachments/logo.png":     "png",
		".bava/templates/Weekly sync.md": "# Sync\n",
	})
	res, err := s.Import(context.Background(), []string{zipped}, "", nil)
	if err != nil {
		t.Fatal(err)
	}
	if got, _ := os.ReadFile(filepath.Join(s.Root, "Marketing", "Launch plan.md")); string(got) != "# Plan\n![](../.bava/attachments/logo.png)\n" {
		t.Errorf("page = %q", got)
	}
	if res.Attached["0:.bava/attachments/logo.png"] != "logo.png" {
		t.Errorf("attached = %v", res.Attached)
	}
	if _, err := os.Stat(filepath.Join(s.Root, ".bava", "templates", "Weekly sync.md")); err != nil {
		t.Errorf("template: %v", err)
	}
	if len(res.Pages) != 1 || res.Pages[0].From != "Marketing/Launch plan.md" || res.Pages[0].Origin != 0 {
		t.Errorf("pages = %+v", res.Pages)
	}
}

func equalOrdered(t *testing.T, got, want []string) {
	t.Helper()
	if fmt.Sprint(got) != fmt.Sprint(want) {
		t.Errorf("got %v, want %v", got, want)
	}
}

// A cancel stops a file mid-copy: it never waits for a large one to end.
func TestACancelStopsAFileMidCopy(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	r := space.UntilCancelled(ctx, io.NopCloser(strings.NewReader(strings.Repeat("x", 1<<20))))
	if _, err := r.Read(make([]byte, 1024)); err != nil {
		t.Fatal(err)
	}
	cancel()
	if _, err := r.Read(make([]byte, 1024)); !errors.Is(err, context.Canceled) {
		t.Errorf("err = %v, want cancelled", err)
	}
}
