//go:build linux && cgo && !gtk3

package pdfprint

/*
#cgo pkg-config: gtk4 webkitgtk-6.0

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

// GTK takes millimetres, so the sizes go over as they are.
func printPDF(j job, onMain RunOnMain, timeout time.Duration) error {
	html, path := C.CString(j.html), C.CString(j.out)
	defer C.free(unsafe.Pointer(html))
	defer C.free(unsafe.Pointer(path))
	return waitFor(func(handle uintptr) {
		C.bavaPrintPDF(C.uintptr_t(handle), html, path,
			C.double(j.widthMM), C.double(j.heightMM),
			C.double(j.margins.Top), C.double(j.margins.Right),
			C.double(j.margins.Bottom), C.double(j.margins.Left),
			C.int(cBool(j.background)), C.int(settleDelay.Milliseconds()))
	}, onMain, timeout)
}
