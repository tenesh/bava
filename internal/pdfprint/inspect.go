package pdfprint

import (
	"bytes"
	"errors"
	"fmt"
	"math"
	"os"
	"regexp"
	"strconv"
)

// PageSize is a printed page's size in millimetres, to a tenth.
type PageSize struct {
	WidthMM  float64 `json:"widthMM"`
	HeightMM float64 `json:"heightMM"`
}

// Info is what a printed PDF holds: how many pages, and each one's size.
type Info struct {
	Pages int        `json:"pages"`
	Sizes []PageSize `json:"sizes"`
}

var (
	object     = regexp.MustCompile(`(?s)\d+\s+\d+\s+obj\b(.*?)\bendobj`)
	pageType   = regexp.MustCompile(`/Type\s*/Page\b`)
	pagesType  = regexp.MustCompile(`/Type\s*/Pages\b`)
	pagesCount = regexp.MustCompile(`/Count\s+(\d+)`)
	mediaBox   = regexp.MustCompile(`/MediaBox\s*\[\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*\]`)
	rotate     = regexp.MustCompile(`/Rotate\s+(-?\d+)`)
)

// Inspect reads back a PDF the printing wrote: its page count (from the
// page tree's count, or its page objects) and each page's size as it shows,
// from its own MediaBox and Rotate or those it inherits from the page tree.
// It reads what the systems' printing writes; pages packed into compressed
// object streams are counted but take the page tree's size.
func Inspect(path string) (Info, error) {
	info, err := inspect(path)
	if err != nil {
		return Info{}, fmt.Errorf("%s: %w", path, err)
	}
	return info, nil
}

type page struct {
	box    []float64
	rotate int
}

func inspect(path string) (Info, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return Info{}, err
	}
	if !bytes.HasPrefix(data, []byte("%PDF-")) {
		return Info{}, errors.New("not a PDF")
	}
	var tree page
	var pages []page
	count := 0
	for _, m := range object.FindAllSubmatch(data, -1) {
		body := m[1]
		switch {
		case pagesType.Match(body):
			if c := pagesCount.FindSubmatch(body); c != nil {
				n, _ := strconv.Atoi(string(c[1]))
				count = max(count, n)
			}
			if tree.box == nil {
				tree.box = boxOf(body)
			}
			if r, ok := rotationOf(body); ok {
				tree.rotate = r
			}
		case pageType.Match(body):
			p := page{box: boxOf(body), rotate: -1}
			if r, ok := rotationOf(body); ok {
				p.rotate = r
			}
			pages = append(pages, p)
		}
	}
	n := max(count, len(pages))
	if n == 0 {
		return Info{}, errors.New("a PDF with no pages")
	}
	sizes := make([]PageSize, n)
	for i := range sizes {
		p := page{rotate: -1}
		if i < len(pages) {
			p = pages[i]
		}
		if p.box == nil {
			p.box = tree.box
		}
		if p.rotate < 0 {
			p.rotate = tree.rotate
		}
		if p.box == nil {
			return Info{}, fmt.Errorf("page %d has no size", i+1)
		}
		width, height := toMM(p.box[2]-p.box[0]), toMM(p.box[3]-p.box[1])
		if r := ((p.rotate % 360) + 360) % 360; r == 90 || r == 270 {
			width, height = height, width
		}
		sizes[i] = PageSize{WidthMM: width, HeightMM: height}
	}
	return Info{Pages: n, Sizes: sizes}, nil
}

// boxOf is an object's own MediaBox, or nil.
func boxOf(body []byte) []float64 {
	m := mediaBox.FindSubmatch(body)
	if m == nil {
		return nil
	}
	box := make([]float64, 4)
	for i := range box {
		box[i], _ = strconv.ParseFloat(string(m[i+1]), 64)
	}
	return box
}

// rotationOf is an object's own Rotate, if it has one.
func rotationOf(body []byte) (int, bool) {
	m := rotate.FindSubmatch(body)
	if m == nil {
		return 0, false
	}
	r, _ := strconv.Atoi(string(m[1]))
	return r, true
}

// toMM is points (1/72 inch) in millimetres, to a tenth.
func toMM(points float64) float64 {
	return math.Round(points*25.4/72*10) / 10
}
