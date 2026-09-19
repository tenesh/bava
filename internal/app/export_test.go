package app_test

import (
	"encoding/base64"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/tenesh/bava/internal/app"
)

// An exported picture is the user's file, written where they asked. It is
// carried as base64 because the Wails bridge is JSON: bytes would arrive as a
// number array, several times the size.
func TestExportWritesTheBytesItWasGiven(t *testing.T) {
	path := filepath.Join(t.TempDir(), "diagram.png")
	// A PNG's first bytes, so the test would notice base64 that round-trips wrong.
	want := []byte{0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13}

	if msg := app.NewExportService().Save(path, base64.StdEncoding.EncodeToString(want)); msg != "" {
		t.Fatal(msg)
	}

	got, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != string(want) {
		t.Errorf("file = % x, want % x", got, want)
	}
}

func TestExportRefusesWhatItCannotWrite(t *testing.T) {
	dir := t.TempDir()
	cases := []struct {
		name     string
		path     string
		contents string
		want     string
	}{
		{"no path", "", "", "path"},
		{"malformed base64", filepath.Join(dir, "a.png"), "not base64!", "decode"},
		{"a folder that is not there", filepath.Join(dir, "missing", "a.png"), "", "export"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			msg := app.NewExportService().Save(tc.path, tc.contents)
			if msg == "" {
				t.Fatal("want an error message, got none")
			}
			if !strings.Contains(strings.ToLower(msg), tc.want) {
				t.Errorf("message = %q, want it to mention %q", msg, tc.want)
			}
		})
	}
}

// An export overwrites its own earlier version rather than appending to it.
func TestExportReplacesAnExistingFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "diagram.svg")
	if err := os.WriteFile(path, []byte("<svg>old and longer</svg>"), 0o600); err != nil {
		t.Fatal(err)
	}
	if msg := app.NewExportService().Save(path, base64.StdEncoding.EncodeToString([]byte("<svg/>"))); msg != "" {
		t.Fatal(msg)
	}
	got, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != "<svg/>" {
		t.Errorf("file = %q, want the new contents only", got)
	}
}
