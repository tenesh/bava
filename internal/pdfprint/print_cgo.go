//go:build (darwin && cgo) || (linux && cgo && !gtk3)

package pdfprint

/*
#include <stdint.h>
*/
import "C"

import (
	"errors"
	"fmt"
	"runtime/cgo"
	"time"
)

// The half of printing macOS and Linux share: the system's code reports
// back through bavaPDFDone, once, with the handle it was given.

type result struct {
	ok      bool
	message string
}

//export bavaPDFDone
func bavaPDFDone(handle C.uintptr_t, ok C.int, message *C.char) {
	h := cgo.Handle(handle)
	done := h.Value().(chan result)
	h.Delete()
	done <- result{ok: ok != 0, message: C.GoString(message)}
}

// waitFor starts a print on the main thread and waits for its report.
func waitFor(start func(handle uintptr), onMain RunOnMain, timeout time.Duration) error {
	done := make(chan result, 1)
	handle := cgo.NewHandle(done)
	onMain(func() { start(uintptr(handle)) })
	select {
	case r := <-done:
		if !r.ok {
			return fmt.Errorf("print to PDF: %s", r.message)
		}
		return nil
	case <-time.After(timeout):
		return errors.New("print to PDF: the system's printing did not finish in time")
	}
}

func cBool(b bool) C.int {
	if b {
		return 1
	}
	return 0
}
