package export

import (
	"bytes"
	"context"
	"fmt"
	"regexp"
	"strconv"

	"github.com/pdfcpu/pdfcpu/pkg/api"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/types"
)

// whiteFill is white set as the fill colour, then a rectangle filled with
// it: "1 1 1 sc 0 0 595 842 re f", in RGB, a colour space or grey.
var whiteFill = regexp.MustCompile(`(?:^|\s)(1(?:\.0+)?\s+1(?:\.0+)?\s+1(?:\.0+)?\s+(?:sc|scn|rg)|1(?:\.0+)?\s+g)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+re\s+f\*?\b`)

// sheetShare is how much of a sheet a fill must cover to be the sheet's
// own background, not something drawn on it.
const sheetShare = 0.99

// whiteSheets finds, in a sheet's drawing, each white fill as big as the
// sheet (width by height, in points): where the rectangle starts and ends,
// past its colour.
func whiteSheets(content []byte, width, height float64) [][2]int {
	var found [][2]int
	for _, m := range whiteFill.FindAllSubmatchIndex(content, -1) {
		w, errW := strconv.ParseFloat(string(content[m[8]:m[9]]), 64)
		h, errH := strconv.ParseFloat(string(content[m[10]:m[11]]), 64)
		if errW != nil || errH != nil || w < width*sheetShare || h < height*sheetShare {
			continue
		}
		// From after the colour to the end of the fill: the colour stays,
		// so what follows draws in the colour it expects.
		found = append(found, [2]int{m[3], m[1]})
	}
	return found
}

// layerMatrix opens every sheet pdfcpu lays over or under a page: what
// follows it is a sheet printed apart, not the page's own drawing.
var layerMatrix = []byte("1.00000 0.00000 0.00000 1.00000 0.00000 0.00000 cm")

// CoveringSheets counts the sheets laid over or under a PDF's pages (a
// dark fill, the page numbers) that hold a white fill as big as the page:
// one laid over a page hides it. A PDF Bava wrote has none.
func CoveringSheets(c context.Context, pdf []byte) (int, error) {
	conf, err := api.LoadConfiguration(api.ConfigurationOptions{Mode: api.ConfigurationModeStateless})
	if err != nil {
		return 0, err
	}
	ctx, err := api.ReadContext(c, bytes.NewReader(pdf), conf)
	if err != nil {
		return 0, err
	}
	covering := 0
	for objNr, entry := range ctx.Table {
		sd, ok := entry.Object.(types.StreamDict)
		if !ok || sd.Subtype() == nil || *sd.Subtype() != "Form" {
			continue
		}
		box := sd.ArrayEntry("BBox")
		if len(box) != 4 {
			continue
		}
		if err := sd.Decode(); err != nil {
			return 0, fmt.Errorf("object %d: %w", objNr, err)
		}
		if !bytes.HasPrefix(bytes.TrimSpace(sd.Content), layerMatrix) {
			continue
		}
		w, h := number(box[2])-number(box[0]), number(box[3])-number(box[1])
		if len(whiteSheets(sd.Content, w, h)) > 0 {
			covering++
		}
	}
	return covering, nil
}

func number(o types.Object) float64 {
	switch v := o.(type) {
	case types.Integer:
		return float64(v)
	case types.Float:
		return float64(v)
	}
	return 0
}

// stampNumber is a page number as the PDF stamps it: "(12) Tj".
var stampNumber = regexp.MustCompile(`\((\d+)\)\s*Tj`)

// PageNumbers is the number stamped on each page of a PDF, in order, 0 for
// a page with none.
func PageNumbers(c context.Context, pdf []byte) ([]int, error) {
	conf, err := api.LoadConfiguration(api.ConfigurationOptions{Mode: api.ConfigurationModeStateless})
	if err != nil {
		return nil, err
	}
	ctx, err := api.ReadContext(c, bytes.NewReader(pdf), conf)
	if err != nil {
		return nil, err
	}
	if err := ctx.EnsurePageCount(); err != nil {
		return nil, err
	}
	numbers := make([]int, ctx.PageCount)
	for i := range ctx.PageCount {
		_, _, inherited, err := ctx.PageDict(c, i+1, false)
		if err != nil {
			return nil, err
		}
		if inherited == nil {
			continue
		}
		forms, found := inherited.Resources.Find("XObject")
		if !found {
			continue
		}
		dict, err := ctx.DereferenceDict(forms)
		if err != nil || dict == nil {
			continue
		}
		for _, o := range dict {
			sd, _, err := ctx.DereferenceStreamDict(o)
			if err != nil || sd == nil || sd.Decode() != nil {
				continue
			}
			// A stamp is in the PDF's stamp layer (its /OC), never the page's own drawing.
			if _, stamped := sd.Find("OC"); !stamped {
				continue
			}
			if m := stampNumber.FindSubmatch(sd.Content); m != nil {
				numbers[i], _ = strconv.Atoi(string(m[1]))
			}
		}
	}
	return numbers, nil
}
