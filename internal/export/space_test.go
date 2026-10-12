package export

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"github.com/pdfcpu/pdfcpu/pkg/api"

	"github.com/tharabyte/bava/internal/pdfprint"
	"github.com/tharabyte/bava/internal/testutil"
)

// spaceRequest is a Space of three pages, one in a folder within a folder,
// two of two sheets and one with a wide Canvas.
func spaceRequest() SpaceRequest {
	return SpaceRequest{
		Setup: a4, Title: "Acme Product", Ink: "#737373", Text: "#0a0a0a",
		Entries: []SpaceEntry{
			{Entry: Entry{Title: "Roadmap"}, Path: "Roadmap.md", Document: &Page{HTML: "<p>two pages</p>"}},
			{Entry: Entry{Title: "Marketing", Folder: true}, Path: "Marketing"},
			{Entry: Entry{Title: "Launch plan", Depth: 1}, Path: "Marketing/Launch plan.md", Document: &Page{HTML: "<p>one</p>"}, Canvas: wide},
			{Entry: Entry{Title: "Social", Depth: 1, Folder: true}, Path: "Marketing/Social"},
			{Entry: Entry{Title: "Posts", Depth: 2}, Path: "Marketing/Social/Posts.md", Document: &Page{HTML: "<p>two pages</p>"}},
		},
	}
}

func exportSpace(t *testing.T, req SpaceRequest, fail string) ([]printed, string, error) {
	t.Helper()
	var log []printed
	out := filepath.Join(t.TempDir(), "Acme Product.pdf")
	err := SpacePDF(context.Background(), req, sources(), fakePrinter(&log, fail), out)
	return log, out, err
}

// Contents (two sheets: five lines), Roadmap (2), Launch plan (1, then its
// Canvas, landscape), Posts (2): eight sheets.
func TestASpacesPDFIsTheContentsThenEachPageInOrder(t *testing.T) {
	_, out, err := exportSpace(t, spaceRequest(), "")
	if err != nil {
		t.Fatal(err)
	}
	want := [][2]float64{portrait, portrait, portrait, portrait, portrait, sideways, portrait, portrait}
	if got := sizes(t, out); fmt.Sprint(got) != fmt.Sprint(want) {
		t.Errorf("sheets = %v; want %v", got, want)
	}
}

// The contents run to two sheets, so the pages start on 3, 5 and 7: the
// contents are printed again once that is known.
func TestTheContentsListTheSheetsEachPageStartsOn(t *testing.T) {
	log, _, err := exportSpace(t, spaceRequest(), "")
	if err != nil {
		t.Fatal(err)
	}
	var last string
	for _, p := range log {
		if strings.Contains(p.html, "<ol>") {
			last = p.html
		}
	}
	got := regexp.MustCompile(`<span class="sheet">(\d+)</span>`).FindAllStringSubmatch(last, -1)
	if fmt.Sprint(got) != "[[<span class=\"sheet\">3</span> 3] [<span class=\"sheet\">5</span> 5] [<span class=\"sheet\">7</span> 7]]" {
		t.Errorf("contents sheets = %v", got)
	}
	if !strings.Contains(last, "Acme Product") {
		t.Error("the contents are not titled")
	}
}

func TestBookmarksNestPagesUnderTheirFolders(t *testing.T) {
	_, out, err := exportSpace(t, spaceRequest(), "")
	if err != nil {
		t.Fatal(err)
	}
	pdf, err := os.ReadFile(out)
	if err != nil {
		t.Fatal(err)
	}
	conf, _ := api.LoadConfiguration(api.ConfigurationOptions{Mode: api.ConfigurationModeStateless})
	marks, err := api.Bookmarks(context.Background(), bytes.NewReader(pdf), conf)
	if err != nil {
		t.Fatal(err)
	}
	got := []string{}
	for _, b := range marks {
		got = append(got, fmt.Sprintf("%s@%d", b.Title, b.PageFrom))
		for _, k := range b.Kids {
			got = append(got, fmt.Sprintf("  %s@%d", k.Title, k.PageFrom))
			for _, g := range k.Kids {
				got = append(got, fmt.Sprintf("    %s@%d", g.Title, g.PageFrom))
			}
		}
	}
	want := []string{"Roadmap@3", "Marketing@5", "  Launch plan@5", "  Social@7", "    Posts@7"}
	if fmt.Sprint(got) != fmt.Sprint(want) {
		t.Errorf("bookmarks = %q; want %q", got, want)
	}
}

func TestASpacesSheetsAreNumberedFromTheContents(t *testing.T) {
	req := spaceRequest()
	req.Numbers = true
	_, out, err := exportSpace(t, req, "")
	if err != nil {
		t.Fatal(err)
	}
	pdf, err := os.ReadFile(out)
	if err != nil {
		t.Fatal(err)
	}
	numbers, err := PageNumbers(context.Background(), pdf)
	if err != nil {
		t.Fatal(err)
	}
	if fmt.Sprint(numbers) != "[1 2 3 4 5 6 7 8]" {
		t.Errorf("each page's number = %v; want 1 to 8", numbers)
	}
}

// One page failing stops everything: no file, and the page named.
func TestAPageThatFailsStopsTheExport(t *testing.T) {
	req := spaceRequest()
	req.Entries[4].Document = &Page{HTML: "<p>jam here</p>"}
	_, out, err := exportSpace(t, req, "jam here")
	var failed *PageError
	if !errors.As(err, &failed) || failed.Path != "Marketing/Social/Posts.md" {
		t.Fatalf("err = %v; want the failing page named", err)
	}
	if _, err := os.Stat(out); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("%s was written", out)
	}
}

// Cancelled while its first page prints: it stops before the next and
// writes nothing.
func TestACancelledSpacesPDFStopsBetweenPagesAndWritesNothing(t *testing.T) {
	var log []printed
	print := fakePrinter(&log, "")
	ctx, cancel := context.WithCancel(context.Background())
	calls := 0
	out := filepath.Join(t.TempDir(), "Acme Product.pdf")
	err := SpacePDF(ctx, spaceRequest(), sources(), func(html string, setup pdfprint.PageSetup, file string) error {
		calls++
		cancel()
		return print(html, setup, file)
	}, out)
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("err = %v, want cancelled", err)
	}
	if calls != 1 {
		t.Errorf("printed %d times after the cancel; want it to stop after the first", calls)
	}
	if _, err := os.Stat(out); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("%s was written", out)
	}
}

func TestASpacesPDFNeedsAPage(t *testing.T) {
	req := spaceRequest()
	req.Entries = []SpaceEntry{{Entry: Entry{Title: "Empty", Folder: true}, Path: "Empty"}}
	if _, _, err := exportSpace(t, req, ""); !errors.Is(err, ErrNothing) {
		t.Errorf("err = %v; want ErrNothing", err)
	}
}

func TestASpacesPDFWritesNoSettingsAnywhere(t *testing.T) {
	home := t.TempDir()
	for _, v := range []string{"HOME", "XDG_CONFIG_HOME", "APPDATA", "PDFCPU_CONFIG_ROOT"} {
		t.Setenv(v, home)
	}
	req := spaceRequest()
	req.Numbers, req.Dark, req.Paper = true, true, "#000"
	if _, _, err := exportSpace(t, req, ""); err != nil {
		t.Fatal(err)
	}
	if entries, _ := os.ReadDir(home); len(entries) != 0 {
		t.Errorf("written: %v", entries)
	}
}

// Contents whose length never settles are given up on, not printed forever.
func TestContentsThatNeverSettleAreGivenUp(t *testing.T) {
	var log []printed
	growing := 0
	base := fakePrinter(&log, "")
	print := func(html string, setup pdfprint.PageSetup, out string) error {
		if strings.Contains(html, "<ol>") {
			growing++
			w, h, _ := setup.Size()
			return os.WriteFile(out, testutil.BlankPDF(growing+1, w, h), 0o644)
		}
		return base(html, setup, out)
	}
	err := SpacePDF(context.Background(), spaceRequest(), sources(), print, filepath.Join(t.TempDir(), "x.pdf"))
	if err == nil || !strings.Contains(err.Error(), "settle") {
		t.Fatalf("err = %v; want the contents given up on", err)
	}
	if growing != contentsTries {
		t.Errorf("contents printed %d times; want %d", growing, contentsTries)
	}
}

// Dark contents are written in the theme's text colour, on the fill.
func TestDarkContentsAreInTheThemesColours(t *testing.T) {
	req := spaceRequest()
	req.Dark, req.Paper, req.Text = true, "#0a0a0a", "#fafafa"
	log, _, err := exportSpace(t, req, "")
	if err != nil {
		t.Fatal(err)
	}
	var contents, fills int
	for _, p := range log {
		if strings.Contains(p.html, "<ol>") && strings.Contains(p.html, "color: #fafafa") {
			contents++
		}
		if strings.Contains(p.html, "bava-fill") {
			fills++
		}
	}
	// One fill for the contents and one for each of the four page parts.
	if contents == 0 || fills != 5 {
		t.Errorf("contents in the text colour: %d; fills: %d, want 5", contents, fills)
	}
}
