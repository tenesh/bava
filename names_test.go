package main_test

import (
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"github.com/tharabyte/bava/internal/testutil"
)

// otherApps are products the repository never names: Bava describes what
// it does in its own words, never by another app. What Bava is built on
// and runs with (its libraries, the systems, their webviews and stores,
// file formats) is not on the list. The names are kept shifted (rot13) so
// that not even this file spells them out; the first matched in any case,
// the second only capitalised, as their plain words are common.
var (
	anyCase = []string{"rkpnyvqenj", "abgvba", "renfre.vb", "bofvqvna", "zveb", "gyqenj", "svtzn", "cracbg", "oybpxfhvgr", "pbasyhrapr", "tbbtyr qbpf", "rireabgr", "dhvc", "geryyb", "unpxcnq", "dhvpxqenj", "if pbqr", "ifpbqr", "argfvt", "vpybhq", "qebcobk", "barqevir", "tbbtyr qevir"}
	exact   = []string{"Yvarne", "Mrq", "Fhoyvzr"}
)

var otherApps = regexp.MustCompile(`(?i:\b(` + alternatives(anyCase) + `)\b)|\b(` + alternatives(exact) + `)\b`)

// alternatives is the names, unshifted, as one alternation.
func alternatives(shifted []string) string {
	plain := make([]string, len(shifted))
	for i, name := range shifted {
		plain[i] = regexp.QuoteMeta(strings.Map(rot13, name))
	}
	return strings.Join(plain, "|")
}

func rot13(r rune) rune {
	switch {
	case r >= 'a' && r <= 'z':
		return 'a' + (r-'a'+13)%26
	case r >= 'A' && r <= 'Z':
		return 'A' + (r-'A'+13)%26
	}
	return r
}

func TestTheRepositoryNamesNoOtherApp(t *testing.T) {
	root := testutil.RepoRoot(t)
	// What git keeps, and what it would keep: never what it ignores.
	list := exec.Command("git", "ls-files", "--cached", "--others", "--exclude-standard")
	list.Dir = root
	out, err := list.Output()
	if err != nil {
		t.Fatalf("git ls-files: %v", err)
	}
	for _, rel := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		switch strings.ToLower(filepath.Ext(rel)) {
		case ".png", ".jpg", ".woff2", ".ico", ".icns", ".pdf", ".zip", ".sum":
			continue
		}
		if rel == "names_test.go" || strings.HasPrefix(rel, "frontend/node_modules/") {
			continue
		}
		data, err := os.ReadFile(filepath.Join(root, rel))
		if err != nil {
			continue // listed but gone: a deletion not yet committed
		}
		for i, line := range strings.Split(string(data), "\n") {
			if m := otherApps.FindString(line); m != "" {
				t.Errorf("%s:%d names %q", rel, i+1, m)
			}
		}
	}
}
