package e2e

import (
	"os"
	"path/filepath"
	"testing"
	"testing/fstest"
)

// Inside a sandbox the walk cannot read the repository or the runner's
// folders: its fixtures are written into its own home, and its scratch and
// output folders made there.
func TestASandboxedRunLaysItselfOutInItsHome(t *testing.T) {
	home := t.TempDir()
	fixtures := fstest.MapFS{"testdata/fixtures/media/logo.png": {Data: []byte("PNG")}}
	repo, scratch, out, err := SandboxRun(home, fixtures)
	if err != nil {
		t.Fatal(err)
	}
	for _, dir := range []string{repo, scratch, out} {
		if filepath.Dir(dir) != home {
			t.Errorf("%s is not in the home", dir)
		}
		if info, err := os.Stat(dir); err != nil || !info.IsDir() {
			t.Errorf("%s was not made", dir)
		}
	}
	if b, err := os.ReadFile(filepath.Join(repo, "testdata", "fixtures", "media", "logo.png")); err != nil || string(b) != "PNG" {
		t.Errorf("fixture: %q %v", b, err)
	}
}
