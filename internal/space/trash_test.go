package space_test

import (
	"os"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/tenesh/bava/internal/testutil"
)

func TestTrashMovesTheItemWholeAndListsIt(t *testing.T) {
	s := newSpace(t, "a.md", "F/x.md", "F/y.md")
	item, err := s.Trash("F")
	if err != nil {
		t.Fatal(err)
	}
	if exists(s.Root, "F") {
		t.Error("the folder is still in the Space")
	}
	if item.Path != "F" || item.Kind != "folder" {
		t.Errorf("item = %+v", item)
	}
	items, err := s.TrashItems()
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 || items[0].ID != item.ID || items[0].Size == 0 {
		t.Fatalf("TrashItems = %+v", items)
	}
	if got := names(t, s, ""); !reflect.DeepEqual(got, []string{"a.md"}) {
		t.Errorf("tree = %v", got)
	}
}

func TestRestoreRecreatesAMissingFolder(t *testing.T) {
	s := newSpace(t, "F/G/x.md")
	item, err := s.Trash("F/G/x.md")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.Trash("F"); err != nil {
		t.Fatal(err)
	}
	back, err := s.Restore(item.ID)
	if err != nil {
		t.Fatal(err)
	}
	if back != "F/G/x.md" || !exists(s.Root, "F/G/x.md") {
		t.Errorf("restored to %q", back)
	}
}

func TestRestoreNumbersAClash(t *testing.T) {
	s := newSpace(t, "Launch plan.md")
	item, err := s.Trash("Launch plan.md")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.CreatePage("", "Launch plan"); err != nil {
		t.Fatal(err)
	}
	back, err := s.Restore(item.ID)
	if err != nil {
		t.Fatal(err)
	}
	if back != "Launch plan 2.md" {
		t.Errorf("restored as %q, want a numbered name", back)
	}
}

func TestDeleteAndEmptyTouchOnlyTheTrash(t *testing.T) {
	s := newSpace(t, "a.md", "b.md", "c.md")
	one, _ := s.Trash("a.md")
	if _, err := s.Trash("b.md"); err != nil {
		t.Fatal(err)
	}
	if err := s.DeleteForever(one.ID); err != nil {
		t.Fatal(err)
	}
	items, _ := s.TrashItems()
	if len(items) != 1 || items[0].Path != "b.md" {
		t.Fatalf("after delete, trash = %+v", items)
	}
	if err := s.EmptyTrash(); err != nil {
		t.Fatal(err)
	}
	items, _ = s.TrashItems()
	if len(items) != 0 {
		t.Errorf("after empty, trash = %+v", items)
	}
	if !exists(s.Root, "c.md") || !exists(s.Root, ".bava/space.json") {
		t.Error("emptying the Trash touched something outside it")
	}
	if err := s.DeleteForever("../../etc"); err == nil {
		t.Error("a trash id leaving the Trash was accepted")
	}
}

func TestRenameSpaceRenamesTheFolder(t *testing.T) {
	s := newSpace(t, "a.md")
	parent := filepath.Dir(s.Root)
	next, err := s.RenameSpace("Renamed Space")
	if err != nil {
		t.Fatal(err)
	}
	if next.Root != filepath.Join(parent, "Renamed Space") {
		t.Errorf("new root %q", next.Root)
	}
	if _, err := os.Stat(filepath.Join(next.Root, "a.md")); err != nil {
		t.Error("the page did not move with the Space")
	}
}

func TestPageWidthIsSavedInTheSpace(t *testing.T) {
	s := newSpace(t)
	if err := s.SetPageWidth("full"); err != nil {
		t.Fatal(err)
	}
	if w, _ := s.PageWidth(); w != "full" {
		t.Errorf("width = %q", w)
	}
	if err := s.SetPageWidth("huge"); err == nil {
		t.Error("an unknown width was accepted")
	}
}

// A failed trash must not leave an orphan slot the Trash lists but cannot
// restore.
func TestAFailedTrashLeavesNoSlot(t *testing.T) {
	s := newSpace(t, "a.md")
	testutil.WriteTree(t, s.Root, map[string]string{".bava/space.json": "not json"})
	if _, err := s.Trash("a.md"); err == nil {
		t.Fatal("trash reported no error with a broken space.json")
	}
	if !exists(s.Root, "a.md") {
		t.Error("the page left without being trashed")
	}
	slots, _ := os.ReadDir(filepath.Join(s.Root, ".bava", "trash"))
	if len(slots) != 0 {
		t.Errorf("%d orphan slots left", len(slots))
	}
}
