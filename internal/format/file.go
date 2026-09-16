package format

import "encoding/json"

// CanvasInfo is the info string of the block holding the scene.
const CanvasInfo = "bava-canvas"

// Version is the format generation this package writes.
const Version = 1

// Element is one thing on the canvas.
//
// The known fields are parsed; **the whole original object is kept in Raw**.
// A newer Bava will write element types and keys this one does not know, and
// dropping them destroys work silently — unrecoverable by the time anyone
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

// Scene is the canvas.
type Scene struct {
	Version  int       `json:"version"`
	Elements []Element `json:"elements"`
	// Unknown top-level keys, kept for the same reason as unknown elements.
	Extra map[string]json.RawMessage `json:"-"`
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
