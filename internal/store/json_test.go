package store_test

import (
	"testing"

	"github.com/tenesh/bava/internal/store"
	"github.com/tenesh/bava/internal/testutil"
)

// A stamp goes to the frontend with a file and comes back with its save.
func TestStampKeepsItsJSONKeys(t *testing.T) {
	testutil.AssertJSONKeys(t, store.Stamp{}, "modifiedUnixNano", "size")
}
