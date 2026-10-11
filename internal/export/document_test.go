package export

import (
	"errors"
	"math"
	"strings"
	"testing"
	"testing/fstest"

	"github.com/tharabyte/bava/internal/pdfprint"
)

var a4 = pdfprint.PageSetup{Paper: pdfprint.A4, Margins: pdfprint.Margins{Top: 20, Right: 20, Bottom: 20, Left: 20}}

// sources holds one font, and one picture in one opened folder.
func sources() Sources {
	return Sources{
		Fonts: fstest.MapFS{"fonts/Geist-Variable.woff2": {Data: []byte("WOFF")}},
		Picture: func(root, path string) ([]byte, string, error) {
			if root == "/Users/you/Acme" && path == ".bava/attachments/logo.png" {
				return []byte("PNG"), "image/png", nil
			}
			return nil, "", errors.New("not opened")
		},
	}
}

func printable(t *testing.T, p Page) string {
	t.Helper()
	doc, err := Printable(p, a4, sources())
	if err != nil {
		t.Fatal(err)
	}
	return doc
}

func TestAPictureInAnOpenedFolderIsPutInside(t *testing.T) {
	doc := printable(t, Page{HTML: `<p><img src="/bava-file/?root=%2FUsers%2Fyou%2FAcme&amp;path=.bava%2Fattachments%2Flogo.png" alt="logo"></p>`})
	if !strings.Contains(doc, `src="data:image/png;base64,UE5H"`) {
		t.Errorf("the picture was not put inside:\n%s", doc)
	}
}

func TestAPictureNotToBeReadIsLeftOut(t *testing.T) {
	for name, src := range map[string]string{
		"another folder": "/bava-file/?root=%2Ftmp&amp;path=x.png",
		"missing":        "/bava-file/?root=%2FUsers%2Fyou%2FAcme&amp;path=gone.png",
		"out of it":      "/bava-file/?root=%2FUsers%2Fyou%2FAcme&amp;path=..%2Fsecret.png",
		"the web":        "https://example.com/x.png",
		"the app":        "/fonts/x.png",
	} {
		doc := printable(t, Page{HTML: `<img src="` + src + `" alt="x"><video poster="` + src + `"></video>`})
		if strings.Contains(doc, "src=") || strings.Contains(doc, "poster=") {
			t.Errorf("%s: kept an address:\n%s", name, doc)
		}
	}
}

// Whatever was missed, the printing webview may load nothing but what is
// inside the file.
func TestThePrintedFileMayReachNothing(t *testing.T) {
	doc := printable(t, Page{HTML: "<p>x</p>"})
	if !strings.Contains(doc, `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'">`) {
		t.Errorf("no policy:\n%s", doc)
	}
}

func TestTheFontsArePutInsideAndOtherAddressesRemoved(t *testing.T) {
	doc := printable(t, Page{CSS: `@font-face { font-family: Geist; src: url("/fonts/Geist-Variable.woff2") format("woff2"); }
.a { background: url(https://example.com/x.png); } .b { background: url('/fonts/missing.woff2'); }`})
	if !strings.Contains(doc, `url("data:font/woff2;base64,V09GRg==")`) {
		t.Errorf("the font was not put inside:\n%s", doc)
	}
	if strings.Contains(doc, "example.com") || strings.Contains(doc, "missing.woff2") {
		t.Errorf("an address was kept:\n%s", doc)
	}
}

// A page fits the paper's width: A4 at Normal margins is 170 mm between
// them, 642.5 CSS pixels.
func TestAPageIsZoomedToFillTheWidthBetweenTheMargins(t *testing.T) {
	if z := fitZoom(a4, 720); math.Abs(z-642.52/720) > 0.001 {
		t.Errorf("zoom = %v; want %v", z, 642.52/720)
	}
	if z := fitZoom(a4, 0); z != 1 {
		t.Errorf("a full-width page's zoom = %v; want 1", z)
	}
	doc := printable(t, Page{HTML: "<p>x</p>", WidthPx: 720})
	if !strings.Contains(doc, "zoom: 0.8924") || !strings.Contains(doc, "width: 720px") {
		t.Errorf("no zoom or width:\n%s", doc)
	}
}

func TestTheThemeIsSetOnTheRoot(t *testing.T) {
	if doc := printable(t, Page{Dark: true}); !strings.Contains(doc, `<html data-theme="dark">`) {
		t.Errorf("not dark:\n%s", doc)
	}
	if doc := printable(t, Page{}); !strings.Contains(doc, `<html data-theme="light">`) {
		t.Errorf("not light:\n%s", doc)
	}
}

// What the page says is printed as it is, never read as markup.
func TestThePageTextIsKept(t *testing.T) {
	doc := printable(t, Page{HTML: `<h1>Launch &amp; plan</h1><p>a &lt;b&gt; c</p>`})
	if !strings.Contains(doc, `<h1>Launch &amp; plan</h1><p>a &lt;b&gt; c</p>`) {
		t.Errorf("text changed:\n%s", doc)
	}
}

// A style cannot end the style element it is put in.
func TestStylesCannotCloseTheirElement(t *testing.T) {
	doc := printable(t, Page{CSS: `.a::after { content: "</style><script>x</script>"; }`})
	if strings.Contains(doc, "</style><script>") {
		t.Errorf("a style closed its element:\n%s", doc)
	}
}

func TestScriptsAndHandlersAreDropped(t *testing.T) {
	doc := printable(t, Page{HTML: `<p onclick="x()">a</p><script>alert(1)</script><p>b</p>`})
	if strings.Contains(doc, "onclick") || strings.Contains(doc, "alert") || !strings.Contains(doc, "<p>a</p><p>b</p>") {
		t.Errorf("got:\n%s", doc)
	}
}

// Nothing else that names an address is kept to be fetched: no link
// elements, no addresses outside a link, no names looked up ahead.
func TestNothingElseCanReachOut(t *testing.T) {
	doc := printable(t, Page{HTML: `<link rel="prefetch" href="https://example.com/x"><svg><use href="https://example.com/s.svg#a"></use><image xlink:href="https://example.com/i.png"></image></svg><a href="https://example.com/">site</a>`})
	if strings.Contains(doc, "<link") || strings.Contains(doc, "s.svg") || strings.Contains(doc, "i.png") {
		t.Errorf("an address was kept:\n%s", doc)
	}
	if !strings.Contains(doc, `<a href="https://example.com/">site</a>`) {
		t.Errorf("a link lost its address:\n%s", doc)
	}
	if !strings.Contains(doc, `<meta http-equiv="x-dns-prefetch-control" content="off">`) {
		t.Errorf("names may be looked up ahead:\n%s", doc)
	}
}
