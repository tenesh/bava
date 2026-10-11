package export

import (
	"bytes"
	"context"
	"fmt"
	"path/filepath"

	"github.com/pdfcpu/pdfcpu/pkg/api"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu"

	"github.com/tharabyte/bava/internal/pdfprint"
	"github.com/tharabyte/bava/internal/store"
)

// SpaceEntry is one entry of a folder's or the Space's PDF, in the Files
// tree's order: a folder, or a page with its Document and, when it holds
// something, its Canvas.
type SpaceEntry struct {
	Entry
	Path     string  `json:"path"`
	Document *Page   `json:"document"`
	Canvas   *Canvas `json:"canvas"`
}

// SpaceRequest is a folder's or the Space's PDF: its title, its entries,
// the styles every page is drawn with, and how it is printed.
type SpaceRequest struct {
	Setup   pdfprint.PageSetup `json:"setup"`
	Title   string             `json:"title"`
	CSS     string             `json:"css"`
	Entries []SpaceEntry       `json:"entries"`
	Dark    bool               `json:"dark"`
	Paper   string             `json:"paper"`
	Text    string             `json:"text"`
	Ink     string             `json:"ink"`
	Numbers bool               `json:"numbers"`
}

// PageError is a page of a Space's PDF that could not be printed.
type PageError struct {
	Path string
	Err  error
}

// Error names the page and why it failed.
func (e *PageError) Error() string { return e.Path + ": " + e.Err.Error() }

// Unwrap is why the page failed.
func (e *PageError) Unwrap() error { return e.Err }

// contentsTries is how many times the contents may be printed while their
// length settles: once more each time they run to a different count than
// assumed.
const contentsTries = 3

// SpacePDF prints a folder or the Space as one PDF: a contents page
// listing each page and the sheet it starts on, then each page's Document
// and Canvas; filled and numbered as asked, with bookmarks, folders over
// their pages, written at out. A page that fails stops it, named, and
// nothing is written.
func SpacePDF(ctx context.Context, req SpaceRequest, src Sources, print Printer, out string) error {
	l := look{dark: req.Dark, paper: req.Paper, ink: req.Ink, numbers: req.Numbers}
	if err := l.check(); err != nil {
		return err
	}
	if req.Text != "" && !colour.MatchString(req.Text) {
		return fmt.Errorf("%q is not a colour", req.Text)
	}
	dir, conf, done, err := workspace()
	if err != nil {
		return err
	}
	defer done()

	// Each page's parts, and how many sheets they run to.
	var pages []part
	pageSheets := make([]int, len(req.Entries))
	for i, e := range req.Entries {
		if e.Folder || (e.Document == nil && e.Canvas == nil) {
			continue
		}
		var doc *Page
		if e.Document != nil {
			page := *e.Document
			page.CSS = req.CSS
			doc = &page
		}
		parts, err := printPage(dir, fmt.Sprintf("page-%d", i), doc, e.Canvas, req.Setup, l, src, print)
		if err != nil {
			return &PageError{Path: e.Path, Err: err}
		}
		for _, p := range parts {
			n, err := sheets(ctx, p.file, conf)
			if err != nil {
				return &PageError{Path: e.Path, Err: err}
			}
			pageSheets[i] += n
		}
		pages = append(pages, parts...)
	}
	if len(pages) == 0 {
		return ErrNothing
	}

	// The contents list where each page starts, which depends on how long
	// the contents themselves are: printed again until that settles.
	setup := req.Setup
	setup.Background = true
	contents := part{filepath.Join(dir, "contents.pdf"), setup}
	colours := Colours{Text: req.Text, Ink: req.Ink}
	assumed := 1
	var starts []int
	for try := 0; ; try++ {
		var entries []Entry
		entries, starts = listed(req.Entries, pageSheets, assumed)
		if err := print(contentsPage(req.Title, entries, colours, src), setup, contents.file); err != nil {
			return fmt.Errorf("print the contents: %w", err)
		}
		n, err := sheets(ctx, contents.file, conf)
		if err != nil {
			return err
		}
		if n == assumed {
			break
		}
		if try+1 == contentsTries {
			return fmt.Errorf("print the contents: their length did not settle")
		}
		assumed = n
	}

	joined, _, err := assemble(ctx, append([]part{contents}, pages...), l, dir, print, src, conf)
	if err != nil {
		return err
	}
	var marked bytes.Buffer
	if err := api.AddBookmarks(ctx, bytes.NewReader(joined), &marked, bookmarks(req.Entries, starts), true, conf); err != nil {
		return fmt.Errorf("export PDF: add bookmarks: %w", err)
	}
	if err := store.SaveFrom(out, &marked); err != nil {
		return fmt.Errorf("export PDF: %w", err)
	}
	return nil
}

// listed is the contents' entries with the sheet each page starts on, the
// contents running to contentsSheets, and each entry's starting sheet (a
// folder's is its first page's; 0 when it has none).
func listed(entries []SpaceEntry, pageSheets []int, contentsSheets int) ([]Entry, []int) {
	out := make([]Entry, len(entries))
	starts := make([]int, len(entries))
	next := contentsSheets + 1
	for i, e := range entries {
		out[i] = e.Entry
		if pageSheets[i] > 0 {
			out[i].Sheet = next
			starts[i] = next
			next += pageSheets[i]
		}
	}
	// A folder starts where its first page does.
	for i, e := range entries {
		if !e.Folder {
			continue
		}
		for j := i + 1; j < len(entries) && entries[j].Depth > e.Depth; j++ {
			if starts[j] > 0 && !entries[j].Folder {
				starts[i] = starts[j]
				break
			}
		}
	}
	return out, starts
}

// bookmarks are the entries as a tree, folders over their pages, each
// opening on its starting sheet; a folder with no pages has none.
func bookmarks(entries []SpaceEntry, starts []int) []pdfcpu.Bookmark {
	var build func(i, depth int) ([]pdfcpu.Bookmark, int)
	build = func(i, depth int) ([]pdfcpu.Bookmark, int) {
		var out []pdfcpu.Bookmark
		for i < len(entries) && entries[i].Depth >= depth {
			e := entries[i]
			if e.Depth > depth {
				i++
				continue
			}
			b := pdfcpu.Bookmark{Title: e.Title, PageFrom: starts[i]}
			i++
			if e.Folder {
				b.Kids, i = build(i, depth+1)
			}
			if b.PageFrom > 0 {
				out = append(out, b)
			}
		}
		return out, i
	}
	marks, _ := build(0, 0)
	return marks
}
