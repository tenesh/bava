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

// A packaged app is started by the system, not a shell: the walk to run is
// read from a file in the home instead of the environment.
func TestARunFileNamesTheWalkWhenTheEnvironmentCannot(t *testing.T) {
	home := t.TempDir()
	if name, ok := RunFile(home); ok || name != "" {
		t.Errorf("no file read as %q, %v", name, ok)
	}
	if err := os.WriteFile(filepath.Join(home, ".bava-e2e"), []byte("reopen\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if name, ok := RunFile(home); !ok || name != "reopen" {
		t.Errorf("run file = %q, %v; want reopen", name, ok)
	}
}

// Inside Flatpak the app reaches only its own folder under the home: a
// sandboxed run lays itself out there.
func TestASandboxedRunInFlatpakLaysItselfOutInTheAppsOwnFolder(t *testing.T) {
	home := t.TempDir()
	t.Setenv("FLATPAK_ID", "com.tharabyte.bava.Devel")
	want := filepath.Join(home, ".var", "app", "com.tharabyte.bava.Devel")
	if got := SandboxHome(home); got != want {
		t.Errorf("SandboxHome = %q, want %q", got, want)
	}
	t.Setenv("FLATPAK_ID", "")
	if got := SandboxHome(home); got != home {
		t.Errorf("outside Flatpak SandboxHome = %q, want the home %q", got, home)
	}
}
