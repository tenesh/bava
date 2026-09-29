package e2e_test

import (
	"strings"
	"testing"

	"github.com/tenesh/bava/internal/e2e"
)

func TestParseReadsAScenario(t *testing.T) {
	sc, err := e2e.Parse([]byte(`{
		"name": "create",
		"folders": ["${SCRATCH}"],
		"steps": [
			{"do": "menu", "target": "file.new"},
			{"do": "type", "text": "First page"},
			{"do": "key", "text": "Enter"},
			{"do": "wait", "target": "header", "text": "First page"},
			{"do": "drag", "target": ".canvas-host", "from": [100, 100], "to": [260, 180]},
			{"do": "pause", "timeoutMs": 500},
			{"do": "shot", "name": "after-save"}
		]
	}`), map[string]string{"SCRATCH": "/tmp/run"})
	if err != nil {
		t.Fatal(err)
	}
	if sc.Name != "create" || len(sc.Steps) != 7 || sc.Folders[0] != "/tmp/run" {
		t.Errorf("Parse = %+v", sc)
	}
}

func TestParseRefusesWhatCannotRun(t *testing.T) {
	cases := map[string]string{
		"unknown step":     `{"name":"x","steps":[{"do":"juggle"}]}`,
		"click, no target": `{"name":"x","steps":[{"do":"click"}]}`,
		"shot, no name":    `{"name":"x","steps":[{"do":"shot"}]}`,
		"drag, no points":  `{"name":"x","steps":[{"do":"drag","target":"a"}]}`,
		"pause, no time":   `{"name":"x","steps":[{"do":"pause"}]}`,
		"paste, no text":   `{"name":"x","steps":[{"do":"paste"}]}`,
		"no steps":         `{"name":"x","steps":[]}`,
		"unset variable":   `{"name":"x","folders":["${NOPE}"],"steps":[{"do":"menu","target":"file.new"}]}`,
	}
	for name, src := range cases {
		if _, err := e2e.Parse([]byte(src), nil); err == nil {
			t.Errorf("%s: parsed", name)
		}
	}
}

func TestFoldersAreAnsweredInOrderThenRefused(t *testing.T) {
	q := e2e.NewFolderQueue([]string{"/a", "/b"})
	for _, want := range []string{"/a", "/b"} {
		if got, err := q.Next("title"); err != nil || got != want {
			t.Errorf("Next = %q, %v; want %q", got, err, want)
		}
	}
	if _, err := q.Next("title"); err == nil || !strings.Contains(err.Error(), "no answer") {
		t.Errorf("a picker with no answer left = %v", err)
	}
}

func TestFilesAreAnsweredInOrderWithTheirVariables(t *testing.T) {
	sc, err := e2e.Parse([]byte(`{
		"name": "media",
		"files": [["${REPO}/logo.png", "${REPO}/demo.mp4"], []],
		"steps": [{"do": "menu", "target": "file.new"}]
	}`), map[string]string{"REPO": "/repo"})
	if err != nil {
		t.Fatal(err)
	}
	q := e2e.NewFileQueue(sc.Files)
	got, err := q.Next("image")
	if err != nil || len(got) != 2 || got[0] != "/repo/logo.png" || got[1] != "/repo/demo.mp4" {
		t.Errorf("first answer = %v, %v", got, err)
	}
	if got, err := q.Next("video"); err != nil || len(got) != 0 {
		t.Errorf("a cancelled picker = %v, %v", got, err)
	}
	if _, err := q.Next("image"); err == nil || !strings.Contains(err.Error(), "no answer") {
		t.Errorf("a picker with no answer left = %v", err)
	}
	if _, err := e2e.Parse([]byte(`{"name":"x","files":[["${NOPE}"]],"steps":[{"do":"menu","target":"file.new"}]}`), nil); err == nil {
		t.Error("an unset variable in a file answer was parsed")
	}
}

func TestParseReadsAPasteStep(t *testing.T) {
	if _, err := e2e.Parse([]byte(`{"name":"x","steps":[{"do":"paste","text":"https://youtu.be/abc123"}]}`), nil); err != nil {
		t.Errorf("a paste step: %v", err)
	}
}
