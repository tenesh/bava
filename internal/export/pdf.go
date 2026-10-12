package export

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"

	"github.com/pdfcpu/pdfcpu/pkg/api"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/model"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/types"

	"github.com/tharabyte/bava/internal/pdfprint"
	"github.com/tharabyte/bava/internal/store"
)

// Printer prints one self-contained HTML document to a PDF file.
type Printer func(html string, setup pdfprint.PageSetup, out string) error

// Canvas is a page's Canvas as a picture, and its size in CSS pixels.
type Canvas struct {
	SVG    string  `json:"svg"`
	Width  float64 `json:"width"`
	Height float64 `json:"height"`
}

// Request is a page's PDF: what it includes, and how it is printed.
type Request struct {
	Setup pdfprint.PageSetup `json:"setup"`
	Dark  bool               `json:"dark"`
	// Paper is the theme's page colour, filled to the sheet's edge when dark.
	Paper string `json:"paper"`
	// Ink is the colour page numbers are written in.
	Ink      string  `json:"ink"`
	Numbers  bool    `json:"numbers"`
	Document *Page   `json:"document"`
	Canvas   *Canvas `json:"canvas"`
}

// ErrNothing is a request that includes neither the Document nor the Canvas.
var ErrNothing = errors.New("a PDF needs the Document, the Canvas or both")

// colour is a CSS colour as the frontend reads it from the theme.
var colour = regexp.MustCompile(`^(#[0-9a-fA-F]{3,8}|rgba?\([0-9., %]+\))$`)

// part is one printed part of the PDF and the setup it was printed with.
type part struct {
	file  string
	setup pdfprint.PageSetup
}

// look is how every sheet of a PDF looks: dark to its edge in the paper's
// colour, numbered in the ink's.
type look struct {
	dark    bool
	paper   string
	ink     string
	numbers bool
}

// hexColour is a colour as the PDF stamps it: #rrggbb.
var hexColour = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

// check refuses a look that cannot be drawn: numbers with no colour, or a
// colour that is not one.
func (l look) check() error {
	if l.numbers && !hexColour.MatchString(l.ink) {
		return errors.New("page numbers need a colour, as #rrggbb")
	}
	for _, c := range []string{l.paper, l.ink} {
		if c != "" && !colour.MatchString(c) {
			return fmt.Errorf("%q is not a colour", c)
		}
	}
	return nil
}

// workspace is a folder of the parts being printed, removed with done, and
// pdfcpu's settings, kept in memory.
func workspace() (dir string, conf *model.Configuration, done func(), err error) {
	dir, err = os.MkdirTemp("", "bava-pdf-*")
	if err != nil {
		return "", nil, nil, fmt.Errorf("export PDF: %w", err)
	}
	done = func() { _ = os.RemoveAll(dir) }
	conf, err = api.LoadConfiguration(api.ConfigurationOptions{Mode: api.ConfigurationModeStateless})
	if err != nil {
		done()
		return "", nil, nil, fmt.Errorf("export PDF: %w", err)
	}
	return dir, conf, done, nil
}

// PagePDF prints a page's Document, then its Canvas on a sheet of its own,
// fills each sheet to its edge when dark, numbers the sheets when asked,
// and writes them as one PDF at out. A failure leaves nothing at out, and
// the parts are removed either way.
func PagePDF(ctx context.Context, req Request, src Sources, print Printer, out string) error {
	if req.Document == nil && req.Canvas == nil {
		return ErrNothing
	}
	l := look{dark: req.Dark, paper: req.Paper, ink: req.Ink, numbers: req.Numbers}
	if err := l.check(); err != nil {
		return err
	}
	dir, conf, done, err := workspace()
	if err != nil {
		return err
	}
	defer done()
	parts, err := printPage(ctx, dir, "page", req.Document, req.Canvas, req.Setup, l, src, print, conf)
	if err != nil {
		return err
	}
	joined, _, err := assemble(ctx, parts, l, dir, print, src, conf)
	if err != nil {
		return err
	}
	if err := store.SaveFrom(out, bytes.NewReader(joined)); err != nil {
		return fmt.Errorf("export PDF: %w", err)
	}
	return nil
}

// printPage prints a page's Document and then its Canvas, each a part,
// named after name in dir.
func printPage(ctx context.Context, dir, name string, doc *Page, canvas *Canvas, setup pdfprint.PageSetup, l look, src Sources, print Printer, conf *model.Configuration) ([]part, error) {
	setup.Background = true
	var parts []part
	if doc != nil {
		page := *doc
		page.Dark = l.dark
		html, err := Printable(page, setup, src)
		if err != nil {
			return nil, err
		}
		p := part{filepath.Join(dir, name+"-document.pdf"), setup}
		if err := print(html, p.setup, p.file); err != nil {
			return nil, fmt.Errorf("print the Document: %w", err)
		}
		parts = append(parts, p)
	}
	if canvas != nil {
		s := setup
		s.Landscape = canvas.Width > canvas.Height
		p := part{filepath.Join(dir, name+"-canvas.pdf"), s}
		// A webview can print a picture larger than it is sized (macOS
		// does): a Canvas that spills onto a second sheet is printed again,
		// a little smaller each time, until it takes one.
		fit := 1.0
		for try := 0; ; try++ {
			if err := print(canvasPage(*canvas, s, l.dark, l.paper, fit), s, p.file); err != nil {
				return nil, fmt.Errorf("print the Canvas: %w", err)
			}
			n, err := sheets(ctx, p.file, conf)
			if err != nil {
				return nil, err
			}
			if n <= 1 || try == spillTries {
				break
			}
			fit *= spillShrink
		}
		parts = append(parts, p)
	}
	return parts, nil
}

// sheets is how many sheets a printed part has.
func sheets(ctx context.Context, file string, conf *model.Configuration) (int, error) {
	pdf, err := os.ReadFile(file)
	if err != nil {
		return 0, fmt.Errorf("export PDF: %w", err)
	}
	n, err := api.PageCount(ctx, bytes.NewReader(pdf), conf)
	if err != nil {
		return 0, fmt.Errorf("export PDF: read what was printed: %w", err)
	}
	return n, nil
}

// assemble fills and numbers each part's sheets as the look asks, numbers
// running on from part to part, and joins them in order. It returns the
// joined PDF and each part's sheet count.
func assemble(ctx context.Context, parts []part, l look, dir string, print Printer, src Sources, conf *model.Configuration) ([]byte, []int, error) {
	var readers []io.ReadSeeker
	counts := make([]int, len(parts))
	for i, p := range parts {
		pdf, err := os.ReadFile(p.file)
		if err != nil {
			return nil, nil, fmt.Errorf("export PDF: %w", err)
		}
		n, err := api.PageCount(ctx, bytes.NewReader(pdf), conf)
		if err != nil {
			return nil, nil, fmt.Errorf("export PDF: read what was printed: %w", err)
		}
		counts[i] = n
		if l.dark && l.paper != "" {
			fill := filepath.Join(dir, fmt.Sprintf("fill-%d.pdf", i))
			if pdf, err = underlay(ctx, pdf, fill, fillPage(l.paper), edgeToEdge(p.setup, true), print, conf); err != nil {
				return nil, nil, fmt.Errorf("export PDF: fill the margins: %w", err)
			}
		}
		readers = append(readers, bytes.NewReader(pdf))
	}
	var joined []byte
	if len(readers) == 1 {
		b, err := io.ReadAll(readers[0])
		if err != nil {
			return nil, nil, err
		}
		joined = b
	} else {
		var buf bytes.Buffer
		if err := api.MergeRaw(ctx, readers, &buf, false, conf); err != nil {
			return nil, nil, fmt.Errorf("export PDF: join the parts: %w", err)
		}
		joined = buf.Bytes()
	}
	if l.numbers {
		numbered, err := stampNumbers(ctx, joined, parts[0].setup, l.ink, conf)
		if err != nil {
			return nil, nil, fmt.Errorf("export PDF: number the pages: %w", err)
		}
		joined = numbered
	}
	return joined, counts, nil
}

// stampNumbers writes each page's number, counted through the whole PDF, at
// its bottom centre in the ink given: stamped by the PDF itself, so it is
// where it should be whatever a webview's printing does with a page.
func stampNumbers(ctx context.Context, pdf []byte, s pdfprint.PageSetup, ink string, conf *model.Configuration) ([]byte, error) {
	bottom := max(s.Margins.Bottom/2-numberHalfMM, numberLeastMM) * 72 / 25.4
	desc := fmt.Sprintf("fontname:%s, points:%d, position:bc, offset:0 %s, fillcolor:%s, scalefactor:1 abs, rotation:0", numberFont, numberPoints, num(bottom), ink)
	wm, err := api.TextWatermark(ctx, "%p", desc, true, false, types.POINTS, conf)
	if err != nil {
		return nil, err
	}
	var out bytes.Buffer
	if err := api.AddWatermarks(ctx, bytes.NewReader(pdf), &out, nil, wm, conf); err != nil {
		return nil, err
	}
	return out.Bytes(), nil
}

// edgeToEdge is a part's sheet with no margins, its background printed or
// left clear.
func edgeToEdge(s pdfprint.PageSetup, background bool) pdfprint.PageSetup {
	s.Margins = pdfprint.Margins{}
	s.Background = background
	return s
}

// underlay prints html at setup and lays its sheets under each sheet of
// pdf, the first under the first; a single sheet goes under every one.
func underlay(ctx context.Context, pdf []byte, file, html string, setup pdfprint.PageSetup, print Printer, conf *model.Configuration) ([]byte, error) {
	if err := print(html, setup, file); err != nil {
		return nil, err
	}
	over, err := os.ReadFile(file)
	if err != nil {
		return nil, err
	}
	wm, err := api.PDFMultiWatermarkForReadSeeker(ctx, bytes.NewReader(over), 1, 1, "scale:1 abs, rot:0", false, false, types.POINTS)
	if err != nil {
		return nil, err
	}
	var out bytes.Buffer
	if err := api.AddWatermarks(ctx, bytes.NewReader(pdf), &out, nil, wm, conf); err != nil {
		return nil, err
	}
	return out.Bytes(), nil
}

// fillPage is one sheet of the paper's colour, edge to edge.
func fillPage(paper string) string {
	return `<!doctype html><html class="bava-fill"><head><meta charset="utf-8">` + policy +
		`<style>html, body { margin: 0; height: 100%; background: ` + paper + `; }</style></head><body></body></html>`
}

// room is the width and height between a setup's margins, in CSS pixels.
func room(s pdfprint.PageSetup) (float64, float64) {
	w, h, _ := s.Size()
	return (w - s.Margins.Left - s.Margins.Right) * 96 / 25.4, (h - s.Margins.Top - s.Margins.Bottom) * 96 / 25.4
}

// canvasPage is the Canvas's picture alone on a sheet, scaled down to fit
// it whole and never enlarged, then by fit (1 at first).
func canvasPage(c Canvas, s pdfprint.PageSetup, dark bool, paper string, fit float64) string {
	w, h := room(s)
	scale := min(1, w/c.Width, (h-spillPx)/c.Height) * fit
	theme, background := "light", ""
	if dark {
		theme = "dark"
		if paper != "" {
			background = " background: " + paper + ";"
		}
	}
	return `<!doctype html><html data-theme="` + theme + `"><head><meta charset="utf-8">` + policy +
		`<style>html, body { margin: 0;` + background + ` } img { display: block; margin: 0 auto; ` +
		fmt.Sprintf("width: %spx; height: %spx; }", num(c.Width*scale), num(c.Height*scale)) +
		`</style></head><body><img alt="" src="data:image/svg+xml;base64,` + base64.StdEncoding.EncodeToString([]byte(c.SVG)) + `"></body></html>`
}

// Where and how page numbers sit, and how sheets are kept from spilling.
const (
	// spillPx keeps a fitted Canvas a pixel short of its sheet, so rounding
	// never spills it onto a second one.
	spillPx = 1
	// spillShrink is how much smaller a Canvas that spilled is printed
	// again, and spillTries how many times before its sheets are kept.
	spillShrink = 0.92
	spillTries  = 6
	// numberHalfMM is half a number's height: it is centred in the bottom
	// margin by its middle.
	numberHalfMM = 1.5
	// numberLeastMM is how far above the edge a number sits with no margin.
	numberLeastMM = 4
	// numberPoints is the numbers' size, as a footer's.
	numberPoints = 9
	// numberFont is one the PDF itself holds, so stamping needs no file.
	numberFont = "Helvetica"
)
