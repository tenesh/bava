package export

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"math"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"github.com/pdfcpu/pdfcpu/pkg/api"

	"github.com/tenesh/bava/internal/pdfprint"
	"github.com/tenesh/bava/internal/testutil"
)

// printed is one print the fake printer was asked for.
type printed struct {
	html  string
	setup pdfprint.PageSetup
	out   string
}

// fakePrinter writes blank PDFs at the setup's size: a sheet for each
// numbered sheet asked for, two pages for a page saying "two pages", else one.
func fakePrinter(log *[]printed, fail string) Printer {
	return func(html string, setup pdfprint.PageSetup, out string) error {
		*log = append(*log, printed{html, setup, out})
		if fail != "" && strings.Contains(html, fail) {
			return errors.New("the printer jammed")
		}
		n := strings.Count(html, `class="sheet"`)
		// The contents: three lines to a sheet.
		if lines := strings.Count(html, "<li "); lines > 0 {
			n = (lines + 2) / 3
		}
		if n == 0 {
			n = 1
			if strings.Contains(html, "two pages") {
				n = 2
			}
		}
		w, h, err := setup.Size()
		if err != nil {
			return err
		}
		return os.WriteFile(out, testutil.BlankPDF(n, w, h), 0o644)
	}
}

func sizes(t *testing.T, path string) [][2]float64 {
	t.Helper()
	dims, err := api.PageDimsFile(context.Background(), path)
	if err != nil {
		t.Fatal(err)
	}
	out := [][2]float64{}
	for _, d := range dims {
		out = append(out, [2]float64{math.Round(d.Width * 25.4 / 72), math.Round(d.Height * 25.4 / 72)})
	}
	return out
}

var (
	doc      = &Page{HTML: "<p>two pages</p>", WidthPx: 720}
	wide     = &Canvas{SVG: `<svg xmlns="http://www.w3.org/2000/svg"/>`, Width: 1600, Height: 900}
	tall     = &Canvas{SVG: `<svg xmlns="http://www.w3.org/2000/svg"/>`, Width: 400, Height: 900}
	portrait = [2]float64{210, 297}
	sideways = [2]float64{297, 210}
)

func export(t *testing.T, req Request, fail string) ([]printed, string, error) {
	t.Helper()
	var log []printed
	out := filepath.Join(t.TempDir(), "Launch plan.pdf")
	err := PagePDF(context.Background(), req, sources(), fakePrinter(&log, fail), out)
	return log, out, err
}

func TestAPagesPDFHoldsWhatItIncludesInOrder(t *testing.T) {
	for name, c := range map[string]struct {
		req  Request
		want [][2]float64
	}{
		"the Document":           {Request{Setup: a4, Document: doc}, [][2]float64{portrait, portrait}},
		"a wide Canvas":          {Request{Setup: a4, Canvas: wide}, [][2]float64{sideways}},
		"a tall Canvas":          {Request{Setup: a4, Canvas: tall}, [][2]float64{portrait}},
		"both, the Canvas after": {Request{Setup: a4, Document: doc, Canvas: wide}, [][2]float64{portrait, portrait, sideways}},
	} {
		_, out, err := export(t, c.req, "")
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		if got := sizes(t, out); fmt.Sprint(got) != fmt.Sprint(c.want) {
			t.Errorf("%s: pages %v; want %v", name, got, c.want)
		}
	}
}

func TestAPagesPDFIncludesSomething(t *testing.T) {
	if _, _, err := export(t, Request{Setup: a4}, ""); err == nil {
		t.Error("a PDF of nothing was made")
	}
}

// The Canvas is scaled down to fit its sheet whole, never enlarged.
func TestTheCanvasFitsItsSheetAndIsNeverEnlarged(t *testing.T) {
	small := &Canvas{SVG: `<svg xmlns="http://www.w3.org/2000/svg"/>`, Width: 300, Height: 200}
	log, _, err := export(t, Request{Setup: a4, Canvas: small}, "")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(log[0].html, "width: 300px; height: 200px") {
		t.Errorf("a small canvas was resized:\n%s", log[0].html)
	}
	log, _, err = export(t, Request{Setup: a4, Canvas: &Canvas{SVG: small.SVG, Width: 3000, Height: 1000}}, "")
	if err != nil {
		t.Fatal(err)
	}
	// Landscape A4 at Normal margins: 257 mm wide, 971.3 CSS pixels.
	m := regexp.MustCompile(`width: ([\d.]+)px; height: ([\d.]+)px`).FindStringSubmatch(log[0].html)
	if m == nil || !strings.HasPrefix(m[1], "971.3") || !strings.HasPrefix(m[2], "323.7") {
		t.Errorf("a large canvas was not fitted: %v", m)
	}
}

// Page numbers run on from the Document into the Canvas, in Bava's font.
func TestPageNumbersRunAcrossTheParts(t *testing.T) {
	log, out, err := export(t, Request{Setup: a4, Numbers: true, Ink: "#737373", Document: doc, Canvas: wide}, "")
	if err != nil {
		t.Fatal(err)
	}
	var numbers []string
	for _, p := range log {
		if strings.Contains(p.html, `class="sheet"`) {
			numbers = append(numbers, strings.Join(regexp.MustCompile(`<span class="n">(\d+)</span>`).FindAllString(p.html, -1), ""))
			if p.setup.Margins != (pdfprint.Margins{}) || p.setup.Background {
				t.Errorf("numbers printed with margins or a background: %+v", p.setup)
			}
			if !strings.Contains(p.html, "data:font/woff2") {
				t.Error("the numbers are not in Bava's font")
			}
		}
	}
	want := []string{`<span class="n">1</span><span class="n">2</span>`, `<span class="n">3</span>`}
	if fmt.Sprint(numbers) != fmt.Sprint(want) {
		t.Errorf("numbers = %q; want %q", numbers, want)
	}
	if got := sizes(t, out); len(got) != 3 {
		t.Errorf("numbering changed the pages: %v", got)
	}
}

// Dark is dark to the paper's edge: a fill the size of each sheet goes
// under it.
func TestDarkFillsEachPartToItsEdge(t *testing.T) {
	log, _, err := export(t, Request{Setup: a4, Dark: true, Paper: "#0a0a0a", Document: doc, Canvas: wide}, "")
	if err != nil {
		t.Fatal(err)
	}
	var fills []pdfprint.PageSetup
	for _, p := range log {
		if strings.Contains(p.html, "bava-fill") {
			fills = append(fills, p.setup)
			if !strings.Contains(p.html, "#0a0a0a") {
				t.Errorf("the fill is not the paper's colour:\n%s", p.html)
			}
		}
	}
	if len(fills) != 2 || fills[0].Landscape || !fills[1].Landscape || fills[0].Margins != (pdfprint.Margins{}) || !fills[0].Background {
		t.Errorf("fills = %+v; want one per part, at its orientation, edge to edge", fills)
	}
	if _, _, err := export(t, Request{Setup: a4, Dark: true, Paper: "red; } body { x", Document: doc}, ""); err == nil {
		t.Error("a paper colour that is not a colour was taken")
	}
}

func TestAFailedPrintLeavesNothing(t *testing.T) {
	log, out, err := export(t, Request{Setup: a4, Document: doc, Canvas: wide}, "<img")
	if err == nil {
		t.Fatal("a failed print was reported as done")
	}
	if _, err := os.Stat(out); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("%s was written", out)
	}
	if _, err := os.Stat(filepath.Dir(log[0].out)); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("the parts were left in %s", filepath.Dir(log[0].out))
	}
}

// pdfcpu keeps a folder of its own settings unless told not to.
func TestJoiningWritesNoSettingsAnywhere(t *testing.T) {
	home := t.TempDir()
	for _, v := range []string{"HOME", "XDG_CONFIG_HOME", "APPDATA", "PDFCPU_CONFIG_ROOT"} {
		t.Setenv(v, home)
	}
	if _, _, err := export(t, Request{Setup: a4, Numbers: true, Ink: "#737373", Dark: true, Paper: "#000", Document: doc}, ""); err != nil {
		t.Fatal(err)
	}
	_ = filepath.WalkDir(home, func(path string, d fs.DirEntry, err error) error {
		if path != home {
			t.Errorf("written: %s", path)
		}
		return nil
	})
}

func TestPageNumbersNeedAColour(t *testing.T) {
	if _, _, err := export(t, Request{Setup: a4, Numbers: true, Document: doc}, ""); err == nil {
		t.Error("numbers with no colour were printed")
	}
}
