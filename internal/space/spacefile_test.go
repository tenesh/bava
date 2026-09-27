package space_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"testing"

	"github.com/tenesh/bava/internal/space"
)

// docs/file-format.md, "Spaces": space.json keeps unknown keys through every
// write, as the rest of the format does.
func TestSpaceFileRoundTripKeepsUnknownKeys(t *testing.T) {
	path := filepath.Join(t.TempDir(), "space.json")
	in := `{"version":1,"order":{"":["b.md","a"]},"pageWidth":"wide","futureKey":{"x":[1,2]}}`
	if err := os.WriteFile(path, []byte(in), 0o644); err != nil {
		t.Fatal(err)
	}
	f, err := space.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if f.PageWidth != "wide" || !reflect.DeepEqual(f.Order[""], []string{"b.md", "a"}) {
		t.Fatalf("read %+v", f)
	}
	if err := space.WriteFile(path, f); err != nil {
		t.Fatal(err)
	}
	var back map[string]json.RawMessage
	raw, _ := os.ReadFile(path)
	if err := json.Unmarshal(raw, &back); err != nil {
		t.Fatal(err)
	}
	var future any
	if err := json.Unmarshal(back["futureKey"], &future); err != nil {
		t.Fatalf("futureKey lost: %v", err)
	}
	if !reflect.DeepEqual(future, map[string]any{"x": []any{1.0, 2.0}}) {
		t.Errorf("futureKey = %v, want it kept", future)
	}
	if string(back["version"]) != "1" {
		t.Errorf("version = %s", back["version"])
	}
}

func TestSpaceFileMissingReadsEmpty(t *testing.T) {
	f, err := space.ReadFile(filepath.Join(t.TempDir(), "nope.json"))
	if err != nil {
		t.Fatal(err)
	}
	if f.Version != 1 || len(f.Order) != 0 || f.PageWidth != "" {
		t.Errorf("missing file read as %+v, want an empty version 1", f)
	}
}

// Listed names come first in their order, gone ones are left out, and names
// not listed follow by name, case-insensitively.
func TestOrderedPutsListedFirstAndTheRestByName(t *testing.T) {
	cases := []struct {
		name            string
		listed, present []string
		want            []string
	}{
		{"none listed", nil, []string{"b.md", "A", "c"}, []string{"A", "b.md", "c"}},
		{"all listed", []string{"c", "A", "b.md"}, []string{"b.md", "A", "c"}, []string{"c", "A", "b.md"}},
		{"gone left out", []string{"gone.md", "c"}, []string{"c", "a"}, []string{"c", "a"}},
		{"new after listed", []string{"z.md"}, []string{"a.md", "z.md", "B"}, []string{"z.md", "a.md", "B"}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := space.Ordered(c.listed, c.present); !reflect.DeepEqual(got, c.want) {
				t.Errorf("Ordered(%v, %v) = %v, want %v", c.listed, c.present, got, c.want)
			}
		})
	}
}

// A listed name that no longer exists is dropped on the next write.
func TestSpaceFilePruneDropsGoneNames(t *testing.T) {
	f := space.File{Version: 1, Order: map[string][]string{"": {"gone.md", "kept.md"}, "Old": {"x.md"}}}
	f.Prune(func(folder, name string) bool { return name == "kept.md" })
	if !reflect.DeepEqual(f.Order, map[string][]string{"": {"kept.md"}}) {
		t.Errorf("pruned order = %v", f.Order)
	}
}
