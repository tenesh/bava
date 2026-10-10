package space_test

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"runtime"
	"strings"
	"testing"

	"github.com/tenesh/bava/internal/format"
	"github.com/tenesh/bava/internal/space"
	"github.com/tenesh/bava/internal/testutil"
)

// canvas is a page's canvas block holding the given elements' JSON.
func canvas(elements ...string) string {
	return "\n```bava-canvas\n{\"version\":1,\"elements\":[" + strings.Join(elements, ",") + "]}\n```\n"
}

func searchSpace(t *testing.T, files map[string]string) space.Space {
	t.Helper()
	root := t.TempDir()
	testutil.WriteTree(t, root, files)
	s, err := space.Open(root)
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func search(t *testing.T, s space.Space, query string, open *space.OpenPage) []space.Hit {
	t.Helper()
	hits, _, err := s.Search(query, open)
	if err != nil {
		t.Fatal(err)
	}
	return hits
}

func hitPaths(hits []space.Hit) []string {
	out := []string{}
	for _, h := range hits {
		out = append(out, h.Path)
	}
	return out
}

func TestSearchFindsNamesDocumentsAndCanvases(t *testing.T) {
	s := searchSpace(t, map[string]string{
		"Launch plan.md":  "Nothing here.\n",
		"Notes.md":        "We launch on Friday.\n",
		"Diagram.md":      "Words.\n" + canvas(`{"id":"a","type":"rect","x":0,"y":0,"w":10,"h":10,"z":0,"label":"Launch day"}`),
		"Unrelated.md":    "Nothing.\n",
		"Launch kit/a.md": "x\n",
	})
	got := hitPaths(search(t, s, "launch", nil))
	want := []string{"Launch kit", "Launch plan.md", "Diagram.md", "Notes.md"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("hits = %q; want %q", got, want)
	}
}

func TestSearchNeedsEveryWordAnywhereIgnoringCapitals(t *testing.T) {
	s := searchSpace(t, map[string]string{
		"A.md": "The DATE of the launch.\n",
		"B.md": "Launch only.\n",
		"C.md": "Date first.\n" + canvas(`{"id":"t","type":"text","x":0,"y":0,"w":10,"h":10,"z":0,"text":"launch"}`),
	})
	got := hitPaths(search(t, s, "launch date", nil))
	if !reflect.DeepEqual(got, []string{"A.md", "C.md"}) {
		t.Errorf("hits = %q; want both words found, in any order and place", got)
	}
}

func TestSearchMatchesTheStartOfWords(t *testing.T) {
	s := searchSpace(t, map[string]string{"A.md": "Bava launches today.\n"})
	if got := hitPaths(search(t, s, "launch", nil)); !reflect.DeepEqual(got, []string{"A.md"}) {
		t.Errorf("launch: hits = %q; want the longer word found", got)
	}
	if got := search(t, s, "aunch", nil); len(got) != 0 {
		t.Errorf("aunch: hits = %q; want nothing, as no word starts so", hitPaths(got))
	}
}

func TestSearchLeavesOutWhatIsNotWritten(t *testing.T) {
	s := searchSpace(t, map[string]string{
		"A.md": "---\ntags: [secret]\n---\nSee [the plan](https://example.com/hidden).\n<span data-color=\"blue\">Blue</span> **bold** text.\n",
	})
	for _, q := range []string{"secret", "hidden", "example", "span", "data"} {
		if got := search(t, s, q, nil); len(got) != 0 {
			t.Errorf("%s: hits = %q; front matter, link addresses and HTML are not text", q, hitPaths(got))
		}
	}
	for _, q := range []string{"plan", "blue", "bold"} {
		if got := search(t, s, q, nil); len(got) != 1 {
			t.Errorf("%s: hits = %q; want the page", q, hitPaths(got))
		}
	}
}

func TestSearchOnlyLooksAtTheSpacesPages(t *testing.T) {
	s := searchSpace(t, map[string]string{
		"A.md":                        "launch\n",
		".bava/templates/Launch.md":   "launch\n",
		".bava/trash/1/Old launch.md": "launch\n",
		".hidden/launch.md":           "launch\n",
		"launch.txt":                  "launch\n",
	})
	if got := hitPaths(search(t, s, "launch", nil)); !reflect.DeepEqual(got, []string{"A.md"}) {
		t.Errorf("hits = %q; want only the Space's page", got)
	}
}

func TestSearchReadsTheOpenPagesUnsavedText(t *testing.T) {
	s := searchSpace(t, map[string]string{"A.md": "old words\n", "B.md": "launch\n"})
	got := hitPaths(search(t, s, "launch", &space.OpenPage{Path: "A.md", Source: "launch, typed but not saved\n"}))
	if !reflect.DeepEqual(got, []string{"A.md", "B.md"}) {
		t.Errorf("hits = %q; want the open page found by its unsaved text", got)
	}
	if got := search(t, s, "old", &space.OpenPage{Path: "A.md", Source: "new\n"}); len(got) != 0 {
		t.Errorf("hits = %q; the saved text was replaced", hitPaths(got))
	}
}

func TestSearchOrdersNamesThenMatchesThenTree(t *testing.T) {
	s := searchSpace(t, map[string]string{
		"a.md":        "launch\n",
		"b.md":        "launch launch launch\n",
		"c.md":        "launch\n",
		"Launch.md":   "nothing\n",
		"Launch/x.md": "nothing\n",
	})
	got := hitPaths(search(t, s, "launch", nil))
	want := []string{"Launch", "Launch.md", "b.md", "a.md", "c.md"}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("hits = %q; want folders and pages by name, then by count, then tree order", got)
	}
}

func TestSearchGivesEachPageItsBestMatch(t *testing.T) {
	s := searchSpace(t, map[string]string{
		"A.md": "# Plan\n\nThe launch.\n\n- The launch date is set.\n\nA launch again.\n",
	})
	hits := search(t, s, "launch date", nil)
	if len(hits) != 1 {
		t.Fatalf("hits = %q", hitPaths(hits))
	}
	best := hits[0].Best
	if best.Where != "document" || best.Text != "The launch date is set." || best.Word != "launch" || best.Occurrence != 1 {
		t.Errorf("best = %+v; want the list line with both words, the second launch", best)
	}
	if hits[0].Count != 4 {
		t.Errorf("count = %d; want every occurrence of either word", hits[0].Count)
	}
}

func TestSearchNamesTheCanvasElementWhenTheDocumentHasNoMatch(t *testing.T) {
	s := searchSpace(t, map[string]string{
		"A.md": "Nothing.\n" + canvas(
			`{"id":"f","type":"frame","x":0,"y":0,"w":10,"h":10,"z":0,"label":"Funnel"}`,
			`{"id":"c","type":"code","x":0,"y":0,"w":10,"h":10,"z":1,"code":"func launch() {}"}`,
		),
	})
	best := search(t, s, "launch", nil)[0].Best
	if best.Where != "canvas" || best.Element != "c" || best.Text != "func launch() {}" {
		t.Errorf("best = %+v; want the code block", best)
	}
}

func TestSearchShowsWhereAPageFoundByNameSits(t *testing.T) {
	s := searchSpace(t, map[string]string{"Marketing/Launch plan.md": "Nothing.\n"})
	hit := search(t, s, "launch", nil)[0]
	if hit.Best.Where != "name" || hit.Folder != "Marketing" || hit.Name != "Launch plan" {
		t.Errorf("hit = %+v; want a name match in Marketing", hit)
	}
}

func TestSearchCutsALongLineAroundItsMatch(t *testing.T) {
	long := strings.Repeat("filler ", 30) + "launch " + strings.Repeat("tail ", 30)
	s := searchSpace(t, map[string]string{"A.md": long + "\n"})
	text := search(t, s, "launch", nil)[0].Best.Text
	if len([]rune(text)) > 90 || !strings.Contains(text, "launch") || !strings.HasPrefix(text, "…") || !strings.HasSuffix(text, "…") {
		t.Errorf("text = %q; want about 80 characters around the match", text)
	}
}

func TestSearchStopsAtFiftyAndSaysSo(t *testing.T) {
	files := map[string]string{}
	for i := range 60 {
		files[fmt.Sprintf("p%02d.md", i)] = "launch\n"
	}
	s := searchSpace(t, files)
	hits, more, err := s.Search("launch", nil)
	if err != nil {
		t.Fatal(err)
	}
	if len(hits) != 50 || !more {
		t.Errorf("hits = %d, more = %v; want 50 and more", len(hits), more)
	}
}

func TestSearchWithNoWordsFindsNothing(t *testing.T) {
	s := searchSpace(t, map[string]string{"A.md": "launch\n"})
	if got := search(t, s, "   ", nil); len(got) != 0 {
		t.Errorf("hits = %q; want none", hitPaths(got))
	}
}

func TestSearchReadsTheOpenPagesCanvasAsItIs(t *testing.T) {
	s := searchSpace(t, map[string]string{"A.md": "Words.\n"})
	var scene format.Scene
	if err := json.Unmarshal([]byte(`{"version":1,"elements":[{"id":"n","type":"text","x":0,"y":0,"w":1,"h":1,"z":0,"text":"Launch"}]}`), &scene); err != nil {
		t.Fatal(err)
	}
	hits := search(t, s, "launch", &space.OpenPage{Path: "A.md", Source: "Words.\n", Scene: scene})
	if len(hits) != 1 || hits[0].Best.Element != "n" {
		t.Errorf("hits = %+v; want the element drawn but not saved", hits)
	}
}

// Lowercasing can change a text's length in bytes (the Kelvin sign is three
// bytes, its lowercase k one; Turkish İ the other way): search must not cut
// the text where the lowered copy's offsets point.
func TestSearchSurvivesLettersThatChangeLengthWhenLowered(t *testing.T) {
	s := searchSpace(t, map[string]string{
		"A.md": "KKKK\nlaunch\n",
		"B.md": strings.Repeat("İ", 20) + " launch " + strings.Repeat("İ", 100) + "\n",
	})
	hits := search(t, s, "launch", nil)
	if len(hits) != 2 {
		t.Fatalf("hits = %q; want both pages", hitPaths(hits))
	}
	for _, h := range hits {
		if !strings.Contains(h.Best.Text, "launch") {
			t.Errorf("%s: best = %q; want the match in it", h.Path, h.Best.Text)
		}
	}
}

func TestSearchSkipsAPageThatCannotBeRead(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("a file cannot be made unreadable this way on Windows")
	}
	s := searchSpace(t, map[string]string{"a.md": "launch\n", "b.md": "launch\n", "Sub/c.md": "launch\n"})
	for _, p := range []string{"b.md", "Sub"} {
		full := filepath.Join(s.Root, p)
		if err := os.Chmod(full, 0); err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { _ = os.Chmod(full, 0o755) })
	}
	if _, err := os.ReadFile(filepath.Join(s.Root, "b.md")); err == nil {
		t.Skip("a root user can still read a file with no permissions")
	}
	if got := hitPaths(search(t, s, "launch", nil)); !reflect.DeepEqual(got, []string{"a.md"}) {
		t.Errorf("hits = %q; want the readable page, the others passed over", got)
	}
}

func TestSearchReadsNoLabelFromLinesOrStrokes(t *testing.T) {
	s := searchSpace(t, map[string]string{
		"A.md": "Words.\n" + canvas(`{"id":"l","type":"line","x":0,"y":0,"w":1,"h":1,"z":0,"label":"launch"}`),
	})
	if got := search(t, s, "launch", nil); len(got) != 0 {
		t.Errorf("hits = %q; find on the Canvas never matches a line, so search must not either", hitPaths(got))
	}
}
