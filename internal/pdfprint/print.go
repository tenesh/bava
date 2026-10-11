package pdfprint

import (
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// RunOnMain runs a function on the app's main thread and returns once it
// has run: AppKit and GTK are only called from there. The app passes
// Wails' application.InvokeSync.
type RunOnMain func(func())

// Timeout is how long a print may take before it is given up.
const Timeout = 60 * time.Second

// job is one print: the HTML, the page in millimetres, and the file.
type job struct {
	html string
	// page is the file the HTML is loaded from, set once it is written.
	page              string
	widthMM, heightMM float64
	margins           Margins
	background        bool
	out               string
}

// Check reports why a setup cannot be printed: an unknown paper, a
// negative margin, or margins that leave no room.
func (setup PageSetup) Check() error {
	width, height, err := setup.Size()
	if err != nil {
		return err
	}
	m := setup.Margins
	if m.Top < 0 || m.Right < 0 || m.Bottom < 0 || m.Left < 0 {
		return errors.New("a margin cannot be negative")
	}
	if m.Left+m.Right >= width || m.Top+m.Bottom >= height {
		return fmt.Errorf("margins leave no room on a %v × %v mm page", width, height)
	}
	return nil
}

func newJob(html string, setup PageSetup, out string) (job, error) {
	if err := setup.Check(); err != nil {
		return job{}, err
	}
	width, height, _ := setup.Size()
	m := setup.Margins
	if !filepath.IsAbs(out) {
		return job{}, fmt.Errorf("the PDF's path must be absolute: %s", out)
	}
	return job{html: html, widthMM: width, heightMM: height, margins: m, background: setup.Background, out: out}, nil
}

// Print has the system's webview print html to a PDF file at out, with the
// page setup given, and returns once the file is written or the print
// failed. Call it off the main thread: it waits for the print, which runs
// there.
func Print(html string, setup PageSetup, out string, onMain RunOnMain) error {
	return printWith(printPDF, html, setup, out, onMain)
}

// fileURL is a file's address: file:///C:/Users/... on Windows.
func fileURL(path string) string {
	path = filepath.ToSlash(path)
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	return (&url.URL{Scheme: "file", Path: path}).String()
}

// printer is one system's printing of a job.
type printer func(j job, onMain RunOnMain, timeout time.Duration) error

// printWith writes the HTML to a file of its own in the system's temporary
// folder and has the printer load it from there, then removes it. A file
// rather than a string: WebView2 takes no more than 2 MB of HTML as a
// string, and a page with its pictures and fonts inside is often more.
func printWith(print printer, html string, setup PageSetup, out string, onMain RunOnMain) error {
	j, err := newJob(html, setup, out)
	if err != nil {
		return err
	}
	f, err := os.CreateTemp("", "bava-print-*.html")
	if err != nil {
		return fmt.Errorf("print to PDF: %w", err)
	}
	j.page = f.Name()
	defer os.Remove(j.page)
	_, err = f.WriteString(html)
	if cerr := f.Close(); err == nil {
		err = cerr
	}
	if err != nil {
		return fmt.Errorf("print to PDF: write the page: %w", err)
	}
	return print(j, onMain, Timeout)
}

// pointsPerMM converts millimetres to the points (1/72 inch) macOS uses.
const pointsPerMM = 72 / 25.4

// pixelsPerMM converts millimetres to the CSS pixels (1/96 inch) a webview
// lays a page out in.
const pixelsPerMM = 96 / 25.4

// settleDelay is how long a loaded page is given for layout and fonts to
// settle before it is printed.
const settleDelay = 300 * time.Millisecond
