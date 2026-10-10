package pdfprint

import (
	"errors"
	"fmt"
	"path/filepath"
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
	html              string
	widthMM, heightMM float64
	margins           Margins
	background        bool
	out               string
}

func newJob(html string, setup PageSetup, out string) (job, error) {
	width, height, err := setup.Size()
	if err != nil {
		return job{}, err
	}
	m := setup.Margins
	if m.Top < 0 || m.Right < 0 || m.Bottom < 0 || m.Left < 0 {
		return job{}, errors.New("a margin cannot be negative")
	}
	if m.Left+m.Right >= width || m.Top+m.Bottom >= height {
		return job{}, fmt.Errorf("margins leave no room on a %v × %v mm page", width, height)
	}
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
	j, err := newJob(html, setup, out)
	if err != nil {
		return err
	}
	return printPDF(j, onMain, Timeout)
}

// pointsPerMM converts millimetres to the points (1/72 inch) macOS uses.
const pointsPerMM = 72 / 25.4

// pixelsPerMM converts millimetres to the CSS pixels (1/96 inch) a webview
// lays a page out in.
const pixelsPerMM = 96 / 25.4

// settleDelay is how long a loaded page is given for layout and fonts to
// settle before it is printed.
const settleDelay = 300 * time.Millisecond
