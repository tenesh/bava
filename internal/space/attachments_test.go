package space_test

import (
	"errors"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/tenesh/bava/internal/space"
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
