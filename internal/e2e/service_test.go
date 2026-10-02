package e2e_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/tenesh/bava/internal/e2e"
)

func TestShotsAreNumberedInTheOrderTaken(t *testing.T) {
	out := t.TempDir()
	var taken []string
	s := e2e.NewService(e2e.Options{
		Scenario: e2e.Scenario{Name: "create", Steps: []e2e.Step{{Do: "shot", Name: "a"}}},
		Out:      out,
		Capture:  func(path string) error { taken = append(taken, path); return os.WriteFile(path, []byte("png"), 0o644) },
		Quit:     func(int) {},
	})
	if msg := s.Shot("after save"); msg != "" {
		t.Fatal(msg)
	}
	s.Shot("reopened")
	want := []string{filepath.Join(out, "create-01-after-save.png"), filepath.Join(out, "create-02-reopened.png")}
	if len(taken) != 2 || taken[0] != want[0] || taken[1] != want[1] {
		t.Errorf("shots = %v, want %v", taken, want)
	}
}

func TestDoneRecordsTheResultAndQuitsWithItsCode(t *testing.T) {
	out := t.TempDir()
	code := -1
	s := e2e.NewService(e2e.Options{
		Scenario: e2e.Scenario{Name: "reopen"},
		Out:      out,
		Capture:  func(string) error { return nil },
		Quit:     func(c int) { code = c },
	})
	s.Done("step 4 (wait): the page never showed")
	data, err := os.ReadFile(filepath.Join(out, "reopen-result.txt"))
	if err != nil || code != 1 || string(data) != "FAIL step 4 (wait): the page never showed\n" {
		t.Errorf("result %q, %v, code %d", data, err, code)
	}
	s.Done("")
	data, _ = os.ReadFile(filepath.Join(out, "reopen-result.txt"))
	if code != 0 || string(data) != "PASS\n" {
		t.Errorf("result %q, code %d", data, code)
	}
}

func TestTheScenarioGoesToThePage(t *testing.T) {
	sc := e2e.Scenario{Name: "x", Steps: []e2e.Step{{Do: "menu", Target: "file.new"}}}
	s := e2e.NewService(e2e.Options{Scenario: sc, Capture: func(string) error { return nil }, Quit: func(int) {}})
	if got := s.Scenario(); got.Name != "x" || len(got.Steps) != 1 {
		t.Errorf("Scenario = %+v", got)
	}
}

// A scenario reads back what the app saved, and only from the scratch folder
// it was given: never the repository or the home folder.
func TestReadFileReadsOnlyTheScratchFolder(t *testing.T) {
	scratch, outside := t.TempDir(), t.TempDir()
	if err := os.MkdirAll(filepath.Join(scratch, "Smoke"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(scratch, "Smoke", "First page.md"), []byte("# First page\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(outside, "secret.md"), []byte("secret"), 0o644); err != nil {
		t.Fatal(err)
	}
	s := e2e.NewService(e2e.Options{Scratch: scratch, Capture: func(string) error { return nil }, Quit: func(int) {}})

	if got := s.ReadFile("Smoke/First page.md"); got.Error != "" || got.Text != "# First page\n" {
		t.Errorf("ReadFile = %+v", got)
	}
	for _, path := range []string{"../" + filepath.Base(outside) + "/secret.md", filepath.Join(outside, "secret.md"), "Smoke/missing.md"} {
		if got := s.ReadFile(path); got.Error == "" || got.Text != "" {
			t.Errorf("ReadFile(%q) = %+v, want an error", path, got)
		}
	}

	// Nor through a link out of it, where the system allows one.
	t.Run("a link out", func(t *testing.T) {
		if err := os.Symlink(filepath.Join(outside, "secret.md"), filepath.Join(scratch, "Smoke", "link.md")); err != nil {
			t.Skip("no symlinks here:", err)
		}
		if got := s.ReadFile("Smoke/link.md"); got.Error == "" || got.Text != "" {
			t.Errorf("ReadFile through a link = %+v, want an error", got)
		}
	})
}

func TestReadFileRefusesWithNoScratchFolder(t *testing.T) {
	s := e2e.NewService(e2e.Options{Capture: func(string) error { return nil }, Quit: func(int) {}})
	if got := s.ReadFile("a.md"); got.Error == "" {
		t.Errorf("ReadFile with no scratch folder = %+v", got)
	}
}
