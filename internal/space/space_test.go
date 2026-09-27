package space_test

import (
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"github.com/tenesh/bava/internal/space"
)

// newSpace makes a folder with the given files ("a/b.md", "dir/") and opens it.
func newSpace(t *testing.T, paths ...string) space.Space {
	t.Helper()
	root := t.TempDir()
	for _, p := range paths {
		full := filepath.Join(root, filepath.FromSlash(p))
		if strings.HasSuffix(p, "/") {
			if err := os.MkdirAll(full, 0o755); err != nil {
				t.Fatal(err)
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(full, []byte("# "+p+"\n"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	s, err := space.Open(root)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func names(t *testing.T, s space.Space, folder string) []string {
	t.Helper()
	entries, err := s.List(folder)
	if err != nil {
		t.Fatal(err)
	}
	out := []string{}
	for _, e := range entries {
		out = append(out, e.Name)
	}
	return out
}

func exists(root, rel string) bool {
	_, err := os.Stat(filepath.Join(root, filepath.FromSlash(rel)))
	return err == nil
}

func TestOpenMakesTheSpaceFileAndRefusesAFile(t *testing.T) {
	s := newSpace(t)
	if !exists(s.Root, ".bava/space.json") {
		t.Error("Open did not create .bava/space.json")
	}
	file := filepath.Join(t.TempDir(), "page.md")
	_ = os.WriteFile(file, []byte("x"), 0o644)
	if _, err := space.Open(file); err == nil {
		t.Error("Open accepted a file")
	}
}

// Pages and folders only: no .d2, no hidden entries, never .bava.
func TestListShowsFoldersAndPagesOnly(t *testing.T) {
	s := newSpace(t, "b.md", "A/", "c.d2", ".hidden.md", "notes.txt", "z.md")
	got, err := s.List("")
	if err != nil {
		t.Fatal(err)
	}
	var shown []string
	for _, e := range got {
		shown = append(shown, e.Kind+":"+e.Name)
	}
	want := []string{"folder:A", "page:b.md", "page:z.md"}
	if !reflect.DeepEqual(shown, want) {
		t.Errorf("List = %v, want %v", shown, want)
	}
}

func TestOperationsChangeTheDiskAndTheOrder(t *testing.T) {
	cases := []struct {
		name   string
		start  []string
		do     func(s space.Space) error
		folder string
		want   []string
		files  []string
	}{
		{
			name:  "a new page goes at the end",
			start: []string{"b.md", "a.md"},
			do:    func(s space.Space) error { _, err := s.CreatePage("", "c"); return err },
			want:  []string{"a.md", "b.md", "c.md"},
			files: []string{"c.md"},
		},
		{
			name:  "a new folder goes at the end",
			start: []string{"a.md"},
			do:    func(s space.Space) error { _, err := s.CreateFolder("", "Aardvark"); return err },
			want:  []string{"a.md", "Aardvark"},
			files: []string{"Aardvark/"},
		},
		{
			name:  "reordering moves within a folder",
			start: []string{"a.md", "b.md", "c.md"},
			do:    func(s space.Space) error { _, err := s.Move("c.md", "", 0); return err },
			want:  []string{"c.md", "a.md", "b.md"},
		},
		{
			name:  "a rename keeps its place",
			start: []string{"a.md", "b.md", "c.md"},
			do: func(s space.Space) error {
				if _, err := s.Move("c.md", "", 0); err != nil {
					return err
				}
				_, err := s.Rename("c.md", "zebra")
				return err
			},
			want:  []string{"zebra.md", "a.md", "b.md"},
			files: []string{"zebra.md"},
		},
		{
			name:   "moving into a folder goes where it was dropped",
			start:  []string{"a.md", "F/x.md", "F/y.md"},
			do:     func(s space.Space) error { _, err := s.Move("a.md", "F", 1); return err },
			folder: "F",
			want:   []string{"x.md", "a.md", "y.md"},
			files:  []string{"F/a.md"},
		},
		{
			name:  "a duplicate sits after its original, numbered",
			start: []string{"a.md", "b.md"},
			do:    func(s space.Space) error { _, err := s.Duplicate("a.md"); return err },
			want:  []string{"a.md", "a 2.md", "b.md"},
			files: []string{"a 2.md"},
		},
		{
			name:  "a renamed folder keeps its contents' order",
			start: []string{"F/x.md", "F/y.md"},
			do: func(s space.Space) error {
				if _, err := s.Move("F/y.md", "F", 0); err != nil {
					return err
				}
				_, err := s.Rename("F", "G")
				return err
			},
			folder: "G",
			want:   []string{"y.md", "x.md"},
			files:  []string{"G/x.md"},
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			s := newSpace(t, c.start...)
			if err := c.do(s); err != nil {
				t.Fatal(err)
			}
			if got := names(t, s, c.folder); !reflect.DeepEqual(got, c.want) {
				t.Errorf("order = %v, want %v", got, c.want)
			}
			for _, f := range c.files {
				if !exists(s.Root, strings.TrimSuffix(f, "/")) {
					t.Errorf("%s is not on disk", f)
				}
			}
			// Reopening reads the same order from space.json.
			again, err := space.Open(s.Root)
			if err != nil {
				t.Fatal(err)
			}
			if got := names(t, again, c.folder); !reflect.DeepEqual(got, c.want) {
				t.Errorf("after reopening, order = %v, want %v", got, c.want)
			}
		})
	}
}

func TestOperationsAreRefused(t *testing.T) {
	s := newSpace(t, "a.md", "b.md", "F/")
	cases := []struct {
		name string
		do   func() error
	}{
		{"a path leaving the Space", func() error { _, err := s.Rename("../a.md", "x"); return err }},
		{"an absolute path", func() error { _, err := s.Rename(filepath.Join(s.Root, "a.md"), "x"); return err }},
		{"the .bava folder", func() error { _, err := s.Trash(".bava"); return err }},
		{"inside .bava", func() error { _, err := s.CreatePage(".bava", "x"); return err }},
		{"a name that exists", func() error { _, err := s.CreatePage("", "a"); return err }},
		{"a rename onto another page", func() error { _, err := s.Rename("a.md", "b"); return err }},
		{"a name with a slash", func() error { _, err := s.CreateFolder("", "x/y"); return err }},
		{"a hidden name", func() error { _, err := s.CreatePage("", ".secret"); return err }},
		{"an empty name", func() error { _, err := s.CreatePage("", "  "); return err }},
		{"a folder into itself", func() error { _, err := s.Move("F", "F", 0); return err }},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if err := c.do(); err == nil {
				t.Error("was allowed")
			}
		})
	}
}

// A case-only rename check would let a rename replace a different file on a
// case-sensitive filesystem. Only a rename of the same file (its own case
// changed) may land on an existing name.
func TestRenameNeverReplacesAnotherFile(t *testing.T) {
	s := newSpace(t, "a.md")
	if err := os.WriteFile(filepath.Join(s.Root, "A.md"), []byte("other"), 0o644); err != nil {
		t.Fatal(err)
	}
	entries, _ := os.ReadDir(s.Root)
	caseSensitive := 0
	for _, e := range entries {
		if strings.EqualFold(e.Name(), "a.md") {
			caseSensitive++
		}
	}
	if caseSensitive < 2 {
		t.Skip("this filesystem is case-insensitive: a.md and A.md are one file")
	}
	if _, err := s.Rename("a.md", "A"); err == nil {
		t.Fatal("renaming a.md to A replaced a different A.md")
	}
	raw, _ := os.ReadFile(filepath.Join(s.Root, "A.md"))
	if string(raw) != "other" {
		t.Error("A.md was overwritten")
	}
}

func TestRenameChangesOnlyCase(t *testing.T) {
	s := newSpace(t, "notes.md")
	got, err := s.Rename("notes.md", "Notes")
	if err != nil || got != "Notes.md" {
		t.Fatalf("Rename = %q, %v", got, err)
	}
	if got := names(t, s, ""); !reflect.DeepEqual(got, []string{"Notes.md"}) {
		t.Errorf("tree = %v", got)
	}
}

// A symlinked folder must not take a page out of the Space.
func TestSymlinksAreNotFollowedOutOfTheSpace(t *testing.T) {
	s := newSpace(t, "a.md")
	outside := t.TempDir()
	if err := os.Symlink(outside, filepath.Join(s.Root, "link")); err != nil {
		t.Skip("symlinks unavailable:", err)
	}
	if _, err := s.Move("a.md", "link", 0); err == nil {
		t.Error("a page was moved through a symlink")
	}
	if _, err := s.CreatePage("link", "x"); err == nil {
		t.Error("a page was created through a symlink")
	}
	if _, err := s.Abs("link/x.md"); err == nil {
		t.Error("Abs accepted a path through a symlink")
	}
	if !exists(s.Root, "a.md") {
		t.Error("the page left the Space")
	}
}

// Names differing only in case must sort the same way every run.
func TestOrderedIsStableForNamesDifferingInCase(t *testing.T) {
	for i := 0; i < 20; i++ {
		if got := space.Ordered(nil, []string{"a.md", "A.md", "b.md"}); !reflect.DeepEqual(got, []string{"A.md", "a.md", "b.md"}) {
			t.Fatalf("Ordered = %v", got)
		}
	}
}

// Restore must not follow a folder that became a link
// after the item was trashed.
func TestRestoreDoesNotFollowALink(t *testing.T) {
	page := newSpace(t, "Notes/b.md")
	trashed, err := page.Trash("Notes/b.md")
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Remove(filepath.Join(page.Root, "Notes")); err != nil {
		t.Fatal(err)
	}
	outside := t.TempDir()
	if err := os.Symlink(outside, filepath.Join(page.Root, "Notes")); err != nil {
		t.Skip("symlinks unavailable:", err)
	}
	if _, err := page.Restore(trashed.ID); err == nil {
		t.Error("Restore followed a link out of the Space")
	}
	if exists(outside, "b.md") {
		t.Error("the page landed outside the Space")
	}
}

// Refusals carry a code the frontend can translate.
func TestRefusalsCarryACode(t *testing.T) {
	s := newSpace(t, "a.md", "b.md", "F/c.md")
	cases := []struct {
		name string
		err  func() error
		code error
	}{
		{"exists", func() error { _, err := s.Rename("a.md", "b"); return err }, space.ErrExists},
		{"empty name", func() error { _, err := s.CreatePage("", "  "); return err }, space.ErrNameEmpty},
		{"slash", func() error { _, err := s.CreatePage("", "x/y"); return err }, space.ErrNameSlash},
		{"dot", func() error { _, err := s.CreatePage("", ".x"); return err }, space.ErrNameDot},
		{"into itself", func() error { _, err := s.Move("F", "F", 0); return err }, space.ErrIntoItself},
		{"leaves", func() error { _, err := s.Rename("../x.md", "y"); return err }, space.ErrOutside},
		{"only a page", func() error { _, err := s.Duplicate("F"); return err }, space.ErrOnlyPage},
	}
	for _, c := range cases {
		if err := c.err(); !errors.Is(err, c.code) {
			t.Errorf("%s: err = %v, want %v", c.name, err, c.code)
		}
	}
}

// New Space: a folder named by the user, made in the place they chose.
func TestCreateMakesANamedFolderAndOpensIt(t *testing.T) {
	parent := t.TempDir()
	s, err := space.Create(parent, "  Acme Product ")
	if err != nil {
		t.Fatal(err)
	}
	if s.Root != filepath.Join(parent, "Acme Product") {
		t.Errorf("Root = %q", s.Root)
	}
	if !exists(s.Root, ".bava/space.json") {
		t.Error("the new Space has no space.json")
	}
}

func TestCreateRefusesATakenOrBadName(t *testing.T) {
	parent := t.TempDir()
	if err := os.Mkdir(filepath.Join(parent, "Taken"), 0o755); err != nil {
		t.Fatal(err)
	}
	for name, code := range map[string]error{
		"Taken": space.ErrExists,
		" ":     space.ErrNameEmpty,
		"a/b":   space.ErrNameSlash,
		".dot":  space.ErrNameDot,
	} {
		if _, err := space.Create(parent, name); !errors.Is(err, code) {
			t.Errorf("Create(%q) = %v, want %v", name, err, code)
		}
	}
	if _, err := space.Create("relative", "X"); err == nil {
		t.Error("Create accepted a relative place")
	}
}

// Names Windows cannot hold are refused everywhere, so a Space moves between
// machines intact: on NTFS "a:b" would write a hidden stream, not a page.
func TestNamesWindowsCannotHoldAreRefused(t *testing.T) {
	s := newSpace(t)
	for _, name := range []string{"a:b", "why?", "star*", `say "hi"`, "a<b", "a>b", "a|b", "trailing.", "CON", "nul", "com1", "LPT9"} {
		if _, err := s.CreatePage("", name); !errors.Is(err, space.ErrNameReserved) {
			t.Errorf("CreatePage(%q) = %v, want ErrNameReserved", name, err)
		}
	}
	for _, name := range []string{"Console", "a.b", "notes-2026", "con tract"} {
		if _, err := s.CreatePage("", name); err != nil {
			t.Errorf("CreatePage(%q) refused: %v", name, err)
		}
	}
}

// A link named like a page is not listed: every operation refuses a path
// through a link, so listing it would show a page nothing can change.
func TestALinkIsNotListedAsAPage(t *testing.T) {
	s := newSpace(t, "real.md")
	if err := os.Symlink(filepath.Join(s.Root, "real.md"), filepath.Join(s.Root, "link.md")); err != nil {
		t.Skip("symlinks unavailable:", err)
	}
	entries, err := s.List("")
	if err != nil {
		t.Fatal(err)
	}
	for _, e := range entries {
		if e.Name == "link.md" {
			t.Error("a link was listed as a page")
		}
	}
}
