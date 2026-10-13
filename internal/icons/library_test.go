package icons_test

import (
	"errors"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"github.com/tharabyte/bava/internal/icons"
)

const square = `<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="#0F766E"/></svg>`
const darkSquare = `<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="#5EEAD4"/></svg>`

func write(t *testing.T, dir, name, contents string) string {
	t.Helper()
	path := filepath.Join(dir, name)
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(contents), 0o644); err != nil {
		t.Fatal(err)
	}
	return path
}

func names(t *testing.T, library *icons.Library) []string {
	t.Helper()
	list, err := library.List()
	if err != nil {
		t.Fatal(err)
	}
	var out []string
	for _, icon := range list {
		out = append(out, icon.Name)
	}
	return out
}

// The library is a plain folder: what is in it is listed, a dark copy with
// its icon, anything not a whole SVG left out, the folder made when first used.
func TestListReadsThePlainFolder(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "icons")
	library := icons.Open(dir)
	if got := names(t, library); len(got) != 0 {
		t.Fatalf("an empty library lists %v", got)
	}
	write(t, dir, "acme.svg", square)
	write(t, dir, "acme.dark.svg", darkSquare)
	write(t, dir, "billing.svg", `<svg viewBox="0 0 10 10"><script>x()</script><circle r="5"/></svg>`)
	write(t, dir, "broken.svg", `<svg viewBox="0 0`)
	write(t, dir, "notes.txt", "not an icon")
	write(t, dir, "orphan.dark.svg", darkSquare)
	write(t, dir, ".trash/old.svg", square)
	list, err := library.List()
	if err != nil {
		t.Fatal(err)
	}
	if got := names(t, library); !slices.Equal(got, []string{"acme", "billing"}) {
		t.Fatalf("listed %v", got)
	}
	if !strings.Contains(list[0].SVG, "#0F766E") || !strings.Contains(list[0].DarkSVG, "#5EEAD4") {
		t.Errorf("acme = %+v", list[0])
	}
	if strings.Contains(list[1].SVG, "script") || list[1].DarkSVG != "" {
		t.Errorf("billing = %+v", list[1])
	}
}

func TestAddCopiesCleanedFilesNamedByFile(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "icons")
	from := t.TempDir()
	library := icons.Open(dir)
	write(t, dir, "acme.svg", square)
	added, problems, err := library.Add([]string{
		write(t, from, "acme.svg", square),
		write(t, from, "Edge Node.SVG", `<svg viewBox="0 0 10 10"><rect onclick="x()" width="10" height="10"/></svg>`),
		write(t, from, "readme.md", "# no"),
		write(t, from, "broken.svg", "<svg"),
	})
	if err != nil {
		t.Fatal(err)
	}
	if !slices.Equal(added, []string{"acme-2", "Edge Node"}) {
		t.Errorf("added %v", added)
	}
	if len(problems) != 2 {
		t.Errorf("problems %v", problems)
	}
	stored, err := os.ReadFile(filepath.Join(dir, "Edge Node.svg"))
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(stored), "onclick") {
		t.Errorf("stored as given: %s", stored)
	}
}

// A dark copy comes with its icon or later; it never overwrites one.
func TestAddPairsADarkCopy(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "icons")
	from := t.TempDir()
	library := icons.Open(dir)
	if _, _, err := library.Add([]string{write(t, from, "lake.svg", square), write(t, from, "lake.dark.svg", darkSquare)}); err != nil {
		t.Fatal(err)
	}
	write(t, dir, "acme.svg", square)
	if _, _, err := library.Add([]string{write(t, from, "acme.dark.svg", darkSquare)}); err != nil {
		t.Fatal(err)
	}
	_, problems, err := library.Add([]string{write(t, from, "acme.dark.svg", square)})
	if err != nil {
		t.Fatal(err)
	}
	if len(problems) != 1 {
		t.Errorf("a second dark copy: problems %v", problems)
	}
	list, _ := library.List()
	for _, icon := range list {
		if icon.DarkSVG == "" || !strings.Contains(icon.DarkSVG, "#5EEAD4") {
			t.Errorf("%s has no dark copy, or the wrong one", icon.Name)
		}
	}
}

// A folder adds the icons in it, not those in folders inside it.
func TestAddAFolder(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "icons")
	from := t.TempDir()
	write(t, from, "set/one.svg", square)
	write(t, from, "set/two.svg", square)
	write(t, from, "set/deeper/three.svg", square)
	added, _, err := icons.Open(dir).Add([]string{filepath.Join(from, "set")})
	if err != nil {
		t.Fatal(err)
	}
	slices.Sort(added)
	if !slices.Equal(added, []string{"one", "two"}) {
		t.Errorf("added %v", added)
	}
}

func TestAddRefusesAFileTooLarge(t *testing.T) {
	from := t.TempDir()
	huge := `<svg viewBox="0 0 10 10"><desc>` + strings.Repeat("x", icons.MaxIconBytes) + `</desc></svg>`
	added, problems, err := icons.Open(filepath.Join(t.TempDir(), "icons")).Add([]string{write(t, from, "huge.svg", huge)})
	if err != nil {
		t.Fatal(err)
	}
	if len(added) != 0 || len(problems) != 1 {
		t.Errorf("added %v, problems %v", added, problems)
	}
}

func TestRenameMovesThePair(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "icons")
	library := icons.Open(dir)
	write(t, dir, "acme.svg", square)
	write(t, dir, "acme.dark.svg", darkSquare)
	write(t, dir, "other.svg", square)
	if err := library.Rename("acme", "billing"); err != nil {
		t.Fatal(err)
	}
	if got := names(t, library); !slices.Equal(got, []string{"billing", "other"}) {
		t.Errorf("listed %v", got)
	}
	if _, err := os.Stat(filepath.Join(dir, "billing.dark.svg")); err != nil {
		t.Errorf("the dark copy stayed behind: %v", err)
	}
	for _, bad := range []string{"other", "", "a/b", ".hidden", "x.dark", "  "} {
		if err := library.Rename("billing", bad); err == nil {
			t.Errorf("renamed to %q", bad)
		}
	}
	if err := library.Rename("gone", "new"); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("renaming what is not there: %v", err)
	}
}

// Deleting moves the pair into the library's own trash, never erasing it.
func TestDeleteMovesThePairToTheTrash(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "icons")
	library := icons.Open(dir)
	write(t, dir, "acme.svg", square)
	write(t, dir, "acme.dark.svg", darkSquare)
	write(t, dir, ".trash/acme.svg", "an older one")
	if err := library.Delete("acme"); err != nil {
		t.Fatal(err)
	}
	if got := names(t, library); len(got) != 0 {
		t.Errorf("still listed: %v", got)
	}
	entries, _ := os.ReadDir(filepath.Join(dir, ".trash"))
	var trashed []string
	for _, entry := range entries {
		trashed = append(trashed, entry.Name())
	}
	slices.Sort(trashed)
	if !slices.Equal(trashed, []string{"acme-2.dark.svg", "acme-2.svg", "acme.svg"}) {
		t.Errorf("trash holds %v", trashed)
	}
}

// A name from the page is a name in the library, never a way out of it.
func TestRenameAndDeleteTakeOnlyNames(t *testing.T) {
	root := t.TempDir()
	dir := filepath.Join(root, "icons")
	library := icons.Open(dir)
	write(t, dir, "acme.svg", square)
	outside := write(t, root, "plan.svg", square)
	for _, name := range []string{"../plan", "..", "a/b", ".trash/acme", ""} {
		if err := library.Delete(name); err == nil {
			t.Errorf("deleted %q", name)
		}
		if err := library.Rename(name, "taken"); err == nil {
			t.Errorf("renamed %q", name)
		}
	}
	if _, err := os.Stat(outside); err != nil {
		t.Errorf("a file outside the library moved: %v", err)
	}
}

// Windows keeps some names for devices; an icon can never take one there.
func TestNamesEveryPlatformCanHold(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "icons")
	library := icons.Open(dir)
	write(t, dir, "acme.svg", square)
	for _, bad := range []string{"CON", "nul", "Com1", "lpt9", "aux", "name.", "name . "} {
		if err := library.Rename("acme", bad); err == nil {
			t.Errorf("renamed to %q", bad)
		}
	}
	from := t.TempDir()
	added, _, err := library.Add([]string{write(t, from, `a:b?.svg`, square), write(t, from, "con.svg", square)})
	if err != nil {
		t.Fatal(err)
	}
	slices.Sort(added)
	if !slices.Equal(added, []string{"a-b-", "con-icon"}) {
		t.Errorf("added %v", added)
	}
}

// A rename never writes over another icon, or its dark copy, whatever the case.
func TestRenameNeverOverwrites(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "icons")
	library := icons.Open(dir)
	write(t, dir, "acme.svg", square)
	write(t, dir, "billing.dark.svg", darkSquare)
	if err := library.Rename("acme", "billing"); err == nil {
		t.Error("renamed onto a dark copy already there")
	}
	if err := library.Rename("acme", "ACME"); err != nil {
		t.Fatalf("a change of case: %v", err)
	}
	if got := names(t, library); !slices.Equal(got, []string{"ACME"}) {
		t.Errorf("listed %v", got)
	}
}

// The library's own files end in .svg; that is what it lists, renames and deletes.
func TestLibraryFilesEndInLowerCaseSvg(t *testing.T) {
	dir := filepath.Join(t.TempDir(), "icons")
	library := icons.Open(dir)
	write(t, dir, "Logo.SVG", square)
	from := t.TempDir()
	added, _, err := library.Add([]string{write(t, from, "Edge.SVG", square)})
	if err != nil || !slices.Equal(added, []string{"Edge"}) {
		t.Fatalf("added %v: %v", added, err)
	}
	if got := names(t, library); !slices.Equal(got, []string{"Edge"}) {
		t.Errorf("listed %v", got)
	}
}
