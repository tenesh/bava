package render_test

import (
	"encoding/json"
	"slices"
	"testing"

	"github.com/d2lang/d2/d2ast"
	"github.com/tharabyte/bava/internal/testutil"
)

// The D2 editor colours D2's reserved words from testdata/d2/keywords.json.
// This holds that list to the pinned D2's own, so a version bump that adds
// or drops a word fails here rather than leaving it uncoloured.
func TestKeywordListIsD2s(t *testing.T) {
	var listed []string
	if err := json.Unmarshal([]byte(testutil.ReadRepoFile(t, "testdata/d2/keywords.json")), &listed); err != nil {
		t.Fatal(err)
	}
	words := map[string]bool{}
	for word := range d2ast.ReservedKeywords {
		words[word] = true
	}
	for word := range d2ast.StyleKeywords {
		words[word] = true
	}
	var want []string
	for word := range words {
		want = append(want, word)
	}
	slices.Sort(want)
	if !slices.Equal(listed, want) {
		got, _ := json.MarshalIndent(want, "", "  ")
		t.Errorf("testdata/d2/keywords.json is not D2's list; it should be:\n%s", got)
	}
}
