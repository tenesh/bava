package format_test

import (
	"encoding/json"
	"fmt"
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
		"unicode prose":         "# Café ☕️\n\nThe naïve approach → résumé.\n",
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

// Every shape type Milestone 6 adds, with a label and all three colours, must
// read and write back byte for byte, including an unknown swatch name.
func TestRoundTripEveryShapeWithLabelAndColours(t *testing.T) {
	var elements []string
	for i, shape := range []string{"rect", "ellipse", "diamond", "cylinder", "hexagon", "parallelogram", "document", "person", "cloud"} {
		elements = append(elements, fmt.Sprintf(`    {
      "color": "blue",
      "fill": "ultraviolet",
      "h": 40,
      "id": "e%d",
      "label": "Café %s: A -> B & <C>",
      "stroke": "red",
      "type": "%s",
      "w": 80,
      "x": %d,
      "y": 0,
      "z": %d
    }`, i, shape, shape, i*100, i+1))
	}
	elements = append(elements, `    {
      "h": 10,
      "id": "a1",
      "points": [
        0,
        0,
        50,
        10
      ],
      "stroke": "green",
      "type": "arrow",
      "w": 50,
      "x": 0,
      "y": 60,
      "z": 20
    }`)
	source := "# Shapes\n\n```bava-canvas\n{\n  \"elements\": [\n" + strings.Join(elements, ",\n") + "\n  ],\n  \"version\": 1\n}\n```\n"

	file, err := format.Read(source)
	if err != nil {
		t.Fatal(err)
	}
	// Through the frontend bridge as well, since that is how the app saves.
	bridged, err := json.Marshal(file.Scene)
	if err != nil {
		t.Fatal(err)
	}
	var scene format.Scene
	if err := json.Unmarshal(bridged, &scene); err != nil {
		t.Fatal(err)
	}
	written, err := format.Write(format.File{Source: file.Source, Scene: scene})
	if err != nil {
		t.Fatal(err)
	}
	if written != source {
		t.Errorf("shapes did not round-trip.\nwant:\n%s\ngot:\n%s", source, written)
	}
}

// Milestone 6.3's keys: the writer models none of them, so they survive only
// through the raw element. A regression here is silent data loss in a file
// written by a newer Bava, or by this one after the frontend adds a key.
func TestRoundTripStylePropertiesAndLiteralColours(t *testing.T) {
	source := "# Styles\n\n```bava-canvas\n{\n  \"elements\": [\n" + strings.Join([]string{
		`    {
      "align": "right",
      "angle": 45,
      "edges": "round",
      "fill": "#e03131",
      "fontSize": 28,
      "h": 40,
      "id": "s1",
      "label": "Styled",
      "locked": true,
      "opacity": 60,
      "strokeStyle": "dashed",
      "strokeWidth": 4,
      "type": "rect",
      "verticalAlign": "top",
      "w": 80,
      "x": 0,
      "y": 0,
      "z": 1
    }`,
		`    {
      "arrowType": "elbow",
      "endArrowhead": "triangle-outline",
      "h": 10,
      "id": "a1",
      "points": [
        0,
        0,
        50,
        10
      ],
      "startArrowhead": "circle",
      "stroke": "#0b7285",
      "type": "arrow",
      "w": 50,
      "x": 0,
      "y": 60,
      "z": 2
    }`,
		`    {
      "edges": "hexagonal",
      "h": 10,
      "id": "u1",
      "opacity": "very",
      "someFutureKey": {
        "nested": [
          1,
          2
        ]
      },
      "strokeWidth": 3,
      "type": "rect",
      "w": 10,
      "x": 0,
      "y": 100,
      "z": 3
    }`,
	}, ",\n") + "\n  ],\n  \"version\": 1\n}\n```\n"

	file, err := format.Read(source)
	if err != nil {
		t.Fatal(err)
	}
	written, err := format.Write(file)
	if err != nil {
		t.Fatal(err)
	}
	if written != source {
		t.Errorf("round trip changed the file:\n--- want ---\n%s\n--- got ---\n%s", source, written)
	}
}

// Bindings and containment are ids, and a file keeps them exactly as written:
// an arrow attached to a shape that no longer exists still names it, because
// the endpoint freezes rather than the binding being dropped
// (docs/file-format.md, "Attachment and containment").
func TestRoundTripBindingsAndContainment(t *testing.T) {
	source := "# Plan\n\n```bava-canvas\n" + `{
  "elements": [
    {
      "frame": "f1",
      "h": 20,
      "id": "a",
      "type": "rect",
      "w": 20,
      "x": 0,
      "y": 0,
      "z": 1
    },
    {
      "endBinding": "gone-long-ago",
      "h": 10,
      "id": "arrow1",
      "label": "carries a label",
      "points": [
        0,
        0,
        40,
        10
      ],
      "startBinding": "a",
      "type": "arrow",
      "w": 40,
      "x": 20,
      "y": 0,
      "z": 2
    },
    {
      "framingStyle": "something-later",
      "h": 80,
      "id": "f1",
      "type": "frame",
      "w": 120,
      "x": 0,
      "y": 0,
      "z": 3
    }
  ],
  "version": 1
}
` + "```\n"

	file, err := format.Read(source)
	if err != nil {
		t.Fatal(err)
	}
	written, err := format.Write(file)
	if err != nil {
		t.Fatal(err)
	}
	if written != source {
		t.Errorf("bindings or containment changed on the way through.\nwant:\n%s\ngot:\n%s", source, written)
	}
}
