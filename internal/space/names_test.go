package space_test

import (
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/tharabyte/bava/internal/space"
)

func TestAFreeNameIsTheNameItselfWhenNothingHasIt(t *testing.T) {
	if got := space.FreeName("Launch plan.md", func(string) bool { return false }); got != "Launch plan.md" {
		t.Errorf("FreeName = %q, want the name itself", got)
	}
}

func TestAFreeNameCountsFromTwoPastEveryTakenOne(t *testing.T) {
	taken := map[string]bool{"Launch plan.md": true, "Launch plan 2.md": true, "Launch plan 3.md": true}
	if got := space.FreeName("Launch plan.md", func(name string) bool { return taken[name] }); got != "Launch plan 4.md" {
		t.Errorf("FreeName = %q, want Launch plan 4.md", got)
	}
}

func TestAFreeNameKeepsAFilesExtension(t *testing.T) {
	taken := func(name string) bool { return name == "logo.png" }
	if got := space.FreeName("logo.png", taken); got != "logo 2.png" {
		t.Errorf("FreeName = %q, want logo 2.png", got)
	}
}

func TestAFreeFolderNameNumbersTheWholeName(t *testing.T) {
	taken := func(name string) bool { return name == "Q4 notes" || name == "v1.2" }
	if got := space.FreeFolderName("Q4 notes", taken); got != "Q4 notes 2" {
		t.Errorf("FreeFolderName = %q, want Q4 notes 2", got)
	}
	if got := space.FreeFolderName("v1.2", taken); got != "v1.2 2" {
		t.Errorf("FreeFolderName = %q, want v1.2 2, never a split at the dot", got)
	}
}

// A folder that cannot be read has nothing taken: the write then says why,
// rather than numbering forever.
func TestANameInAFolderThatCannotBeReadIsFree(t *testing.T) {
	dir := t.TempDir()
	locked := filepath.Join(dir, "locked")
	if err := os.Mkdir(locked, 0o000); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chmod(locked, 0o755) })
	if _, err := os.Lstat(filepath.Join(locked, "a.md")); err == nil || errors.Is(err, os.ErrNotExist) {
		t.Skip("the folder can still be read here")
	}
	if got := space.FreeName("a.md", space.OnDisk(locked)); got != "a.md" {
		t.Errorf("FreeName = %q, want a.md", got)
	}
}
