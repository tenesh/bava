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
