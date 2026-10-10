// Package pdfprint has each system's webview print an HTML page to a PDF
// file, at a chosen paper size, orientation and margins. It knows nothing
// of pages or Spaces: it takes HTML and a page setup and writes a file.
// Nothing leaves the machine.
package pdfprint

import (
	"errors"
	"fmt"
	"strings"
)

// Paper is a named paper size, or Custom.
type Paper string

// The papers offered: the sizes most apps offer, and Custom for any other.
const (
	A3      Paper = "A3"
	A4      Paper = "A4"
	A5      Paper = "A5"
	B4      Paper = "B4"
	B5      Paper = "B5"
	Letter  Paper = "Letter"
	Legal   Paper = "Legal"
	Tabloid Paper = "Tabloid"
	Custom  Paper = "Custom"
)

// papers is each named paper's width and height in millimetres, portrait.
var papers = map[Paper][2]float64{
	A3: {297, 420}, A4: {210, 297}, A5: {148, 210},
	B4: {250, 353}, B5: {176, 250},
	Letter: {215.9, 279.4}, Legal: {215.9, 355.6}, Tabloid: {279.4, 431.8},
}

// Margins are a page's four margins in millimetres.
type Margins struct {
	Top    float64 `json:"top"`
	Right  float64 `json:"right"`
	Bottom float64 `json:"bottom"`
	Left   float64 `json:"left"`
}

// MarginName is one of the named margins.
type MarginName string

// The named margins, each the same all round.
const (
	MarginNone   MarginName = "none"
	MarginNarrow MarginName = "narrow"
	MarginNormal MarginName = "normal"
	MarginWide   MarginName = "wide"
)

var margins = map[MarginName]float64{MarginNone: 0, MarginNarrow: 12, MarginNormal: 20, MarginWide: 30}

// NamedMargins is a named margin's four sides.
func NamedMargins(name MarginName) (Margins, error) {
	mm, ok := margins[name]
	if !ok {
		return Margins{}, fmt.Errorf("unknown margins %q", name)
	}
	return Margins{Top: mm, Right: mm, Bottom: mm, Left: mm}, nil
}

// PageSetup is how a page is printed.
type PageSetup struct {
	Paper Paper `json:"paper"`
	// WidthMM and HeightMM are a Custom paper's size, portrait.
	WidthMM   float64 `json:"widthMM"`
	HeightMM  float64 `json:"heightMM"`
	Landscape bool    `json:"landscape"`
	Margins   Margins `json:"margins"`
	// Background prints the page's colours and pictures behind its text.
	Background bool `json:"background"`
}

// Size is the page's width and height in millimetres, turned for landscape.
func (p PageSetup) Size() (width, height float64, err error) {
	if p.Paper == Custom {
		if p.WidthMM <= 0 || p.HeightMM <= 0 {
			return 0, 0, errors.New("a custom paper needs a width and a height")
		}
		width, height = p.WidthMM, p.HeightMM
	} else {
		size, ok := papers[p.Paper]
		if !ok {
			return 0, 0, fmt.Errorf("unknown paper %q", p.Paper)
		}
		width, height = size[0], size[1]
	}
	if p.Landscape {
		width, height = height, width
	}
	return width, height, nil
}

// DefaultPaper is the paper first offered in a region (an ISO country code):
// Letter in the US and Canada, A4 everywhere else.
func DefaultPaper(region string) Paper {
	switch strings.ToUpper(region) {
	case "US", "CA":
		return Letter
	}
	return A4
}
