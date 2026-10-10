package pdfprint_test

import (
	"testing"

	"github.com/tenesh/bava/internal/pdfprint"
)

func TestNamedPapersHaveTheirSizes(t *testing.T) {
	cases := map[pdfprint.Paper][2]float64{
		pdfprint.A3: {297, 420}, pdfprint.A4: {210, 297}, pdfprint.A5: {148, 210},
		pdfprint.B4: {250, 353}, pdfprint.B5: {176, 250},
		pdfprint.Letter: {215.9, 279.4}, pdfprint.Legal: {215.9, 355.6}, pdfprint.Tabloid: {279.4, 431.8},
	}
	for paper, want := range cases {
		w, h, err := pdfprint.PageSetup{Paper: paper}.Size()
		if err != nil || w != want[0] || h != want[1] {
			t.Errorf("%s = %v × %v (%v); want %v × %v", paper, w, h, err, want[0], want[1])
		}
	}
}

func TestLandscapeSwapsTheSides(t *testing.T) {
	w, h, _ := pdfprint.PageSetup{Paper: pdfprint.A4, Landscape: true}.Size()
	if w != 297 || h != 210 {
		t.Errorf("A4 landscape = %v × %v; want 297 × 210", w, h)
	}
}

func TestCustomPaperKeepsItsSize(t *testing.T) {
	w, h, err := pdfprint.PageSetup{Paper: pdfprint.Custom, WidthMM: 841, HeightMM: 1189}.Size()
	if err != nil || w != 841 || h != 1189 {
		t.Errorf("custom = %v × %v (%v); want A0's 841 × 1189", w, h, err)
	}
	if _, _, err := (pdfprint.PageSetup{Paper: pdfprint.Custom}).Size(); err == nil {
		t.Error("a custom paper with no size was accepted")
	}
	if _, _, err := (pdfprint.PageSetup{Paper: "A9"}).Size(); err == nil {
		t.Error("an unknown paper was accepted")
	}
}

func TestTheDefaultPaperFollowsTheRegion(t *testing.T) {
	for region, want := range map[string]pdfprint.Paper{"US": pdfprint.Letter, "CA": pdfprint.Letter, "GB": pdfprint.A4, "MY": pdfprint.A4, "": pdfprint.A4} {
		if got := pdfprint.DefaultPaper(region); got != want {
			t.Errorf("DefaultPaper(%q) = %s; want %s", region, got, want)
		}
	}
}

func TestNamedMarginsAreAllRound(t *testing.T) {
	for name, mm := range map[pdfprint.MarginName]float64{pdfprint.MarginNone: 0, pdfprint.MarginNarrow: 12, pdfprint.MarginNormal: 20, pdfprint.MarginWide: 30} {
		m, err := pdfprint.NamedMargins(name)
		if err != nil || m != (pdfprint.Margins{Top: mm, Right: mm, Bottom: mm, Left: mm}) {
			t.Errorf("%s = %+v (%v); want %v all round", name, m, err, mm)
		}
	}
	if _, err := pdfprint.NamedMargins("huge"); err == nil {
		t.Error("an unknown margin was accepted")
	}
}
