package e2e

import (
	"errors"
	"fmt"
	"math"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/tenesh/bava/internal/pdfprint"
)

// samplePage is what a "pdf" step prints: two pages, the second forced onto
// a page of its own, so a print that ran shows two however the paper is.
const samplePage = `<!doctype html><html><head><meta charset="utf-8"><style>
body { font: 14px/1.5 sans-serif; color: #0a0a0a; }
.block { height: 120px; background: #e6eef7; border: 1px solid #4a7fb5; }
.next { break-before: page; page-break-before: always; }
</style></head><body>
<h1>Printed by Bava</h1><p>The first page of the proof.</p><div class="block"></div>
<h1 class="next">Second page</h1><p>Forced onto a page of its own.</p>
</body></html>`

// parseSetup reads a "pdf" step's setup from its name: paper, orientation
// and margins, as "Letter/landscape/none". Backgrounds are always printed.
func parseSetup(name string) (pdfprint.PageSetup, error) {
	parts := strings.Split(name, "/")
	if len(parts) != 3 {
		return pdfprint.PageSetup{}, fmt.Errorf("a pdf step's name is paper/orientation/margins, not %q", name)
	}
	setup := pdfprint.PageSetup{Paper: pdfprint.Paper(parts[0]), Background: true}
	if _, _, err := setup.Size(); err != nil {
		return pdfprint.PageSetup{}, err
	}
	switch parts[1] {
	case "portrait":
	case "landscape":
		setup.Landscape = true
	default:
		return pdfprint.PageSetup{}, fmt.Errorf("orientation %q is neither portrait nor landscape", parts[1])
	}
	margins, err := pdfprint.NamedMargins(pdfprint.MarginName(parts[2]))
	if err != nil {
		return pdfprint.PageSetup{}, err
	}
	setup.Margins = margins
	return setup, nil
}

// expectation is what a printed PDF must hold: its pages, each of a size.
type expectation struct {
	pages             int
	widthMM, heightMM float64
}

// parseExpect reads "pages=2 size=210x297" (millimetres).
func parseExpect(text string) (expectation, error) {
	var e expectation
	for _, field := range strings.Fields(text) {
		key, value, _ := strings.Cut(field, "=")
		switch key {
		case "pages":
			n, err := strconv.Atoi(value)
			if err != nil {
				return e, fmt.Errorf("pages %q is not a number", value)
			}
			e.pages = n
		case "size":
			w, h, ok := strings.Cut(value, "x")
			width, errW := strconv.ParseFloat(w, 64)
			height, errH := strconv.ParseFloat(h, 64)
			if !ok || errW != nil || errH != nil {
				return e, fmt.Errorf("size %q is not width x height", value)
			}
			e.widthMM, e.heightMM = width, height
		default:
			return e, fmt.Errorf("unknown %q in what a PDF must hold", key)
		}
	}
	if e.pages == 0 || e.widthMM == 0 {
		return e, errors.New("what a PDF must hold needs pages= and size=")
	}
	return e, nil
}

// met checks a PDF against it, each page's size to within a millimetre.
func (e expectation) met(info pdfprint.Info) error {
	if info.Pages != e.pages {
		return fmt.Errorf("%d pages, not %d", info.Pages, e.pages)
	}
	for i, s := range info.Sizes {
		if math.Abs(s.WidthMM-e.widthMM) > 1 || math.Abs(s.HeightMM-e.heightMM) > 1 {
			return fmt.Errorf("page %d is %v × %v mm, not %v × %v", i+1, s.WidthMM, s.HeightMM, e.widthMM, e.heightMM)
		}
	}
	return nil
}

// PrintSample has the system print the sample page to a PDF in the run's
// output folder (kept with the run's downloads), then reads it back against
// what it must hold. Returns an error message, or "".
func (s *Service) PrintSample(file, setupName, expect string) string {
	if s.options.RunOnMain == nil {
		return "pdf: no main thread to print on"
	}
	setup, err := parseSetup(setupName)
	if err != nil {
		return err.Error()
	}
	want, err := parseExpect(expect)
	if err != nil {
		return err.Error()
	}
	out := filepath.Join(s.options.Out, filepath.Base(file))
	if err := pdfprint.Print(samplePage, setup, out, pdfprint.RunOnMain(s.options.RunOnMain)); err != nil {
		return fmt.Sprintf("%s: %v", file, err)
	}
	info, err := pdfprint.Inspect(out)
	if err != nil {
		return err.Error()
	}
	if err := want.met(info); err != nil {
		return fmt.Sprintf("%s: %v", file, err)
	}
	return ""
}
