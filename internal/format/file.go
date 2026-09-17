package format

import (
	"bytes"
	"encoding/json"
	"fmt"
)

// CanvasInfo is the info string of the block holding the scene.
const CanvasInfo = "bava-canvas"

// Version is the format generation this package writes.
const Version = 1

// Element is one thing on the canvas.
//
// The known fields are parsed; **the whole original object is kept in Raw**.
// A newer Bava will write element types and keys this one does not know, and
// dropping them destroys work silently, unrecoverable by the time anyone
// notices. Writing an element means writing Raw back with the known fields
// merged over it.
type Element struct {
	ID   string  `json:"id"`
	Type string  `json:"type"`
	X    float64 `json:"x"`
	Y    float64 `json:"y"`
	W    float64 `json:"w"`
	H    float64 `json:"h"`
	Z    int     `json:"z"`

	// Raw is the element exactly as it was read, or nil for one we created.
	Raw json.RawMessage `json:"-"`
}

// UnmarshalJSON decodes the known fields and keeps the whole object in Raw.
//
// Custom, because the frontend is on the other side of encoding/json: Wails
// decodes the scene the frontend saves into this type, and a plain decode
// keeps only the fields above. That dropped a stroke's points, a text
// element's text and every unknown key whenever the app saved.
func (e *Element) UnmarshalJSON(data []byte) error {
	// Only an object is an element. A null would otherwise decode to a nil map
	// and panic on the next write.
	if trimmed := bytes.TrimSpace(data); len(trimmed) == 0 || trimmed[0] != '{' {
		return fmt.Errorf("element is not an object: %.20s", trimmed)
	}
	type known Element
	var decoded known
	if err := json.Unmarshal(data, &decoded); err != nil {
		return err
	}
	*e = Element(decoded)
	raw, err := unescaped(data)
	if err != nil {
		return err
	}
	e.Raw = raw
	return nil
}

// unescaped re-encodes JSON without HTML escaping. json.Marshal escapes "<",
// ">" and "&" in whatever a MarshalJSON returns, so an element that crossed
// encoding/json can carry "\u003e" where the user typed ">". Numbers keep
// their exact text.
func unescaped(data []byte) (json.RawMessage, error) {
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.UseNumber()
	var value any
	if err := decoder.Decode(&value); err != nil {
		return nil, err
	}
	return marshalUnescaped(value)
}

// MarshalJSON writes the raw object with the known fields merged over it, so
// an element reaches the frontend with every key it has.
func (e Element) MarshalJSON() ([]byte, error) {
	return encodeElement(e)
}

// Scene is the canvas.
type Scene struct {
	Version  int       `json:"version"`
	Elements []Element `json:"elements"`
	// Unknown top-level keys, kept for the same reason as unknown elements.
	Extra map[string]json.RawMessage `json:"-"`
}

// UnmarshalJSON reads a scene as the canvas block holds it, unknown top-level
// keys included, for the same reason as Element's.
func (s *Scene) UnmarshalJSON(data []byte) error {
	parsed, err := parseScene(string(data))
	if err != nil {
		return err
	}
	*s = parsed
	return nil
}

// MarshalJSON writes a scene with its unknown top-level keys.
func (s Scene) MarshalJSON() ([]byte, error) {
	encoded, err := encodeScene(s)
	if err != nil {
		return nil, err
	}
	return []byte(encoded), nil
}

// File is a parsed Bava file.
type File struct {
	// Source is the original text, byte for byte. Writing replaces only the
	// canvas block within it.
	Source string
	// Diagrams maps a d2 block's id to its source.
	Diagrams map[string]string
	Scene    Scene
	// HasCanvas records whether the file had a canvas block, so writing an
	// empty scene back to a file that never had one adds nothing.
	HasCanvas bool
}
