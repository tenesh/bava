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
	"strings"

	"github.com/pdfcpu/pdfcpu/pkg/api"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/model"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/types"

	"github.com/tenesh/bava/internal/pdfprint"
	"github.com/tenesh/bava/internal/store"
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

// PagePDF prints a page's Document, then its Canvas on a sheet of its own,
// fills each sheet to its edge when dark, numbers the sheets when asked,
// and writes them as one PDF at out. A failure leaves nothing at out, and
// the parts are removed either way.
func PagePDF(ctx context.Context, req Request, src Sources, print Printer, out string) error {
	if req.Document == nil && req.Canvas == nil {
		return ErrNothing
	}
	if req.Numbers && req.Ink == "" {
		return errors.New("page numbers need a colour")
	}
	for _, c := range []string{req.Paper, req.Ink} {
		if c != "" && !colour.MatchString(c) {
			return fmt.Errorf("%q is not a colour", c)
		}
	}
	dir, err := os.MkdirTemp("", "bava-pdf-*")
	if err != nil {
		return fmt.Errorf("export PDF: %w", err)
	}
	defer os.RemoveAll(dir)
	conf, err := api.LoadConfiguration(api.ConfigurationOptions{Mode: api.ConfigurationModeStateless})
	if err != nil {
		return fmt.Errorf("export PDF: %w", err)
	}

	setup := req.Setup
	setup.Background = true
	var parts []part
	if req.Document != nil {
		page := *req.Document
		page.Dark = req.Dark
		html, err := Printable(page, setup, src)
		if err != nil {
			return err
		}
		p := part{filepath.Join(dir, "document.pdf"), setup}
		if err := print(html, p.setup, p.file); err != nil {
			return fmt.Errorf("print the Document: %w", err)
		}
		parts = append(parts, p)
	}
	if req.Canvas != nil {
		s := setup
		s.Landscape = req.Canvas.Width > req.Canvas.Height
		p := part{filepath.Join(dir, "canvas.pdf"), s}
		if err := print(canvasPage(*req.Canvas, s, req.Dark, req.Paper), s, p.file); err != nil {
			return fmt.Errorf("print the Canvas: %w", err)
		}
		parts = append(parts, p)
	}

	var readers []io.ReadSeeker
	next := 1
	for i, p := range parts {
		pdf, err := os.ReadFile(p.file)
		if err != nil {
			return fmt.Errorf("export PDF: %w", err)
		}
		n, err := api.PageCount(ctx, bytes.NewReader(pdf), conf)
		if err != nil {
			return fmt.Errorf("export PDF: read what was printed: %w", err)
		}
		if req.Dark && req.Paper != "" {
			fill := filepath.Join(dir, fmt.Sprintf("fill-%d.pdf", i))
			if pdf, err = layer(ctx, pdf, fill, fillPage(req.Paper), edgeToEdge(p.setup, true), print, false, conf); err != nil {
				return fmt.Errorf("export PDF: fill the margins: %w", err)
			}
		}
		if req.Numbers {
			numbers := filepath.Join(dir, fmt.Sprintf("numbers-%d.pdf", i))
			html := numbersPage(next, n, p.setup, req.Ink, src)
			if pdf, err = layer(ctx, pdf, numbers, html, edgeToEdge(p.setup, false), print, true, conf); err != nil {
				return fmt.Errorf("export PDF: number the pages: %w", err)
			}
		}
		next += n
		readers = append(readers, bytes.NewReader(pdf))
	}

	var joined bytes.Buffer
	if len(readers) == 1 {
		if _, err := io.Copy(&joined, readers[0]); err != nil {
			return err
		}
	} else if err := api.MergeRaw(ctx, readers, &joined, false, conf); err != nil {
		return fmt.Errorf("export PDF: join the parts: %w", err)
	}
	if err := store.SaveFrom(out, &joined); err != nil {
		return fmt.Errorf("export PDF: %w", err)
	}
	return nil
}

// edgeToEdge is a part's sheet with no margins, its background printed or
// left clear.
func edgeToEdge(s pdfprint.PageSetup, background bool) pdfprint.PageSetup {
	s.Margins = pdfprint.Margins{}
	s.Background = background
	return s
}

// layer prints html at setup and lays its sheets over (onTop) or under
// each sheet of pdf, the first over the first; a single sheet goes on
// every one.
func layer(ctx context.Context, pdf []byte, file, html string, setup pdfprint.PageSetup, print Printer, onTop bool, conf *model.Configuration) ([]byte, error) {
	if err := print(html, setup, file); err != nil {
		return nil, err
	}
	over, err := os.ReadFile(file)
	if err != nil {
		return nil, err
	}
	wm, err := api.PDFMultiWatermarkForReadSeeker(ctx, bytes.NewReader(over), 1, 1, "scale:1 abs, rot:0", onTop, false, types.POINTS)
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
// it whole and never enlarged.
func canvasPage(c Canvas, s pdfprint.PageSetup, dark bool, paper string) string {
	w, h := room(s)
	scale := min(1, w/c.Width, (h-spillPx)/c.Height)
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
	// sheetShortMM keeps each numbers sheet half a millimetre short of the
	// paper, for the same reason.
	sheetShortMM = 0.5
	// numberHalfMM is half a number's height: it is centred in the bottom
	// margin by its middle.
	numberHalfMM = 1.5
	// numberLeastMM is how far above the edge a number sits with no margin.
	numberLeastMM = 4
	// numberSize is the numbers' size, as a footer's.
	numberSize = "9pt"
)

// numbersPage is a sheet for each page from first, n of them, each with
// its number at the bottom centre in Bava's font and the ink given, on
// nothing.
func numbersPage(first, n int, s pdfprint.PageSetup, ink string, src Sources) string {
	_, h, _ := s.Size()
	bottom := max(s.Margins.Bottom/2-numberHalfMM, numberLeastMM)
	var sheets strings.Builder
	for i := range n {
		fmt.Fprintf(&sheets, `<div class="sheet"><span class="n">%d</span></div>`, first+i)
	}
	css := inlineCSS(`@font-face { font-family: "Bava Numbers"; src: url("/fonts/Geist-Variable.woff2") format("woff2"); }`, src)
	return `<!doctype html><html><head><meta charset="utf-8">` + policy + `<style>` + css +
		` html, body { margin: 0; background: transparent; }` +
		fmt.Sprintf(` .sheet { position: relative; height: %smm; overflow: hidden; break-after: page; }`, num(h-sheetShortMM)) +
		` .sheet:last-child { break-after: auto; }` +
		fmt.Sprintf(` .n { position: absolute; left: 0; right: 0; bottom: %smm; text-align: center; font: %s "Bava Numbers", sans-serif; color: %s; }`, num(bottom), numberSize, ink) +
		`</style></head><body>` + sheets.String() + `</body></html>`
}
