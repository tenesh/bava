// Package testutil holds what Go tests share: paths in the repository, a tree
// of files written in one call, the JSON keys a type carries, and golden
// files. Only tests import it; nothing Bava ships does.
package testutil

import (
	"encoding/json"
	"flag"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
)

// RepoRoot is the repository's root: the nearest folder above the test's own
// that holds go.mod.
func RepoRoot(t testing.TB) string {
	t.Helper()
	dir, err := os.Getwd()
	if err != nil {
		t.Fatalf("working folder: %v", err)
	}
	for {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			t.Fatal("no go.mod above the test's folder")
		}
		dir = parent
	}
}

// RepoPath is a path in the repository, its parts given with "/" between
// folders, e.g. RepoPath(t, "testdata/golden", "a.svg").
func RepoPath(t testing.TB, parts ...string) string {
	t.Helper()
	path := RepoRoot(t)
	for _, part := range parts {
		path = filepath.Join(path, filepath.FromSlash(part))
	}
	return path
}

// ReadRepoFile is the content of a committed file, its path given as for
// RepoPath.
func ReadRepoFile(t testing.TB, parts ...string) string {
	t.Helper()
	b, err := os.ReadFile(RepoPath(t, parts...))
	if err != nil {
		t.Fatal(err)
	}
	return string(b)
}

// WriteTree writes each file under root, making the folders it needs. A key
// is a path with "/" between folders; one ending in "/" makes an empty folder
// and its content is ignored.
func WriteTree(t testing.TB, root string, files map[string]string) {
	t.Helper()
	for rel, content := range files {
		full := filepath.Join(root, filepath.FromSlash(rel))
		if strings.HasSuffix(rel, "/") {
			if err := os.MkdirAll(full, 0o755); err != nil {
				t.Fatal(err)
			}
			continue
		}
		if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(full, []byte(content), 0o644); err != nil {
			t.Fatal(err)
		}
	}
}

// MustMarshal is value as JSON, failing the test if it cannot be encoded.
func MustMarshal(t testing.TB, value any) []byte {
	t.Helper()
	b, err := json.Marshal(value)
	if err != nil {
		t.Fatalf("marshal %T: %v", value, err)
	}
	return b
}

// AssertJSONKeys checks that value encodes to an object with exactly the
// keys want, in any order. A Go field renamed without its json tag compiles
// and passes everything else, and the frontend reads nothing.
func AssertJSONKeys(t testing.TB, value any, want ...string) {
	t.Helper()
	var m map[string]any
	if err := json.Unmarshal(MustMarshal(t, value), &m); err != nil {
		t.Fatalf("%T is not a JSON object: %v", value, err)
	}
	got := make([]string, 0, len(m))
	for k := range m {
		got = append(got, k)
	}
	slices.Sort(got)
	want = slices.Clone(want)
	slices.Sort(want)
	if !slices.Equal(got, want) {
		t.Errorf("%T JSON keys = %v, want %v", value, got, want)
	}
}

// -update rewrites a golden file. Use it only after deciding the new output
// is correct, which means opening the file and looking at it. A golden
// regenerated because the test went red asserts nothing.
var update = flag.Bool("update", false, "rewrite golden SVG files")

// Golden compares got with the committed file at path, byte for byte, or
// rewrites the file when the test runs with -update.
func Golden(t testing.TB, path, got string) {
	t.Helper()
	if *update {
		if err := os.WriteFile(path, []byte(got), 0o644); err != nil {
			t.Fatalf("write golden: %v", err)
		}
		t.Logf("wrote %s; open it and look at it before committing", path)
		return
	}
	want, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read golden (regenerate with -update, then review it by eye): %v", err)
	}
	if got != string(want) {
		t.Errorf("output differs from %s (%d bytes vs %d). If this change is intended, regenerate with -update and review the diff by eye.",
			path, len(got), len(want))
	}
}
