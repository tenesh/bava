package icons_test

import (
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/tharabyte/bava/internal/icons"
)

// A custom icon is drawn by the page: whatever could run, fetch or reach out
// of the file is taken out, and the drawing is kept.
func TestSanitiseTakesOutWhatCouldRunOrFetch(t *testing.T) {
	cases := []struct {
		name, in, gone string
	}{
		{"a script", `<svg viewBox="0 0 10 10"><script>alert(1)</script><rect width="10" height="10"/></svg>`, "script"},
		{"a handler", `<svg viewBox="0 0 10 10"><rect onclick="alert(1)" width="10" height="10"/></svg>`, "onclick"},
		{"foreign content", `<svg viewBox="0 0 10 10"><foreignObject><div>hi</div></foreignObject></svg>`, "foreignObject"},
		{"a remote picture", `<svg viewBox="0 0 10 10"><image href="https://example.com/a.png" width="10" height="10"/></svg>`, "example.com"},
		{"a remote use", `<svg viewBox="0 0 10 10" xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="https://example.com/s.svg#a"/></svg>`, "example.com"},
		{"a remote style", `<svg viewBox="0 0 10 10"><rect style="fill:url(https://example.com/x)" width="10" height="10"/></svg>`, "example.com"},
		{"an import", `<svg viewBox="0 0 10 10"><style>@import url(https://example.com/a.css); rect{fill:red}</style></svg>`, "example.com"},
		{"a link", `<svg viewBox="0 0 10 10"><a href="https://example.com"><rect width="10" height="10"/></a></svg>`, "example.com"},
		{"another app's markup", `<svg viewBox="0 0 10 10" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"><g inkscape:label="Layer"><rect width="10" height="10"/></g></svg>`, "inkscape"},
		{"a processing instruction", `<?xml-stylesheet href="https://example.com/a.css"?><svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg>`, "example.com"},
		{"an import split by a comment", `<svg viewBox="0 0 10 10"><style>@imp<!-- -->ort "https://example.com/x.css";</style><rect width="10" height="10"/></svg>`, "example.com"},
		{"a url split by CDATA", `<svg viewBox="0 0 10 10"><style>rect{fill:u<![CDATA[rl(https://example.com/a.png)]]>}</style><rect width="10" height="10"/></svg>`, "example.com"},
		{"an import in capitals", `<svg viewBox="0 0 10 10"><style>@IMPORT "https://example.com/x.css";</style></svg>`, "example.com"},
		{"a url in capitals", `<svg viewBox="0 0 10 10"><rect fill="URL(https://example.com/a)" width="10" height="10"/></svg>`, "example.com"},
		{"an escaped url", `<svg viewBox="0 0 10 10"><rect style="cursor:\75rl(https://example.com/a),auto" width="10" height="10"/></svg>`, "example.com"},
		{"an image set", `<svg viewBox="0 0 10 10"><rect style="fill:image-set(&quot;https://example.com/a.png&quot; 1x)" width="10" height="10"/></svg>`, "example.com"},
		{"a handler in capitals", `<svg viewBox="0 0 10 10" ONLOAD="alert(1)"><rect width="10" height="10"/></svg>`, "ONLOAD"},
		{"a prefixed script", `<svg viewBox="0 0 10 10" xmlns:s="http://www.w3.org/2000/svg"><s:script>alert(1)</s:script></svg>`, "alert"},
		{"an animation", `<svg viewBox="0 0 10 10"><rect width="10" height="10"><set attributeName="fill" to="url(https://example.com/a)"/></rect></svg>`, "example.com"},
		{"a style element", `<svg viewBox="0 0 10 10"><style>*{display:none}</style><rect width="10" height="10"/></svg>`, "display"},
		{"a picture inside a title", `<svg viewBox="0 0 10 10"><title><image srcset="http://example.com/x.png 1x"/></title></svg>`, "example.com"},
		{"a source set anywhere", `<svg viewBox="0 0 10 10"><image srcset="http://example.com/x.png 1x" width="1" height="1"/></svg>`, "example.com"},
		{"an attribute no drawing uses", `<svg viewBox="0 0 10 10"><rect width="10" height="10" requiredExtensions="http://example.com/x"/></svg>`, "example.com"},
		{"an id in capitals", `<svg viewBox="0 0 10 10"><rect ID="app" width="10" height="10"/></svg>`, "app"},
		{"a picture pointing within the page", `<svg viewBox="0 0 10 10"><image href="#x" width="1" height="1"/></svg>`, "href"},
		{"a reference left open", `<svg viewBox="0 0 10 10"><rect fill="url(#a;stroke:x" width="10" height="10"/></svg>`, "url("},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			out, err := icons.Sanitise([]byte(c.in))
			if err != nil {
				t.Fatal(err)
			}
			if strings.Contains(out, c.gone) {
				t.Errorf("%s survived:\n%s", c.gone, out)
			}
		})
	}
}

func TestSanitiseKeepsTheDrawing(t *testing.T) {
	in := `<?xml version="1.0"?>
<!-- drawn elsewhere -->
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 24 24">
  <defs>
    <linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#0F766E"/><stop offset="1" stop-color="#F59E0B"/></linearGradient>
    <clipPath id="c"><circle cx="12" cy="12" r="10"/></clipPath>
  </defs>
  <g clip-path="url(#c)" opacity="0.9">
    <path d="M2 2h20v20H2z" fill="url(#g)" stroke="#111" stroke-width="2"/>
    <use xlink:href="#dot" x="4"/>
    <circle id="dot" cx="6" cy="6" r="2" style="fill: #fff"/>
    <image href="data:image/png;base64,iVBORw0KGgo=" width="4" height="4"/>
  </g>
</svg>`
	out, err := icons.Sanitise([]byte(in))
	if err != nil {
		t.Fatal(err)
	}
	for _, kept := range []string{
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">`,
		`<linearGradient id="g" x1="0" x2="1">`,
		`<stop offset="0" stop-color="#0F766E"/>`,
		`<g clip-path="url(#c)" opacity="0.9">`,
		`<path d="M2 2h20v20H2z" fill="url(#g)" stroke="#111" stroke-width="2"/>`,
		`<use href="#dot" x="4"/>`,
		`style="fill:#fff"`,
		`href="data:image/png;base64,iVBORw0KGgo="`,
	} {
		if !strings.Contains(out, kept) {
			t.Errorf("lost %s:\n%s", kept, out)
		}
	}
	if strings.Contains(out, "drawn elsewhere") || strings.Contains(out, "<?xml") {
		t.Errorf("kept a comment or declaration:\n%s", out)
	}
}

// Its size comes from its viewBox, so it draws at its own proportions: a
// width and height alone give it one, and stated ones match it.
func TestSanitiseSizesTheDrawingByItsViewBox(t *testing.T) {
	out, err := icons.Sanitise([]byte(`<svg width="48px" height="32px"><rect width="48" height="32"/></svg>`))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(out, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 32" width="48" height="32">`) {
		t.Errorf("got %s", out)
	}
	out, err = icons.Sanitise([]byte(`<svg viewBox="0 0 100 50" width="1em" height="1em"><rect width="10" height="10"/></svg>`))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(out, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50" width="100" height="50">`) {
		t.Errorf("got %s", out)
	}
}

// A drawing styled by classes, as drawing apps write it, keeps its look:
// each simple class rule moves onto the elements it styles, so no stylesheet
// is left to reach the rest of a document it is put inside.
func TestSanitiseMovesClassRulesOntoTheirElements(t *testing.T) {
	out, err := icons.Sanitise([]byte(`<svg viewBox="0 0 10 10"><defs><style>/* drawn */ .st0{fill:#0F766E;stroke:#111} .st1, .st2 {opacity:.5} rect{fill:red} @media print{.st0{fill:blue}}</style></defs><rect class="st0" style="stroke-width:2" width="10" height="10"/><circle class="st1 st0" r="2"/></svg>`))
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{
		`<rect style="fill:#0F766E;stroke:#111;stroke-width:2" width="10" height="10"/>`,
		`<circle style="opacity:.5;fill:#0F766E;stroke:#111" r="2"/>`,
	} {
		if !strings.Contains(out, want) {
			t.Errorf("want %s in\n%s", want, out)
		}
	}
	if strings.Contains(out, "<style") || strings.Contains(out, "class=") || strings.Contains(out, "red") || strings.Contains(out, "blue") {
		t.Errorf("kept a stylesheet, a class or a rule it cannot place:\n%s", out)
	}
}

// A reference within the file is written one way, which an export can rename.
func TestSanitiseWritesInternalReferencesPlainly(t *testing.T) {
	out, err := icons.Sanitise([]byte(`<svg viewBox="0 0 10 10"><rect fill="url( '#g' )" style="stroke:URL(&quot;#h&quot;)" width="10" height="10" transform="translate(1 2) rotate(3)"/></svg>`))
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{`fill="url(#g)"`, `style="stroke:url(#h)"`, `transform="translate(1 2) rotate(3)"`} {
		if !strings.Contains(out, want) {
			t.Errorf("want %s in\n%s", want, out)
		}
	}
}

// A file of a few kilobytes cannot become gigabytes: a class named again
// counts once, and the drawing may not grow far past the file.
func TestSanitiseBoundsWhatClassRulesAdd(t *testing.T) {
	var rule, names strings.Builder
	for i := 0; i < 20000; i++ {
		rule.WriteString("fill:#123456;")
		names.WriteString("a ")
	}
	huge := `<svg viewBox="0 0 10 10"><style>.a{` + rule.String() + `}</style><g class="` + names.String() + `"/><g class="a"/><g class="a"/><g class="a"/><g class="a"/><g class="a"/><g class="a"/></svg>`
	out, err := icons.Sanitise([]byte(huge))
	if err == nil && len(out) > 4*len(huge) {
		t.Errorf("grew from %d to %d bytes", len(huge), len(out))
	}
	out, err = icons.Sanitise([]byte(`<svg viewBox="0 0 10 10"><style>.a{fill:#123456}</style><rect class="a a a" width="1" height="1"/></svg>`))
	if err != nil || !strings.Contains(out, `<rect style="fill:#123456" width="1" height="1"/>`) {
		t.Errorf("got %s, %v", out, err)
	}
}

// The stylesheet itself is bounded too: one selector repeated, or many,
// never stores more than the drawing could hold.
func TestSanitiseBoundsTheStylesheet(t *testing.T) {
	var selectors, rule, names strings.Builder
	for i := 0; i < 20000; i++ {
		selectors.WriteString(".a,")
		rule.WriteString("a:b;")
	}
	repeated := `<svg viewBox="0 0 10 10"><style>` + selectors.String() + `.a{` + rule.String() + `}</style></svg>`
	start := time.Now()
	if _, err := icons.Sanitise([]byte(repeated)); err != nil && !errors.Is(err, icons.ErrNotAnIcon) {
		t.Fatal(err)
	}
	selectors.Reset()
	for i := 0; i < 20000; i++ {
		fmt.Fprintf(&selectors, ".c%d,", i)
		fmt.Fprintf(&names, "c%d ", i)
	}
	many := `<svg viewBox="0 0 10 10"><style>` + selectors.String() + `.z{` + rule.String() + `}</style><g class="` + names.String() + `"/></svg>`
	if _, err := icons.Sanitise([]byte(many)); err == nil {
		t.Error("a stylesheet far larger than its file was accepted")
	}
	// Many small stylesheets share one budget.
	var sheets strings.Builder
	var rule600 strings.Builder
	for i := 0; i < 1200; i++ {
		rule600.WriteString("a:b;")
	}
	var head strings.Builder
	names.Reset()
	for i := 0; i < 600; i++ {
		fmt.Fprintf(&head, ".c%d,", i)
		fmt.Fprintf(&names, "c%d ", i)
	}
	for sheets.Len() < 900_000 {
		sheets.WriteString(`<style>` + strings.TrimSuffix(head.String(), ",") + `{` + rule600.String() + `}</style>`)
	}
	split := `<svg viewBox="0 0 10 10">` + sheets.String() + `<g class="` + names.String() + `"/></svg>`
	if _, err := icons.Sanitise([]byte(split)); err == nil {
		t.Error("stylesheets far larger than their file were accepted")
	}
	if elapsed := time.Since(start); elapsed > 2*time.Second {
		t.Errorf("took %v", elapsed)
	}
}

// The root keeps no way to draw past its box, and a reference is written once.
func TestSanitiseKeepsTheDrawingInItsBox(t *testing.T) {
	out, err := icons.Sanitise([]byte(`<svg viewBox="0 0 10 10" overflow="visible" transform="scale(9)" fill="#111" style="overflow-x:visible;translate:-5px 0;scale:9;rotate:4deg"><use xlink:href="#a" href="#b" xmlns:xlink="http://www.w3.org/1999/xlink"/><rect id="a" width="1" height="1" stroke-dasharray="1&#13;2"/></svg>`))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(out, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" width="10" height="10" fill="#111">`) {
		t.Errorf("the root kept a way past its box: %s", out)
	}
	if strings.Count(out, "href=") != 1 || strings.Contains(out, "\r") {
		t.Errorf("got %q", out)
	}
}

// An icon is drawn by the webview: a drawing nested past any sense is refused.
func TestSanitiseRefusesADrawingNestedTooDeep(t *testing.T) {
	deep := strings.Repeat("<g>", icons.MaxDepth+1) + strings.Repeat("</g>", icons.MaxDepth+1)
	if _, err := icons.Sanitise([]byte(`<svg viewBox="0 0 10 10">` + deep + `</svg>`)); err == nil {
		t.Error("accepted a drawing nested too deep")
	}
	fine := strings.Repeat("<g>", 20) + `<rect width="1" height="1"/>` + strings.Repeat("</g>", 20)
	if _, err := icons.Sanitise([]byte(`<svg viewBox="0 0 10 10">` + fine + `</svg>`)); err != nil {
		t.Errorf("refused a drawing nested a little: %v", err)
	}
}

// One drawing: a second root would land outside the icon's box when it is nested.
func TestSanitiseRefusesASecondRoot(t *testing.T) {
	if _, err := icons.Sanitise([]byte(`<svg viewBox="0 0 10 10"><rect width="10" height="10"/></svg><svg viewBox="0 0 999 999"><rect width="999" height="999"/></svg>`)); err == nil {
		t.Error("accepted two drawings in one file")
	}
}

// A > in a value is escaped, so nothing reading the tag ends it early.
func TestSanitiseEscapesAngleBracketsInValues(t *testing.T) {
	out, err := icons.Sanitise([]byte(`<svg viewBox="0 0 10 10"><text font-family="a/&gt;b">x</text></svg>`))
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(out, "a/>b") || !strings.Contains(out, "a/&gt;b") {
		t.Errorf("got %s", out)
	}
}

func TestSanitiseRefusesWhatIsNotAnSVG(t *testing.T) {
	for _, in := range []string{
		``,
		`not xml at all`,
		`<html><body/></html>`,
		`<svg viewBox="0 0 10 10"><rect`,
		`<svg><rect width="10" height="10"/></svg>`,
	} {
		if _, err := icons.Sanitise([]byte(in)); err == nil {
			t.Errorf("accepted %q", in)
		}
	}
}
