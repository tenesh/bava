package format_test

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/tenesh/bava/internal/format"
)

// Wails encodes a scene for the frontend and decodes the one the frontend
// sends back with encoding/json. Every key an element has must survive both
// directions, or saving from the app deletes it.
func TestElementJSONKeepsEveryKey(t *testing.T) {
	in := `{"id":"s1","type":"stroke","x":1,"y":2,"w":3,"h":4,"z":5,"points":[0,0,3,4],"text":"hello","futureKey":{"a":1}}`

	var element format.Element
	if err := json.Unmarshal([]byte(in), &element); err != nil {
		t.Fatal(err)
	}
	if element.ID != "s1" || element.X != 1 || element.Z != 5 {
		t.Errorf("known fields not decoded: %+v", element)
	}

	out, err := json.Marshal(element)
	if err != nil {
		t.Fatal(err)
	}
	for _, key := range []string{`"points":[0,0,3,4]`, `"text":"hello"`, `"futureKey":{"a":1}`} {
		if !strings.Contains(string(out), key) {
			t.Errorf("encoded element lost %s: %s", key, out)
		}
	}
}

// A known field changed on the Go side wins over the raw object it came from.
func TestElementJSONPrefersKnownFields(t *testing.T) {
	var element format.Element
	if err := json.Unmarshal([]byte(`{"id":"r1","type":"rect","x":1,"y":1,"w":1,"h":1,"z":1,"label":"kept"}`), &element); err != nil {
		t.Fatal(err)
	}
	element.X = 99
	out, err := json.Marshal(element)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(out), `"x":99`) || !strings.Contains(string(out), `"label":"kept"`) {
		t.Errorf("got %s", out)
	}
}

// The whole path the app takes: read a file, hand the scene to the frontend,
// get it back, write the file. Nothing may change.
func TestSceneSurvivesTheFrontendBridge(t *testing.T) {
	source := "# Plan\n\n```bava-canvas\n" + `{
  "elements": [
    {
      "h": 10,
      "id": "s1",
      "points": [
        0,
        0,
        10,
        10
      ],
      "type": "stroke",
      "w": 10,
      "x": 0,
      "y": 0,
      "z": 1
    },
    {
      "h": 20,
      "id": "t1",
      "measuredHeight": 16,
      "measuredWidth": 40,
      "text": "hello",
      "type": "text",
      "w": 40,
      "x": 5,
      "y": 5,
      "z": 2
    },
    {
      "endBinding": "r1",
      "frame": "f1",
      "h": 10,
      "id": "bound",
      "label": "an arrow label",
      "points": [
        0,
        0,
        20,
        10
      ],
      "startBinding": "missing-on-purpose",
      "type": "arrow",
      "w": 20,
      "x": 0,
      "y": 80,
      "z": 6
    },
    {
      "angle": 45,
      "arrowType": "elbow",
      "endArrowhead": "triangle-outline",
      "h": 10,
      "id": "a1",
      "points": [
        0,
        0,
        40,
        10
      ],
      "startArrowhead": "none",
      "strokeStyle": "dashed",
      "strokeWidth": 4,
      "type": "arrow",
      "w": 40,
      "x": 0,
      "y": 40,
      "z": 3
    },
    {
      "align": "left",
      "edges": "round",
      "fill": "#3366cc",
      "fontSize": 28,
      "futureStyle": "whatever-comes-next",
      "h": 20,
      "id": "r1",
      "locked": true,
      "opacity": 40,
      "type": "rect",
      "verticalAlign": "top",
      "w": 30,
      "x": 60,
      "y": 0,
      "z": 4
    },
    {
      "children": [
        "s1",
        "t1"
      ],
      "futureKey": true,
      "h": 30,
      "id": "g1",
      "type": "group",
      "w": 50,
      "x": 0,
      "y": 0,
      "z": 7
    }
  ],
  "grid": {
    "size": 8
  },
  "version": 1
}
` + "```\n"

	file, err := format.Read(source)
	if err != nil {
		t.Fatal(err)
	}

	// What Wails does: encode for the frontend, decode what comes back.
	toFrontend, err := json.Marshal(file.Scene)
	if err != nil {
		t.Fatal(err)
	}
	var fromFrontend format.Scene
	if err := json.Unmarshal(toFrontend, &fromFrontend); err != nil {
		t.Fatal(err)
	}

	written, err := format.Write(format.File{Source: file.Source, Scene: fromFrontend})
	if err != nil {
		t.Fatal(err)
	}
	if written != source {
		t.Errorf("the file changed crossing the bridge.\nwant:\n%s\ngot:\n%s", source, written)
	}
}

// A null in the elements list (JSON.stringify([undefined]) produces one, and a
// hand edit can) must be an error, not a panic.
func TestNullElementIsAnErrorNotAPanic(t *testing.T) {
	var scene format.Scene
	if err := json.Unmarshal([]byte(`{"version":1,"elements":[null]}`), &scene); err == nil {
		t.Error("a null element decoded without an error")
	}
	if _, err := format.Read("```bava-canvas\n{\"version\":1,\"elements\":[null]}\n```\n"); err == nil {
		t.Error("reading a null element gave no error")
	}
}
