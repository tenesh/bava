//go:build !(darwin && cgo)

package access

import "errors"

// bookmarks are macOS's alone.
type bookmarks struct{}

func (bookmarks) Sandboxed() bool { return true }

func (bookmarks) Keep(string) ([]byte, error) { return nil, errors.New("bookmarks are macOS's") }

func (bookmarks) Restore([]byte) (string, bool, error) {
	return "", false, errors.New("bookmarks are macOS's")
}
