//go:build darwin && cgo

package access

/*
#cgo CFLAGS: -x objective-c -fobjc-arc
#cgo LDFLAGS: -framework Foundation

#include <stdlib.h>

void *bavaBookmark(const char *path, int *length, char **failure);
char *bavaResolve(const void *data, int length, int *stale, char **failure);
*/
import "C"

import (
	"errors"
	"unsafe"
)

// bookmarks keep the Mac App Store sandbox's grants as security-scoped
// bookmarks, and start access to each when it is restored, for the rest of
// the launch.
type bookmarks struct{}

func (bookmarks) Sandboxed() bool { return true }

func (bookmarks) Keep(path string) ([]byte, error) {
	cpath := C.CString(path)
	defer C.free(unsafe.Pointer(cpath))
	var length C.int
	var failure *C.char
	data := C.bavaBookmark(cpath, &length, &failure)
	if data == nil {
		defer C.free(unsafe.Pointer(failure))
		return nil, errors.New(C.GoString(failure))
	}
	defer C.free(data)
	return C.GoBytes(data, length), nil
}

func (bookmarks) Restore(token []byte) (string, bool, error) {
	if len(token) == 0 {
		return "", false, errors.New("no bookmark")
	}
	data := C.CBytes(token)
	defer C.free(data)
	var stale C.int
	var failure *C.char
	path := C.bavaResolve(data, C.int(len(token)), &stale, &failure)
	if path == nil {
		defer C.free(unsafe.Pointer(failure))
		return "", false, errors.New(C.GoString(failure))
	}
	defer C.free(unsafe.Pointer(path))
	return C.GoString(path), stale != 0, nil
}
