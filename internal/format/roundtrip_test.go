package format_test

import (
	"strings"
	"testing"

	"github.com/tenesh/bava/internal/format"
)

// The mandatory test. Write → read → compare, not a writer test plus a reader
// test: asymmetries hide exactly in the gap between two separate tests.
func TestRoundTripPreservesEverything(t *testing.T) {
	cases := map[string]string{
		"prose only":            "# Title\n\nJust words.\n",
		"canvas only":           "```bava-canvas\n{\n  \"version\": 1,\n  \"elements\": [\n    {\n      \"h\": 4,\n      \"id\": \"e1\",\n      \"type\": \"rect\",\n      \"w\": 3,\n      \"x\": 1,\n      \"y\": 2,\n      \"z\": 1\n    }\n  ]\n}\n```\n",
		"prose and diagrams":    "# T\n\n```d2 id=a\nx -> y\n```\n\nmid\n\n```d2 id=b\np -> q\n```\n",
		"unknown element type":  "p\n\n```bava-canvas\n{\"version\":1,\"elements\":[{\"id\":\"x1\",\"type\":\"hologram\",\"x\":0,\"y\":0,\"w\":1,\"h\":1,\"z\":1,\"spin\":42}]}\n```\n",
		"unknown keys":          "p\n\n```bava-canvas\n{\"version\":1,\"elements\":[{\"id\":\"e1\",\"type\":\"rect\",\"x\":0,\"y\":0,\"w\":1,\"h\":1,\"z\":1,\"glow\":true}]}\n```\n",
		"unknown top level key": "p\n\n```bava-canvas\n{\"version\":1,\"elements\":[{\"id\":\"e1\",\"type\":\"rect\",\"x\":0,\"y\":0,\"w\":1,\"h\":1,\"z\":1}],\"grid\":{\"size\":8}}\n```\n",
		"unicode prose":         "# Café ☕️\n\nThe naïve approach — résumé.\n",
		"no trailing newline":   "# Title\n\nNo newline at the end.",
		"crlf":                  "# Title\r\n\r\nWindows wrote this.\r\n",
		"nested fences":         "````md\nexample:\n```d2\na -> b\n```\n````\n",
	}

	for name, source := range cases {
		t.Run(name, func(t *testing.T) {
			first, err := format.Read(source)
			if err != nil {
				t.Fatalf("read: %v", err)
			}
			written, err := format.Write(first)
			if err != nil {
				t.Fatalf("write: %v", err)
			}
			second, err := format.Read(written)
			if err != nil {
				t.Fatalf("re-read: %v", err)
			}

			if len(second.Scene.Elements) != len(first.Scene.Elements) {
				t.Errorf("element count changed: %d -> %d",
					len(first.Scene.Elements), len(second.Scene.Elements))
			}
			for i, element := range first.Scene.Elements {
				got := second.Scene.Elements[i]
				if got.ID != element.ID || got.Type != element.Type {
					t.Errorf("element %d changed: %+v -> %+v", i, element, got)
				}
			}
			if len(second.Diagrams) != len(first.Diagrams) {
				t.Errorf("diagram blocks changed: %v -> %v", first.Diagrams, second.Diagrams)
			}
			for id, body := range first.Diagrams {
				if second.Diagrams[id] != body {
					t.Errorf("diagram %q changed: %q -> %q", id, body, second.Diagrams[id])
				}
			}
		})
	}
}

// Writing twice must change nothing the second time. Without this, every save
// adds a blank line or shifts an indent and the file churns in git forever.
func TestRoundTripIsIdempotent(t *testing.T) {
	sources := []string{
		"# Title\n\nProse.\n",
		"p\n\n```bava-canvas\n{\"version\":1,\"elements\":[{\"id\":\"e1\",\"type\":\"rect\",\"x\":0,\"y\":0,\"w\":1,\"h\":1,\"z\":1}]}\n```\n",
		"# T\n\n```d2 id=a\nx -> y\n```\n",
	}

	for _, source := range sources {
		file, err := format.Read(source)
		if err != nil {
			t.Fatalf("read: %v", err)
		}
		once, err := format.Write(file)
		if err != nil {
			t.Fatalf("write: %v", err)
		}

		reread, err := format.Read(once)
		if err != nil {
			t.Fatalf("re-read: %v", err)
		}
		twice, err := format.Write(reread)
		if err != nil {
			t.Fatalf("second write: %v", err)
		}

		if once != twice {
			t.Errorf("writing twice changed the file:\n once: %q\ntwice: %q", once, twice)
		}
	}
}

// Another tool's .d2 file goes home unchanged. Bava writes nothing of its own
// into a file it did not create.
func TestForeignD2FileIsWrittenBackUnchanged(t *testing.T) {
	source := "# a comment\nusers -> web: request\nweb -> db\n"

	file, err := format.Read(source)
	if err != nil {
		t.Fatalf("read: %v", err)
	}
	out, err := format.Write(file)
	if err != nil {
		t.Fatalf("write: %v", err)
	}
	if out != source {
		t.Errorf("a foreign file was modified:\n got %q\nwant %q", out, source)
	}
}

func TestAddingACanvasToProseKeepsTheProse(t *testing.T) {
	prose := "# Title\n\nParagraph one.\n\nParagraph two.\n"
	file, _ := format.Read(prose)
	file.Scene.Elements = []format.Element{{ID: "e1", Type: "rect", W: 5, H: 5, Z: 1}}

	out, err := format.Write(file)
	if err != nil {
		t.Fatalf("write: %v", err)
	}
	if !strings.HasPrefix(out, prose) {
		t.Errorf("prose was altered:\n%q", out)
	}

	back, err := format.Read(out)
	if err != nil {
		t.Fatalf("re-read: %v", err)
	}
	if len(back.Scene.Elements) != 1 {
		t.Errorf("scene did not survive: %+v", back.Scene)
	}
}
