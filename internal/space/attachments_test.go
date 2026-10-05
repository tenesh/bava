package space_test

import (
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/tenesh/bava/internal/space"
	"github.com/tenesh/bava/internal/testutil"
)

// outsideFile writes a file outside the Space, as one picked or dropped from
// anywhere.
func outsideFile(t *testing.T, name, content string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), name)
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
	return path
}

func attachment(t *testing.T, s space.Space, name string) string {
	t.Helper()
	b, err := os.ReadFile(filepath.Join(s.Root, ".bava", "attachments", name))
	if err != nil {
		t.Fatal(err)
	}
	return string(b)
}

func TestAttachCopiesAFileKeepingItsName(t *testing.T) {
	s := newSpace(t)
	name, err := s.Attach(outsideFile(t, "logo.png", "one"))
	if err != nil {
		t.Fatal(err)
	}
	if name != "logo.png" || attachment(t, s, "logo.png") != "one" {
		t.Errorf("attached %q holding %q", name, attachment(t, s, name))
	}
}

func TestAttachNumbersADifferentFileWithTheSameName(t *testing.T) {
	s := newSpace(t)
	if _, err := s.Attach(outsideFile(t, "logo.png", "one")); err != nil {
		t.Fatal(err)
	}
	name, err := s.Attach(outsideFile(t, "logo.png", "two"))
	if err != nil {
		t.Fatal(err)
	}
	if name != "logo 2.png" || attachment(t, s, "logo.png") != "one" || attachment(t, s, "logo 2.png") != "two" {
		t.Errorf("attached %q; the first file must stay as it was", name)
	}
}

func TestAttachReusesAnIdenticalFile(t *testing.T) {
	s := newSpace(t)
	if _, err := s.Attach(outsideFile(t, "logo.png", "same")); err != nil {
		t.Fatal(err)
	}
	name, err := s.Attach(outsideFile(t, "copy of logo.png", "same"))
	if err != nil {
		t.Fatal(err)
	}
	if name != "logo.png" {
		t.Errorf("attached %q; want the identical file already there", name)
	}
	entries, _ := os.ReadDir(filepath.Join(s.Root, ".bava", "attachments"))
	if len(entries) != 1 {
		t.Errorf("%d files; the same bytes are stored once", len(entries))
	}
}

func TestAttachDataNamesAPastedImageByItsTime(t *testing.T) {
	s := newSpace(t)
	at := time.Date(2026, 9, 29, 14, 32, 5, 0, time.Local)
	name, err := s.AttachData(space.PastedImageName(at), []byte("png"))
	if err != nil {
		t.Fatal(err)
	}
	if name != "Pasted image 2026-09-29 14.32.05.png" || attachment(t, s, name) != "png" {
		t.Errorf("attached %q", name)
	}
}

func TestAttachRefusesANameThatIsNotOne(t *testing.T) {
	s := newSpace(t)
	for _, name := range []string{"../escape.png", "a/b.png", ".hidden.png", ""} {
		if _, err := s.AttachData(name, []byte("x")); err == nil {
			t.Errorf("%q: attached", name)
		}
	}
	if _, err := s.Attach(filepath.Join(t.TempDir(), "missing.png")); err == nil {
		t.Error("a missing file was attached")
	}
}

func TestRenameAttachmentKeepsItsExtensionAndRefusesATakenName(t *testing.T) {
	s := newSpace(t)
	if _, err := s.AttachData("logo.png", []byte("one")); err != nil {
		t.Fatal(err)
	}
	if _, err := s.AttachData("mark.png", []byte("two")); err != nil {
		t.Fatal(err)
	}
	name, err := s.RenameAttachment("logo.png", "brand")
	if err != nil {
		t.Fatal(err)
	}
	if name != "brand.png" || attachment(t, s, "brand.png") != "one" {
		t.Errorf("renamed to %q", name)
	}
	if _, err := s.RenameAttachment("brand.png", "mark"); !errors.Is(err, space.ErrExists) {
		t.Errorf("renamed onto a taken name: %v", err)
	}
	if _, err := s.RenameAttachment("gone.png", "x"); err == nil {
		t.Error("renamed a file that is not there")
	}
}

func TestAttachingAtOnceNeverSharesAName(t *testing.T) {
	s := newSpace(t)
	names := make(chan string, 8)
	var wg sync.WaitGroup
	for i := range 8 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			name, err := s.AttachData("logo.png", []byte{byte(i)})
			if err != nil {
				t.Error(err)
			}
			names <- name
		}()
	}
	wg.Wait()
	close(names)
	seen := map[string]bool{}
	for name := range names {
		if seen[name] {
			t.Errorf("%q given twice", name)
		}
		seen[name] = true
	}
}

func TestAttachmentsListsTheFolder(t *testing.T) {
	s := newSpace(t)
	if got, err := s.Attachments(); err != nil || got == nil || len(got) != 0 {
		t.Fatalf("no folder yet: %v, %v", got, err)
	}
	for name, data := range map[string]string{"b.png": "bb", "a.pdf": "a"} {
		if _, err := s.AttachData(name, []byte(data)); err != nil {
			t.Fatal(err)
		}
	}
	got, err := s.Attachments()
	if err != nil || len(got) != 2 || got[0].Name != "a.pdf" || got[0].Size != 1 || got[1].Name != "b.png" || got[1].Size != 2 || got[0].Modified == "" {
		t.Errorf("Attachments = %+v, %v", got, err)
	}
}

// spaceFile is the Space's own file, as written.
func spaceFile(t *testing.T, s space.Space) string {
	t.Helper()
	b, _ := os.ReadFile(filepath.Join(s.Root, ".bava", "space.json"))
	return string(b)
}

func TestAnAttachmentGoesToTheTrashAndComesBack(t *testing.T) {
	s := newSpace(t)
	if _, err := s.AttachData("logo.png", []byte("one")); err != nil {
		t.Fatal(err)
	}
	item, err := s.TrashAttachment("logo.png")
	if err != nil {
		t.Fatal(err)
	}
	if item.Kind != "attachment" || item.Path != ".bava/attachments/logo.png" {
		t.Errorf("item = %+v", item)
	}
	if _, err := os.Stat(filepath.Join(s.Root, ".bava", "attachments", "logo.png")); err == nil {
		t.Error("the file is still in the attachments")
	}
	items, _ := s.TrashItems()
	if len(items) != 1 || items[0].Kind != "attachment" || items[0].Size != 3 {
		t.Errorf("TrashItems = %+v", items)
	}
	back, err := s.Restore(item.ID)
	if err != nil || back != ".bava/attachments/logo.png" || attachment(t, s, "logo.png") != "one" {
		t.Errorf("Restore = %q, %v", back, err)
	}
	if strings.Contains(spaceFile(t, s), "attachments") {
		t.Errorf("the page order now names the attachments: %s", spaceFile(t, s))
	}
}

func TestTrashingAndRestoringAnAttachmentLeavesThePageOrderAsItWas(t *testing.T) {
	s := newSpace(t, "b.md", "a.md", "F/x.md")
	if _, err := s.Move("a.md", "", 0); err != nil {
		t.Fatal(err)
	}
	if _, err := s.AttachData("logo.png", []byte("one")); err != nil {
		t.Fatal(err)
	}
	before := spaceFile(t, s)
	if !strings.Contains(before, "a.md") {
		t.Fatalf("no order to keep: %s", before)
	}
	item, err := s.TrashAttachment("logo.png")
	if err != nil {
		t.Fatal(err)
	}
	if got := spaceFile(t, s); got != before {
		t.Errorf("trashing changed the Space's file:\n%s\nwas\n%s", got, before)
	}
	if _, err := s.Restore(item.ID); err != nil {
		t.Fatal(err)
	}
	if got := spaceFile(t, s); got != before {
		t.Errorf("restoring changed the Space's file:\n%s\nwas\n%s", got, before)
	}
}

// A file put in the folder by hand, whose name another tool allows, is acted
// on by its exact name: never a trimmed one, which could be another file.
func TestAnAttachmentIsTakenByItsExactName(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("Windows cannot hold a name ending in a space")
	}
	s := newSpace(t)
	if _, err := s.AttachData("logo.png", []byte("used")); err != nil {
		t.Fatal(err)
	}
	testutil.WriteTree(t, s.Root, map[string]string{".bava/attachments/logo.png ": "stray"})
	if _, err := s.TrashAttachment("logo.png "); err != nil {
		t.Fatal(err)
	}
	if attachment(t, s, "logo.png") != "used" {
		t.Error("the used file went instead")
	}
	if path, err := s.AttachmentPath("logo.png"); err != nil || filepath.Base(path) != "logo.png" {
		t.Errorf("AttachmentPath = %q, %v", path, err)
	}
	if _, err := s.AttachmentPath("gone.png"); err == nil {
		t.Error("a file that is not there has a path")
	}
}

func TestAnAttachmentsFolderThatIsALinkIsRefused(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("links need privileges on Windows")
	}
	s := newSpace(t)
	elsewhere := t.TempDir()
	testutil.WriteTree(t, elsewhere, map[string]string{"x.png": "x"})
	testutil.WriteTree(t, s.Root, map[string]string{".bava/": ""})
	if err := os.Symlink(elsewhere, filepath.Join(s.Root, ".bava", "attachments")); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Attachments(); !errors.Is(err, space.ErrThroughLink) {
		t.Errorf("Attachments: %v", err)
	}
	if _, err := s.TrashAttachment("x.png"); !errors.Is(err, space.ErrThroughLink) {
		t.Errorf("TrashAttachment: %v", err)
	}
	if _, err := s.AttachmentPath("x.png"); !errors.Is(err, space.ErrThroughLink) {
		t.Errorf("AttachmentPath: %v", err)
	}
	if _, err := s.AttachData("y.png", []byte("y")); !errors.Is(err, space.ErrThroughLink) {
		t.Errorf("AttachData: %v", err)
	}
}

func TestARestoredAttachmentWhoseNameWasTakenComesBackNumbered(t *testing.T) {
	s := newSpace(t)
	if _, err := s.AttachData("logo.png", []byte("one")); err != nil {
		t.Fatal(err)
	}
	item, err := s.TrashAttachment("logo.png")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.AttachData("logo.png", []byte("two")); err != nil {
		t.Fatal(err)
	}
	back, err := s.Restore(item.ID)
	if err != nil || back != ".bava/attachments/logo 2.png" || attachment(t, s, "logo 2.png") != "one" || attachment(t, s, "logo.png") != "two" {
		t.Errorf("Restore = %q, %v", back, err)
	}
}

func TestTrashAttachmentRefusesANameThatIsNotOne(t *testing.T) {
	s := newSpace(t)
	for _, name := range []string{"../space.json", "a/b.png", "", ".hidden", "missing.png"} {
		if _, err := s.TrashAttachment(name); err == nil {
			t.Errorf("%q: trashed", name)
		}
	}
}

// A frame's first picture takes its own name, numbered when taken, and is
// never shared with a file of the same bytes: redrawing one frame must not
// change another's picture.
func TestSavePictureFirstTakesAFreeNameAndSharesNothing(t *testing.T) {
	s := newSpace(t)
	same, err := s.AttachData("logo.png", []byte("png"))
	if err != nil {
		t.Fatal(err)
	}
	name, err := s.SavePicture("Roadmap - Write path.png", []byte("png"), false)
	if err != nil {
		t.Fatal(err)
	}
	if name != "Roadmap - Write path.png" || name == same || attachment(t, s, name) != "png" {
		t.Errorf("saved as %q", name)
	}
	again, err := s.SavePicture("Roadmap - Write path.png", []byte("other"), false)
	if err != nil {
		t.Fatal(err)
	}
	if again != "Roadmap - Write path 2.png" || attachment(t, s, name) != "png" {
		t.Errorf("a taken name gave %q, and the first holds %q", again, attachment(t, s, name))
	}
}

// Redrawn, a picture replaces its own file, or makes it when it is gone.
func TestSavePictureReplacesItsOwnFile(t *testing.T) {
	s := newSpace(t)
	if _, err := s.SavePicture("Box.png", []byte("one"), false); err != nil {
		t.Fatal(err)
	}
	name, err := s.SavePicture("Box.png", []byte("two"), true)
	if err != nil || name != "Box.png" || attachment(t, s, "Box.png") != "two" {
		t.Fatalf("replaced as %q (%v), holding %q", name, err, attachment(t, s, "Box.png"))
	}
	if _, err := s.SavePicture("Gone.png", []byte("new"), true); err != nil || attachment(t, s, "Gone.png") != "new" {
		t.Errorf("a missing picture was not made: %v", err)
	}
}

// Drawn again with nothing changed, the file is left alone: its date stays
// when it was last different.
func TestSavePictureLeavesTheSameBytesUntouched(t *testing.T) {
	s := newSpace(t)
	if _, err := s.SavePicture("Box.png", []byte("one"), false); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(s.Root, ".bava", "attachments", "Box.png")
	old := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	if err := os.Chtimes(path, old, old); err != nil {
		t.Fatal(err)
	}
	if _, err := s.SavePicture("Box.png", []byte("one"), true); err != nil {
		t.Fatal(err)
	}
	if info, err := os.Stat(path); err != nil || !info.ModTime().Equal(old) {
		t.Errorf("the same picture was written again: %v", info.ModTime())
	}
}

func TestSavePictureRefusesANameThatIsNotOne(t *testing.T) {
	s := newSpace(t)
	for _, name := range []string{"../escape.png", "a/b.png", ".hidden.png", "", "a:b.png"} {
		for _, replace := range []bool{false, true} {
			if _, err := s.SavePicture(name, []byte("x"), replace); err == nil {
				t.Errorf("%q (replace %v): saved", name, replace)
			}
		}
	}
}
