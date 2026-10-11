package access

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

// The system's keeper: sandboxed only inside a store's sandbox, which a test
// run never is.
func TestOutsideASandboxTheSystemKeepsNothing(t *testing.T) {
	if ForSystem().Sandboxed() {
		t.Error("a test run reads as sandboxed")
	}
}

// macOS's bookmark round trip, which a sandboxed app relies on; it works
// outside the sandbox too.
func TestAMacBookmarkRestoresItsFolder(t *testing.T) {
	if runtime.GOOS != "darwin" {
		t.Skip("bookmarks are macOS's")
	}
	dir, err := filepath.EvalSymlinks(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	k := bookmarks{}
	token, err := k.Keep(dir)
	if err != nil || len(token) == 0 {
		t.Fatalf("keep: %v", err)
	}
	path, stale, err := k.Restore(token)
	if err != nil || stale {
		t.Fatalf("restore: %q stale=%v err=%v", path, stale, err)
	}
	if got, _ := filepath.EvalSymlinks(path); got != dir {
		t.Errorf("restored %q; want %q", got, dir)
	}
	_ = os.RemoveAll(dir)
}

// Flatpak's portal keeps the grant; Bava keeps only the path it returned.
func TestTheFlatpakKeeperKeepsThePathOnly(t *testing.T) {
	dir := t.TempDir()
	k := portal{}
	token, err := k.Keep(dir)
	if err != nil {
		t.Fatal(err)
	}
	if path, stale, err := k.Restore(token); err != nil || stale || path != dir {
		t.Errorf("restore = %q, %v, %v", path, stale, err)
	}
}

// Inside the Mac sandbox, temporary files go in the container's own folder,
// whatever TMPDIR the launcher passed down: another one is refused.
func TestInsideTheMacSandboxTemporaryFilesStayInTheContainer(t *testing.T) {
	if runtime.GOOS != "darwin" {
		t.Skip("the Mac sandbox's alone")
	}
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("TMPDIR", "/somewhere/else")
	t.Setenv("APP_SANDBOX_CONTAINER_ID", "com.tharabyte.bava")
	if err := UseContainerTemp(); err != nil {
		t.Fatal(err)
	}
	want := filepath.Join(home, "tmp")
	if got := os.Getenv("TMPDIR"); got != want {
		t.Errorf("TMPDIR = %q; want %q", got, want)
	}
	if info, err := os.Stat(want); err != nil || !info.IsDir() {
		t.Error("the container's temporary folder was not made")
	}
}

func TestOutsideTheSandboxTemporaryFilesAreLeftAlone(t *testing.T) {
	t.Setenv("TMPDIR", "/kept")
	t.Setenv("APP_SANDBOX_CONTAINER_ID", "")
	if err := UseContainerTemp(); err != nil || os.Getenv("TMPDIR") != "/kept" {
		t.Errorf("TMPDIR = %q (%v); want it left alone", os.Getenv("TMPDIR"), err)
	}
}
