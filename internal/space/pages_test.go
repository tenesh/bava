package space_test

import (
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/tenesh/bava/internal/space"
	"github.com/tenesh/bava/internal/testutil"
)

func readPage(t *testing.T, s space.Space, rel string) string {
	t.Helper()
	b, err := os.ReadFile(filepath.Join(s.Root, filepath.FromSlash(rel)))
	if err != nil {
		t.Fatal(err)
	}
	return string(b)
}

func paths(entries []space.Entry) []string {
	out := []string{}
	for _, e := range entries {
		out = append(out, e.Path)
	}
	return out
}

func TestPagesListsEveryPageInTreeOrder(t *testing.T) {
	s := newSpace(t, "Roadmap.md", "Marketing/Launch plan.md", "Marketing/Old/Brief.md", ".hidden/x.md", "notes.txt")
	got, err := s.Pages()
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"Marketing/Launch plan.md", "Marketing/Old/Brief.md", "Roadmap.md"}
	if !reflect.DeepEqual(paths(got), want) {
		t.Errorf("Pages = %q; want %q", paths(got), want)
	}
	if got[0].Name != "Launch plan" {
		t.Errorf("a page's name = %q; want it without .md", got[0].Name)
	}
}

func TestPagesSkipsAFolderItCannotRead(t *testing.T) {
	s := newSpace(t, "Roadmap.md", "Locked/Page.md")
	if err := os.Chmod(filepath.Join(s.Root, "Locked"), 0o000); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chmod(filepath.Join(s.Root, "Locked"), 0o755) })
	// Windows (and a root user) can still read a folder with no permissions:
	// there, no folder can be made unreadable to test with.
	if _, err := os.ReadDir(filepath.Join(s.Root, "Locked")); err == nil {
		t.Skip("this system cannot make a folder unreadable")
	}
	got, err := s.Pages()
	if err != nil {
		t.Fatalf("Pages: %v", err)
	}
	if want := []string{"Roadmap.md"}; !reflect.DeepEqual(paths(got), want) {
		t.Errorf("Pages = %q; want %q", paths(got), want)
	}
}

func TestWriteIfUnchangedWritesOnlyWhatWasRead(t *testing.T) {
	s := newSpace(t)
	testutil.WriteTree(t, s.Root, map[string]string{"Roadmap.md": "[Plan](Plan.md)\n"})
	if err := s.WriteIfUnchanged("Roadmap.md", "[Plan](Plan.md)\n", "[Q4](Q4.md)\n"); err != nil {
		t.Fatal(err)
	}
	if got := readPage(t, s, "Roadmap.md"); got != "[Q4](Q4.md)\n" {
		t.Errorf("Roadmap.md = %q", got)
	}
	// Changed since it was read: left alone.
	err := s.WriteIfUnchanged("Roadmap.md", "[Plan](Plan.md)\n", "[X](X.md)\n")
	if !errors.Is(err, space.ErrChanged) {
		t.Errorf("err = %v; want ErrChanged", err)
	}
	if got := readPage(t, s, "Roadmap.md"); got != "[Q4](Q4.md)\n" {
		t.Errorf("Roadmap.md = %q after a refused write", got)
	}
	testutil.WriteTree(t, s.Root, map[string]string{".hidden.md": "x", "notes.txt": "x"})
	refused := []string{"../outside.md", ".bava/space.json", "Missing.md", "notes.txt", ".hidden.md"}
	// Windows may not allow making a link; elsewhere a page through one is refused too.
	if os.Symlink(filepath.Join(s.Root, "Roadmap.md"), filepath.Join(s.Root, "Linked.md")) == nil {
		refused = append(refused, "Linked.md")
	}
	for _, path := range refused {
		if err := s.WriteIfUnchanged(path, "", "x"); err == nil {
			t.Errorf("%s: written", path)
		}
	}
}
