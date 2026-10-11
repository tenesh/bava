// Package export makes PDFs of a Space's pages: each page made into one
// self-contained file the system's webview prints, and the printed parts
// joined, numbered and filled after printing. Nothing leaves the machine.
package export

import (
	"encoding/base64"
	"fmt"
	"io"
	"io/fs"
	"math"
	"mime"
	"net/url"
	"path"
	"regexp"
	"strconv"
	"strings"

	"golang.org/x/net/html"

	"github.com/tenesh/bava/internal/pdfprint"
)

// Page is what is printed of a page: the HTML its editor shows, the styles
// it is shown with, and its width in Bava.
type Page struct {
	HTML string `json:"html"`
	CSS  string `json:"css"`
	// WidthPx is the page's width in CSS pixels; 0 for a full-width page,
	// which takes the paper's width as it is.
	WidthPx float64 `json:"widthPx"`
	// Dark is set from the request the page is printed for.
	Dark bool `json:"-"`
}

// Sources are where a page's fonts and pictures are read from.
type Sources struct {
	// Fonts are the app's own files: a font at /fonts/x.woff2 is fonts/x.woff2.
	Fonts fs.FS
	// Picture reads a picture the page shows from a folder opened this
	// session, with its media type; an error leaves the picture out.
	Picture func(root, path string) ([]byte, string, error)
}

// policy lets the printed file load nothing but what is inside it.
const policy = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'">` +
	`<meta http-equiv="x-dns-prefetch-control" content="off">`

// fileRoute is where the page asks for a picture: /bava-file/?root=&path=.
const fileRoute = "/bava-file/"

// Printable is the page as one self-contained HTML document: its fonts and
// pictures inside as data, every other address removed, zoomed so its
// width fills the paper between the margins, in its theme.
func Printable(p Page, setup pdfprint.PageSetup, src Sources) (string, error) {
	body, err := inlineHTML(p.HTML, src)
	if err != nil {
		return "", err
	}
	theme := "light"
	if p.Dark {
		theme = "dark"
	}
	// The app's own frame (a window-high body that never scrolls) would cut
	// the page at one sheet.
	fit := "html, body { height: auto !important; overflow: visible !important; } body { margin: 0; }"
	if p.WidthPx > 0 {
		fit += fmt.Sprintf(" body { width: %spx; zoom: %s; }", num(p.WidthPx), num(fitZoom(setup, p.WidthPx)))
	}
	var b strings.Builder
	b.WriteString(`<!doctype html><html data-theme="` + theme + `"><head><meta charset="utf-8">` + policy)
	b.WriteString("<style>" + safeCSS(inlineCSS(p.CSS, src)) + "</style>")
	b.WriteString("<style>" + fit + "</style>")
	b.WriteString("</head><body>" + body + "</body></html>")
	return b.String(), nil
}

// fitZoom is how much a page widthPx wide is zoomed to fill the paper
// between its margins; 1 for a full-width page.
func fitZoom(setup pdfprint.PageSetup, widthPx float64) float64 {
	if widthPx <= 0 {
		return 1
	}
	width, _, err := setup.Size()
	if err != nil {
		return 1
	}
	room := (width - setup.Margins.Left - setup.Margins.Right) * 96 / 25.4
	return room / widthPx
}

// num writes a number for CSS, to four decimals at most.
func num(f float64) string {
	return strconv.FormatFloat(math.Round(f*1e4)/1e4, 'f', -1, 64)
}

// loading are the attributes that make a webview load something.
var loading = map[string]bool{"src": true, "srcset": true, "poster": true, "data": true}

// inlineHTML puts the page's pictures inside, drops every other address
// that would load something, and drops scripts and event handlers.
func inlineHTML(in string, src Sources) (string, error) {
	z := html.NewTokenizer(strings.NewReader(in))
	var out strings.Builder
	skip := 0
	for {
		tt := z.Next()
		if tt == html.ErrorToken {
			if z.Err() == io.EOF {
				return out.String(), nil
			}
			return "", fmt.Errorf("read the page: %w", z.Err())
		}
		// Raw before Token: Token unescapes the text Raw points at.
		raw := string(z.Raw())
		tok := z.Token()
		if tok.Data == "link" {
			continue
		}
		if tok.Data == "script" {
			switch tt {
			case html.StartTagToken:
				skip++
			case html.EndTagToken:
				skip--
			}
			continue
		}
		if skip > 0 {
			continue
		}
		switch tt {
		case html.StartTagToken, html.SelfClosingTagToken:
			kept := tok.Attr[:0]
			for _, a := range tok.Attr {
				key := strings.ToLower(a.Key)
				if strings.HasPrefix(key, "on") {
					continue
				}
				// A link keeps its address, as the page shows it; anywhere
				// else an address is something to fetch.
				if (key == "href" || key == "xlink:href" || a.Namespace == "xlink" && a.Key == "href") && tok.Data != "a" {
					continue
				}
				if loading[key] {
					data, ok := inlinePicture(a.Val, src)
					if !ok {
						continue
					}
					a.Val = data
				}
				kept = append(kept, a)
			}
			tok.Attr = kept
			out.WriteString(tok.String())
		default:
			out.WriteString(raw)
		}
	}
}

// inlinePicture is a picture the page shows from an opened folder, as data.
func inlinePicture(address string, src Sources) (string, bool) {
	if strings.HasPrefix(address, "data:") {
		return address, true
	}
	if !strings.HasPrefix(address, fileRoute) || src.Picture == nil {
		return "", false
	}
	u, err := url.Parse(address)
	if err != nil {
		return "", false
	}
	q := u.Query()
	data, kind, err := src.Picture(q.Get("root"), q.Get("path"))
	if err != nil {
		return "", false
	}
	return "data:" + kind + ";base64," + base64.StdEncoding.EncodeToString(data), true
}

var cssURL = regexp.MustCompile(`url\(\s*(?:"([^"]*)"|'([^']*)'|([^)'"\s]*))\s*\)`)

// inlineCSS puts the app's fonts inside as data and removes every other
// address.
func inlineCSS(css string, src Sources) string {
	return cssURL.ReplaceAllStringFunc(css, func(m string) string {
		parts := cssURL.FindStringSubmatch(m)
		address := parts[1] + parts[2] + parts[3]
		if strings.HasPrefix(address, "data:") {
			return m
		}
		if strings.HasPrefix(address, "/fonts/") && src.Fonts != nil {
			name := strings.TrimPrefix(path.Clean(address), "/")
			if data, err := fs.ReadFile(src.Fonts, name); err == nil {
				kind := mime.TypeByExtension(path.Ext(name))
				if path.Ext(name) == ".woff2" {
					kind = "font/woff2"
				}
				return `url("data:` + kind + ";base64," + base64.StdEncoding.EncodeToString(data) + `")`
			}
		}
		return "none"
	})
}

// safeCSS keeps styles from ending the style element they are put in.
func safeCSS(css string) string {
	return strings.ReplaceAll(css, "</", `<\/`)
}
