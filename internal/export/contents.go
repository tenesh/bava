package export

import (
	"fmt"
	"html"
	"strings"
)

// Entry is one line of a combined PDF's contents: a page, with the sheet
// it starts on, or a folder heading the pages under it.
type Entry struct {
	Title  string `json:"title"`
	Depth  int    `json:"depth"`
	Folder bool   `json:"folder"`
	// Sheet is the sheet a page starts on; 0 for a folder.
	Sheet int `json:"-"`
}

// Colours are the theme's colours the contents are drawn in; the paper
// under them is filled with the other sheets'.
type Colours struct {
	// Text is the colour of its words.
	Text string
	// Ink is the quieter colour of page numbers.
	Ink string
}

// The contents' type: a document's body and title sizes, and the space
// above a folder and below the title, in the units print uses.
const (
	// contentsIndentEm is how far each folder level is set in.
	contentsIndentEm  = 1.25
	contentsBody      = "11pt/1.6"
	contentsTitle     = "20pt"
	contentsStrong    = 600
	contentsTitleGap  = "1.5em"
	contentsFolderGap = "0.75em"
)

// contentsPage is a combined PDF's contents: its title, then each folder
// as a heading and each page with the sheet it starts on at the right, in
// Bava's font. The names are text, never markup.
func contentsPage(title string, entries []Entry, c Colours, src Sources) string {
	var rows strings.Builder
	for _, e := range entries {
		kind := "page"
		sheet := ""
		if e.Folder {
			kind = "folder"
		} else {
			sheet = fmt.Sprintf(`<span class="sheet">%d</span>`, e.Sheet)
		}
		fmt.Fprintf(&rows, `<li class="%s" style="--depth: %d"><span class="name">%s</span>%s</li>`, kind, e.Depth, html.EscapeString(e.Title), sheet)
	}
	text, ink := c.Text, c.Ink
	if text == "" {
		text = "CanvasText"
	}
	if ink == "" {
		ink = text
	}
	css := inlineCSS(`@font-face { font-family: "Bava Contents"; src: url("/fonts/Geist-Variable.woff2") format("woff2"); }`, src)
	return `<!doctype html><html><head><meta charset="utf-8">` + policy + `<style>` + css +
		` html, body { margin: 0; }` +
		` body { font: ` + contentsBody + ` "Bava Contents", sans-serif; color: ` + text + `; }` +
		fmt.Sprintf(` h1 { font-size: %s; font-weight: %d; margin: 0 0 %s; }`, contentsTitle, contentsStrong, contentsTitleGap) +
		` ol { list-style: none; margin: 0; padding: 0; }` +
		fmt.Sprintf(` li { display: flex; gap: 1em; padding-inline-start: calc(var(--depth) * %sem); break-inside: avoid; }`, num(contentsIndentEm)) +
		fmt.Sprintf(` li.folder { font-weight: %d; margin-top: %s; }`, contentsStrong, contentsFolderGap) +
		` .name { flex: 1; }` +
		` .sheet { color: ` + ink + `; font-variant-numeric: tabular-nums; }` +
		`</style></head><body><h1>` + html.EscapeString(title) + `</h1><ol>` + rows.String() + `</ol></body></html>`
}
