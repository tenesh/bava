package pdfprint

import (
	"path/filepath"
	"testing"
)

// A setup that cannot be printed is refused before any webview is made.
func TestAJobIsMadeOnlyFromAPrintableSetup(t *testing.T) {
	ok := PageSetup{Paper: A4, Margins: Margins{Top: 20, Right: 20, Bottom: 20, Left: 20}}
	out := filepath.Join(t.TempDir(), "x.pdf")
	j, err := newJob("<p>x</p>", ok, out)
	if err != nil || j.widthMM != 210 || j.heightMM != 297 {
		t.Fatalf("job = %+v (%v); want A4", j, err)
	}
	for name, setup := range map[string]PageSetup{
		"margins wider than the paper": {Paper: A5, Margins: Margins{Left: 80, Right: 80}},
		"a negative margin":            {Paper: A4, Margins: Margins{Top: -1}},
		"an unknown paper":             {Paper: "A9"},
	} {
		if _, err := newJob("<p>x</p>", setup, out); err == nil {
			t.Errorf("%s: accepted", name)
		}
	}
	if _, err := newJob("<p>x</p>", ok, "relative.pdf"); err == nil {
		t.Error("a relative output path was accepted")
	}
}
