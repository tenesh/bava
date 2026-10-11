package space_test

import (
	"archive/zip"
	"errors"
	"io"
	"os"
	"path/filepath"
	"reflect"
	"runtime"
	"testing"
	"time"

	"github.com/tharabyte/bava/internal/space"
	"github.com/tharabyte/bava/internal/testutil"
)

func zipSpace(t *testing.T) space.Space {
	t.Helper()
	root := t.TempDir()
	testutil.WriteTree(t, root, map[string]string{
		"Roadmap.md":                     "# Roadmap\n",
		"Marketing/Launch plan.md":       "![logo](../.bava/attachments/logo.png)\n",
		"Marketing/notes.txt":            "kept as it lies\n",
		".hidden/secret.md":              "never\n",
		".DS_Store":                      "never\n",
		".bava/attachments/logo.png":     "PNG",
		".bava/attachments/unused.pdf":   "PDF",
		".bava/templates/Weekly sync.md": "# Weekly\n",
		".bava/trash/1/Old.md":           "thrown away\n",
	})
	s, err := space.Open(root)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func planPaths(t *testing.T, s space.Space, scope space.ZipScope) []string {
	t.Helper()
	plan, err := s.ZipPlan(scope)
	if err != nil {
		t.Fatal(err)
	}
	out := []string{}
	for _, f := range plan {
		out = append(out, f.Path)
	}
	return out
}

func TestASpacesZipHoldsEverythingButTheTrash(t *testing.T) {
	s := zipSpace(t)
	got := planPaths(t, s, space.ZipScope{Kind: space.ZipSpace})
	want := []string{
		".bava/attachments/logo.png",
		".bava/attachments/unused.pdf",
		".bava/space.json",
		".bava/templates/Weekly sync.md",
		"Marketing/Launch plan.md",
		"Marketing/notes.txt",
		"Roadmap.md",
	}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("plan = %q;\nwant %q", got, want)
	}
}

func TestAFoldersZipKeepsItsPlaceWithTheFilesItsPagesUse(t *testing.T) {
	s := zipSpace(t)
	got := planPaths(t, s, space.ZipScope{Kind: space.ZipFolder, Path: "Marketing", Attachments: []string{"logo.png"}})
	want := []string{".bava/attachments/logo.png", "Marketing/Launch plan.md", "Marketing/notes.txt"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("plan = %q; want %q", got, want)
	}
}

func TestAPagesZipHoldsThePageAndTheFilesItUses(t *testing.T) {
	s := zipSpace(t)
	got := planPaths(t, s, space.ZipScope{Kind: space.ZipPage, Path: "Marketing/Launch plan.md", Attachments: []string{"logo.png"}})
	want := []string{".bava/attachments/logo.png", "Marketing/Launch plan.md"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("plan = %q; want %q", got, want)
	}
}

func TestAPlanGivesEachFilesSize(t *testing.T) {
	s := zipSpace(t)
	plan, err := s.ZipPlan(space.ZipScope{Kind: space.ZipPage, Path: "Roadmap.md"})
	if err != nil || len(plan) != 1 || plan[0].Size != int64(len("# Roadmap\n")) {
		t.Errorf("plan = %+v (%v); want Roadmap.md and its size", plan, err)
	}
}

func TestAZipPlanRefusesWhatIsNotTheSpaces(t *testing.T) {
	s := zipSpace(t)
	for name, scope := range map[string]space.ZipScope{
		"outside":            {Kind: space.ZipFolder, Path: "../elsewhere"},
		"hidden":             {Kind: space.ZipFolder, Path: ".hidden"},
		"a missing page":     {Kind: space.ZipPage, Path: "Gone.md"},
		"a folder as a page": {Kind: space.ZipPage, Path: "Marketing"},
		"a page as a folder": {Kind: space.ZipFolder, Path: "Roadmap.md"},
		"a missing file":     {Kind: space.ZipPage, Path: "Roadmap.md", Attachments: []string{"nope.png"}},
		"a path for a file":  {Kind: space.ZipPage, Path: "Roadmap.md", Attachments: []string{"../trash/1/Old.md"}},
		"an unknown kind":    {Kind: "everything"},
	} {
		if _, err := s.ZipPlan(scope); err == nil {
			t.Errorf("%s: accepted", name)
		} else if space.Code(err) == "" && name != "a missing page" && name != "an unknown kind" {
			t.Errorf("%s: refused without a code: %v", name, err)
		}
	}
}

func TestALinkInTheSpaceIsNotFollowedIntoTheZip(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("symbolic links need privileges on Windows")
	}
	s := zipSpace(t)
	outside := t.TempDir()
	testutil.WriteTree(t, outside, map[string]string{"private.md": "never\n"})
	if err := os.Symlink(outside, filepath.Join(s.Root, "Linked")); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(filepath.Join(outside, "private.md"), filepath.Join(s.Root, "Marketing", "ln.md")); err != nil {
		t.Fatal(err)
	}
	for _, scope := range []space.ZipScope{{Kind: space.ZipSpace}, {Kind: space.ZipFolder, Path: "Marketing"}} {
		for _, p := range planPaths(t, s, scope) {
			if filepath.Dir(p) == "Linked" || filepath.Base(p) == "ln.md" {
				t.Errorf("%s: the plan followed a link: %s", scope.Kind, p)
			}
		}
	}
}

func TestTheZipWrittenHoldsThePlanByteForByte(t *testing.T) {
	s := zipSpace(t)
	scope := space.ZipScope{Kind: space.ZipFolder, Path: "Marketing", Attachments: []string{"logo.png"}}
	out := filepath.Join(t.TempDir(), "Marketing.zip")
	if err := s.WriteZip(scope, out); err != nil {
		t.Fatal(err)
	}
	r, err := zip.OpenReader(out)
	if err != nil {
		t.Fatal(err)
	}
	defer r.Close()
	got := map[string]string{}
	for _, f := range r.File {
		rc, err := f.Open()
		if err != nil {
			t.Fatal(err)
		}
		b, _ := io.ReadAll(rc)
		rc.Close()
		got[f.Name] = string(b)
	}
	want := map[string]string{
		".bava/attachments/logo.png": "PNG",
		"Marketing/Launch plan.md":   "![logo](../.bava/attachments/logo.png)\n",
		"Marketing/notes.txt":        "kept as it lies\n",
	}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("zip = %q; want %q", got, want)
	}
}

func TestAFailedZipLeavesNoFile(t *testing.T) {
	s := zipSpace(t)
	out := filepath.Join(t.TempDir(), "missing folder", "x.zip")
	if err := s.WriteZip(space.ZipScope{Kind: space.ZipSpace}, out); err == nil {
		t.Fatal("a zip into a folder that is not there was written")
	}
	if _, err := os.Stat(out); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("a failed write left %s", out)
	}
}

// A write that fails once the temporary file exists leaves nothing behind.
func TestAZipThatFailsMidWayLeavesNoTemporaryFile(t *testing.T) {
	s := zipSpace(t)
	dir := t.TempDir()
	out := filepath.Join(dir, "taken")
	if err := os.Mkdir(out, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := s.WriteZip(space.ZipScope{Kind: space.ZipSpace}, out); err == nil {
		t.Fatal("a zip over a folder was written")
	}
	entries, _ := os.ReadDir(dir)
	if len(entries) != 1 {
		t.Errorf("left behind: %v", entries)
	}
}

func TestAZipsPlaceMustBeAFullPath(t *testing.T) {
	s := zipSpace(t)
	for _, out := range []string{"", "relative.zip"} {
		err := s.WriteZip(space.ZipScope{Kind: space.ZipSpace}, out)
		if err == nil || space.Code(err) == "" {
			t.Errorf("WriteZip(%q) = %v; want a refusal with a code", out, err)
		}
	}
}

// Unzipped files keep the dates they had in the Space.
func TestAZipKeepsEachFilesTime(t *testing.T) {
	s := zipSpace(t)
	when := time.Date(2026, 3, 4, 5, 6, 7, 0, time.UTC)
	if err := os.Chtimes(filepath.Join(s.Root, "Roadmap.md"), when, when); err != nil {
		t.Fatal(err)
	}
	out := filepath.Join(t.TempDir(), "r.zip")
	if err := s.WriteZip(space.ZipScope{Kind: space.ZipPage, Path: "Roadmap.md"}, out); err != nil {
		t.Fatal(err)
	}
	r, err := zip.OpenReader(out)
	if err != nil {
		t.Fatal(err)
	}
	defer r.Close()
	if got := r.File[0].Modified.UTC(); !got.Equal(when) {
		t.Errorf("modified = %v; want %v", got, when)
	}
}
