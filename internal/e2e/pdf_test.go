package e2e

import (
	"testing"

	"github.com/tenesh/bava/internal/pdfprint"
)

func TestAPDFStepNeedsAFileASetupAndWhatItMustHold(t *testing.T) {
	ok := Step{Do: "pdf", Target: "a4.pdf", Name: "A4/portrait/normal", Text: "pages=2 size=210x297"}
	if err := check(ok); err != nil {
		t.Errorf("a whole pdf step was refused: %v", err)
	}
	for _, s := range []Step{
		{Do: "pdf", Name: "A4/portrait/normal", Text: "pages=2 size=210x297"},
		{Do: "pdf", Target: "a.pdf", Text: "pages=2 size=210x297"},
		{Do: "pdf", Target: "a.pdf", Name: "A4/portrait/normal"},
	} {
		if err := check(s); err == nil {
			t.Errorf("%+v was accepted", s)
		}
	}
}

func TestASetupIsReadFromItsName(t *testing.T) {
	setup, err := parseSetup("Letter/landscape/none")
	if err != nil {
		t.Fatal(err)
	}
	if setup.Paper != pdfprint.Letter || !setup.Landscape || setup.Margins != (pdfprint.Margins{}) || !setup.Background {
		t.Errorf("setup = %+v; want Letter, landscape, no margins, backgrounds printed", setup)
	}
	for _, bad := range []string{"A4", "A9/portrait/normal", "A4/sideways/normal", "A4/portrait/huge"} {
		if _, err := parseSetup(bad); err == nil {
			t.Errorf("%q was accepted", bad)
		}
	}
}

func TestWhatAPDFMustHoldIsCheckedToTheMillimetre(t *testing.T) {
	want, err := parseExpect("pages=2 size=210x297")
	if err != nil {
		t.Fatal(err)
	}
	a4 := pdfprint.Info{Pages: 2, Sizes: []pdfprint.PageSize{{WidthMM: 210, HeightMM: 297}, {WidthMM: 209.9, HeightMM: 297.1}}}
	if err := want.met(a4); err != nil {
		t.Errorf("an A4 PDF failed: %v", err)
	}
	if err := want.met(pdfprint.Info{Pages: 1, Sizes: a4.Sizes[:1]}); err == nil {
		t.Error("one page passed for two")
	}
	if err := want.met(pdfprint.Info{Pages: 2, Sizes: []pdfprint.PageSize{{WidthMM: 216, HeightMM: 279}, {WidthMM: 216, HeightMM: 279}}}); err == nil {
		t.Error("Letter pages passed for A4")
	}
	if _, err := parseExpect("pages=two"); err == nil {
		t.Error("an unreadable expectation was accepted")
	}
}
