package format

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strings"
)

// Write renders a File back to Markdown.
//
// Prose is never reformatted: the original source is spliced, replacing only
// the canvas block. The file may have been written by hand or by another
// editor, and "improving" its whitespace is corrupting it.
func Write(file File) (string, error) {
	existing := canvasBlock(file.Source)

	// A scene with nothing in it adds no block, and removes one that is now
	// empty: a document stays a document.
	//
	// "Nothing" means no elements *and* nothing a newer version left behind.
	// Dropping the block because we see no elements would delete data we were
	// specifically told to preserve.
	if len(file.Scene.Elements) == 0 && len(file.Scene.Extra) == 0 {
		if existing == nil {
			return file.Source, nil
		}
		return strings.TrimRight(file.Source[:existing.Start], "\n") + "\n" + file.Source[existing.End:], nil
	}

	encoded, err := encodeScene(file.Scene)
	if err != nil {
		return "", err
	}
	block := "```" + CanvasInfo + "\n" + encoded + "```\n"

	if existing != nil {
		return file.Source[:existing.Start] + block + file.Source[existing.End:], nil
	}

	// Appended last, after everything the user wrote.
	prefix := file.Source
	if prefix != "" && !strings.HasSuffix(prefix, "\n") {
		prefix += "\n"
	}
	if prefix != "" {
		prefix += "\n"
	}
	return prefix + block, nil
}

func canvasBlock(source string) *Block {
	for _, block := range Scan(source) {
		if block.Info == CanvasInfo {
			found := block
			return &found
		}
	}
	return nil
}

// encodeScene writes the scene, merging each element's known fields over the
// raw object it was read from so unknown keys survive.
func encodeScene(scene Scene) (string, error) {
	top := map[string]json.RawMessage{}
	for key, value := range scene.Extra {
		top[key] = value
	}

	version, err := json.Marshal(max(scene.Version, Version))
	if err != nil {
		return "", err
	}
	top["version"] = version

	elements := make([]json.RawMessage, 0, len(scene.Elements))
	for _, element := range scene.Elements {
		encoded, err := encodeElement(element)
		if err != nil {
			return "", err
		}
		elements = append(elements, encoded)
	}
	encodedElements, err := json.Marshal(elements)
	if err != nil {
		return "", err
	}
	top["elements"] = encodedElements

	var buffer bytes.Buffer
	encoder := json.NewEncoder(&buffer)
	// Pretty-printed: minified JSON is one enormous line, and one enormous
	// line makes every git diff useless. The diff is what has to stay readable.
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(top); err != nil {
		return "", err
	}
	return buffer.String(), nil
}

func encodeElement(element Element) (json.RawMessage, error) {
	fields := map[string]json.RawMessage{}

	if len(element.Raw) > 0 {
		if err := json.Unmarshal(element.Raw, &fields); err != nil {
			return nil, fmt.Errorf("element %s: %w", element.ID, err)
		}
	}

	known, err := json.Marshal(struct {
		ID   string  `json:"id"`
		Type string  `json:"type"`
		X    float64 `json:"x"`
		Y    float64 `json:"y"`
		W    float64 `json:"w"`
		H    float64 `json:"h"`
		Z    int     `json:"z"`
	}{element.ID, element.Type, element.X, element.Y, element.W, element.H, element.Z})
	if err != nil {
		return nil, err
	}

	var knownFields map[string]json.RawMessage
	if err := json.Unmarshal(known, &knownFields); err != nil {
		return nil, err
	}
	for key, value := range knownFields {
		fields[key] = value
	}

	return json.Marshal(fields)
}
