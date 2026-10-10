//go:build !(darwin && cgo) && !(linux && cgo && !gtk3) && !windows

package pdfprint

import (
	"errors"
	"time"
)

func printPDF(job, RunOnMain, time.Duration) error {
	return errors.New("printing to PDF is not available on this system")
}
