package export

import (
	"regexp"
	"strings"
	"testing"
)

var entries = []Entry{
	{Title: "Roadmap", Sheet: 2},
	{Title: "Marketing", Folder: true},
	{Title: "Launch plan", Depth: 1, Sheet: 4},
	{Title: "Social", Depth: 1, Folder: true},
	{Title: "Posts <draft>", Depth: 2, Sheet: 7},
}

func TestTheContentsListEachPageAndItsSheetInOrder(t *testing.T) {
	html := contentsPage("Acme Product", entries, Colours{Text: "#0a0a0a"}, sources())
	got := regexp.MustCompile(`<span class="name">([^<]*)</span>(?:<span class="sheet">(\d+)</span>)?`).FindAllStringSubmatch(html, -1)
	want := [][2]string{{"Roadmap", "2"}, {"Marketing", ""}, {"Launch plan", "4"}, {"Social", ""}, {"Posts &lt;draft&gt;", "7"}}
	if len(got) != len(want) {
		t.Fatalf("entries = %q", got)
	}
	for i, w := range want {
		if got[i][1] != w[0] || got[i][2] != w[1] {
			t.Errorf("entry %d = %q, %q; want %q, %q", i, got[i][1], got[i][2], w[0], w[1])
		}
	}
	if !strings.Contains(html, "<h1>Acme Product</h1>") {
		t.Errorf("no title:\n%s", html)
	}
}

func TestFoldersAreHeadingsNestedByDepth(t *testing.T) {
	html := contentsPage("Acme", entries, Colours{}, sources())
	for _, want := range []string{`class="folder" style="--depth: 0"`, `class="page" style="--depth: 1"`, `class="folder" style="--depth: 1"`, `class="page" style="--depth: 2"`} {
		if !strings.Contains(html, want) {
			t.Errorf("no %s:\n%s", want, html)
		}
	}
}

func TestTheContentsCarryTheirFontAndReachNothing(t *testing.T) {
	html := contentsPage("Acme", entries, Colours{}, sources())
	if !strings.Contains(html, "data:font/woff2") || !strings.Contains(html, "default-src 'none'") {
		t.Errorf("no font or policy:\n%s", html)
	}
	if strings.Contains(contentsPage(`<b>x</b>`, nil, Colours{}, sources()), "<b>") {
		t.Error("a title was read as markup")
	}
}
