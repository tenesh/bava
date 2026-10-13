package app_test

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/tharabyte/bava/internal/access"
	"github.com/tharabyte/bava/internal/app"
)

const anIcon = `<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="#0F766E"/></svg>`

func iconService(t *testing.T, choose func(kind string) ([]string, error)) (*app.IconService, string, *[]string) {
	t.Helper()
	dir := filepath.Join(t.TempDir(), "bava", "icons")
	var revealed []string
	service := app.NewIconService(app.IconServiceOptions{
		Dir:         func() (string, error) { return dir, nil },
		ChooseFiles: choose,
		Reveal:      func(path string) error { revealed = append(revealed, path); return nil },
	})
	return service, dir, &revealed
}

func TestIconServiceAddsWhatIsChosenAndListsIt(t *testing.T) {
	from := t.TempDir()
	chosen := filepath.Join(from, "acme.svg")
	if err := os.WriteFile(chosen, []byte(anIcon), 0o644); err != nil {
		t.Fatal(err)
	}
	var asked string
	service, _, _ := iconService(t, func(kind string) ([]string, error) { asked = kind; return []string{chosen}, nil })
	result := service.Add()
	if result.Error != "" || len(result.Added) != 1 || result.Added[0] != "acme" || asked != "icon" {
		t.Fatalf("add = %+v, asked for %q", result, asked)
	}
	list := service.List()
	if list.Error != "" || len(list.Icons) != 1 || !strings.Contains(list.Icons[0].SVG, "#0F766E") {
		t.Errorf("list = %+v", list)
	}
}

func TestIconServiceCancelledAddsNothing(t *testing.T) {
	service, _, _ := iconService(t, func(string) ([]string, error) { return nil, nil })
	if result := service.Add(); result.Error != "" || len(result.Added) != 0 || len(result.Problems) != 0 {
		t.Errorf("add = %+v", result)
	}
}

func TestIconServiceRenamesAndDeletes(t *testing.T) {
	service, dir, _ := iconService(t, nil)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "acme.svg"), []byte(anIcon), 0o644); err != nil {
		t.Fatal(err)
	}
	if p := service.Rename("acme", "billing"); p.Error != "" {
		t.Fatal(p.Error)
	}
	if p := service.Rename("billing", "a/b"); p.Error == "" {
		t.Error("renamed to a path")
	}
	if p := service.Delete("billing"); p.Error != "" {
		t.Fatal(p.Error)
	}
	if list := service.List(); len(list.Icons) != 0 {
		t.Errorf("still listed: %+v", list.Icons)
	}
	if p := service.Delete("billing"); p.Code != "notFound" {
		t.Errorf("deleting what is gone: %+v", p)
	}
}

// Show Folder opens the library, made first so there is something to show.
func TestIconServiceShowsTheFolder(t *testing.T) {
	service, dir, revealed := iconService(t, nil)
	if p := service.ShowFolder(); p.Error != "" {
		t.Fatal(p.Error)
	}
	if len(*revealed) != 1 || (*revealed)[0] != dir {
		t.Errorf("revealed %v", *revealed)
	}
	if info, err := os.Stat(dir); err != nil || !info.IsDir() {
		t.Errorf("the folder was not made: %v", err)
	}
}

func TestIconServiceWithoutItsFolderSaysSo(t *testing.T) {
	service := app.NewIconService(app.IconServiceOptions{Dir: func() (string, error) { return "", errors.New("no config directory") }})
	if list := service.List(); list.Error == "" {
		t.Error("listed without a folder")
	}
}

// What is picked is kept, as every picked path is, so a sandbox lets Bava reach it again.
func TestIconServiceKeepsWhatWasPicked(t *testing.T) {
	from := t.TempDir()
	chosen := filepath.Join(from, "acme.svg")
	if err := os.WriteFile(chosen, []byte(anIcon), 0o644); err != nil {
		t.Fatal(err)
	}
	grants, err := access.Open(filepath.Join(t.TempDir(), "access.json"), access.None{})
	if err != nil {
		t.Fatal(err)
	}
	service := app.NewIconService(app.IconServiceOptions{
		Dir:         func() (string, error) { return filepath.Join(t.TempDir(), "icons"), nil },
		ChooseFiles: func(string) ([]string, error) { return []string{chosen}, nil },
		Access:      grants,
	})
	service.Add()
	if !grants.Granted(chosen) {
		t.Error("the picked file was not kept")
	}
}
