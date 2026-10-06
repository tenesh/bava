package space_test

import (
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/tenesh/bava/internal/space"
	"github.com/tenesh/bava/internal/testutil"
)

// withTemplates makes a Space holding the given files under .bava/templates.
func withTemplates(t *testing.T, files ...string) space.Space {
	t.Helper()
	s := newSpace(t, "Roadmap.md")
	tree := map[string]string{}
	for _, f := range files {
		tree[".bava/templates/"+f] = "# " + f + "\n"
	}
	testutil.WriteTree(t, s.Root, tree)
	return s
}

func TestTemplatesListsGroupsThenTheRest(t *testing.T) {
	s := withTemplates(t, "Meetings/Weekly sync.md", "Meetings/Retro.md", "Design/Spec.md", "Bug report.md", "notes.txt", "Deep/Er/Hidden.md")
	got, err := s.Templates()
	if err != nil {
		t.Fatalf("Templates: %v", err)
	}
	want := []space.Template{
		{Group: "Design", Name: "Spec", Path: ".bava/templates/Design/Spec.md"},
		{Group: "Meetings", Name: "Retro", Path: ".bava/templates/Meetings/Retro.md"},
		{Group: "Meetings", Name: "Weekly sync", Path: ".bava/templates/Meetings/Weekly sync.md"},
		{Group: "", Name: "Bug report", Path: ".bava/templates/Bug report.md"},
	}
	if len(got) != len(want) {
		t.Fatalf("Templates = %+v", got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("Templates[%d] = %+v, want %+v", i, got[i], want[i])
		}
	}
}

func TestTemplatesInASpaceWithNoneIsEmpty(t *testing.T) {
	got, err := newSpace(t, "Roadmap.md").Templates()
	if err != nil || len(got) != 0 {
		t.Fatalf("Templates = %+v, %v", got, err)
	}
}

func TestSaveTemplateMakesItsGroupAndRefusesATakenName(t *testing.T) {
	s := newSpace(t, "Roadmap.md")
	p, err := s.SaveTemplate("Meetings", "Weekly sync", []byte("# One\n"), false)
	if err != nil || p != ".bava/templates/Meetings/Weekly sync.md" {
		t.Fatalf("SaveTemplate = %q, %v", p, err)
	}
	if _, err := s.SaveTemplate("Meetings", "Weekly sync", []byte("# Two\n"), false); !errors.Is(err, space.ErrExists) {
		t.Errorf("a taken name: %v, want ErrExists", err)
	}
	if _, err := s.SaveTemplate("Meetings", "Weekly sync", []byte("# Two\n"), true); err != nil {
		t.Fatalf("replace: %v", err)
	}
	if got, _ := os.ReadFile(filepath.Join(s.Root, ".bava/templates/Meetings/Weekly sync.md")); string(got) != "# Two\n" {
		t.Errorf("replaced = %q", got)
	}
	if p, err := s.SaveTemplate("", "Bug report", []byte("x"), false); err != nil || p != ".bava/templates/Bug report.md" {
		t.Errorf("no group = %q, %v", p, err)
	}
	if _, err := s.SaveTemplate("Me/etings", "X", []byte("x"), false); !errors.Is(err, space.ErrNameSlash) {
		t.Errorf("a group with a slash: %v", err)
	}
}

func TestRenameAndMoveTemplateRefuseATakenName(t *testing.T) {
	s := withTemplates(t, "Meetings/Weekly sync.md", "Meetings/Retro.md", "Retro.md")
	if _, err := s.RenameTemplate(".bava/templates/Meetings/Weekly sync.md", "Retro"); !errors.Is(err, space.ErrExists) {
		t.Errorf("rename onto a taken name: %v", err)
	}
	p, err := s.RenameTemplate(".bava/templates/Meetings/Weekly sync.md", "Daily")
	if err != nil || p != ".bava/templates/Meetings/Daily.md" {
		t.Fatalf("rename = %q, %v", p, err)
	}
	if _, err := s.MoveTemplate(".bava/templates/Meetings/Retro.md", ""); !errors.Is(err, space.ErrExists) {
		t.Errorf("move onto a taken name: %v", err)
	}
	p, err = s.MoveTemplate(".bava/templates/Meetings/Daily.md", "Design")
	if err != nil || p != ".bava/templates/Design/Daily.md" {
		t.Fatalf("move = %q, %v", p, err)
	}
}

func TestMovingOrDeletingTheLastTemplateRemovesItsGroup(t *testing.T) {
	s := withTemplates(t, "Meetings/Retro.md", "Design/Spec.md")
	if _, err := s.MoveTemplate(".bava/templates/Meetings/Retro.md", ""); err != nil {
		t.Fatal(err)
	}
	if exists(s.Root, ".bava/templates/Meetings") {
		t.Error("an empty group stayed after a move")
	}
	if err := s.DeleteTemplate(".bava/templates/Design/Spec.md"); err != nil {
		t.Fatal(err)
	}
	if exists(s.Root, ".bava/templates/Design") || exists(s.Root, ".bava/templates/Design/Spec.md") {
		t.Error("a deleted template or its emptied group stayed")
	}
}

func TestDuplicateTemplateNumbersTheCopy(t *testing.T) {
	s := withTemplates(t, "Meetings/Retro.md")
	p, err := s.DuplicateTemplate(".bava/templates/Meetings/Retro.md")
	if err != nil || p != ".bava/templates/Meetings/Retro 2.md" {
		t.Fatalf("duplicate = %q, %v", p, err)
	}
	if got, _ := os.ReadFile(filepath.Join(s.Root, filepath.FromSlash(p))); string(got) != "# Meetings/Retro.md\n" {
		t.Errorf("copy = %q", got)
	}
}

func TestTemplateOperationsRefuseAPathOutsideTemplates(t *testing.T) {
	s := withTemplates(t, "Retro.md")
	for _, p := range []string{"Roadmap.md", ".bava/space.json", ".bava/templates/../../Roadmap.md", ".bava/templates/Missing.md"} {
		if err := s.DeleteTemplate(p); err == nil {
			t.Errorf("DeleteTemplate(%q) was allowed", p)
		}
	}
	if !exists(s.Root, "Roadmap.md") {
		t.Fatal("a page was deleted")
	}
}

// A template is never written, read or moved through a link: not a group
// folder's, not the templates folder's, not .bava's.
func TestTemplatesNeverGoThroughALink(t *testing.T) {
	elsewhere := t.TempDir()
	s := withTemplates(t, "Retro.md")
	if err := os.Symlink(elsewhere, filepath.Join(s.Root, ".bava/templates/Evil")); err != nil {
		t.Skipf("no symlinks here: %v", err)
	}
	if _, err := s.SaveTemplate("Evil", "Out", []byte("x"), false); !errors.Is(err, space.ErrThroughLink) {
		t.Errorf("SaveTemplate into a linked group: %v", err)
	}
	if _, err := s.MoveTemplate(".bava/templates/Retro.md", "Evil"); !errors.Is(err, space.ErrThroughLink) {
		t.Errorf("MoveTemplate into a linked group: %v", err)
	}
	if entries, _ := os.ReadDir(elsewhere); len(entries) != 0 {
		t.Fatalf("written through the link: %v", entries)
	}

	linked := newSpace(t, "Roadmap.md")
	if err := os.Symlink(elsewhere, filepath.Join(linked.Root, ".bava/templates")); err != nil {
		t.Fatal(err)
	}
	if _, err := linked.SaveTemplate("", "Out", []byte("x"), false); !errors.Is(err, space.ErrThroughLink) {
		t.Errorf("SaveTemplate through a linked templates folder: %v", err)
	}
	if _, err := linked.Templates(); !errors.Is(err, space.ErrThroughLink) {
		t.Errorf("Templates through a linked templates folder: %v", err)
	}
	if entries, _ := os.ReadDir(elsewhere); len(entries) != 0 {
		t.Fatalf("written through the linked templates folder: %v", entries)
	}
}

func TestEveryTemplateOperationRefusesAPathOutsideTemplates(t *testing.T) {
	s := withTemplates(t, "Retro.md")
	for _, p := range []string{"Roadmap.md", ".bava/space.json", ".bava/templates/../../Roadmap.md", ".bava/templates/Missing.md", ".bava/templates/A/B/C.md"} {
		if _, err := s.RenameTemplate(p, "X"); err == nil {
			t.Errorf("RenameTemplate(%q) was allowed", p)
		}
		if _, err := s.MoveTemplate(p, "G"); err == nil {
			t.Errorf("MoveTemplate(%q) was allowed", p)
		}
		if _, err := s.DuplicateTemplate(p); err == nil {
			t.Errorf("DuplicateTemplate(%q) was allowed", p)
		}
	}
	if !exists(s.Root, "Roadmap.md") || !exists(s.Root, ".bava/space.json") {
		t.Fatal("something outside the templates was changed")
	}
}
