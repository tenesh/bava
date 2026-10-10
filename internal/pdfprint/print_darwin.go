//go:build darwin && cgo

package pdfprint

/*
#cgo CFLAGS: -x objective-c -fobjc-arc
#cgo LDFLAGS: -framework Cocoa -framework WebKit

#include <stdint.h>
#include <stdlib.h>

void bavaPrintPDF(uintptr_t handle, const char *html, const char *path,
                  double width, double height,
                  double top, double right, double bottom, double left,
                  int background, int settleMs);
*/
import "C"

import (
	"time"
	"unsafe"
)

// macOS takes points.
func printPDF(j job, onMain RunOnMain, timeout time.Duration) error {
	html, path := C.CString(j.html), C.CString(j.out)
	defer C.free(unsafe.Pointer(html))
	defer C.free(unsafe.Pointer(path))
	return waitFor(func(handle uintptr) {
		C.bavaPrintPDF(C.uintptr_t(handle), html, path,
			C.double(j.widthMM*pointsPerMM), C.double(j.heightMM*pointsPerMM),
			C.double(j.margins.Top*pointsPerMM), C.double(j.margins.Right*pointsPerMM),
			C.double(j.margins.Bottom*pointsPerMM), C.double(j.margins.Left*pointsPerMM),
			C.int(cBool(j.background)), C.int(settleDelay.Milliseconds()))
	}, onMain, timeout)
}
