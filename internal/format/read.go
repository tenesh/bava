package format

import (
	"encoding/json"
	"fmt"
	"strings"
)

// Read parses a Bava file.
//
// On a malformed canvas block it returns both the error *and* a File carrying
// the prose. Losing a whole document to one bad trailing block is the worst
// outcome available, so the caller can still show what was written.
func Read(source string) (File, error) {
	file := File{
		Source:   source,
		Diagrams: map[string]string{},
	}

	for _, block := range Scan(source) {
		switch {
		case block.Info == CanvasInfo:
			file.HasCanvas = true
			scene, err := parseScene(block.Body)
			if err != nil {
				return file, fmt.Errorf("canvas block: %w", err)
			}
			file.Scene = scene

		case strings.HasPrefix(block.Info, "d2"):
			if id := infoAttribute(block.Info, "id"); id != "" {
				file.Diagrams[id] = block.Body
			}
		}
	}

	return file, nil
}

func parseScene(body string) (Scene, error) {
	var top map[string]json.RawMessage
	if err := json.Unmarshal([]byte(body), &top); err != nil {
		return Scene{}, err
	}

	scene := Scene{Version: Version, Extra: map[string]json.RawMessage{}}

	for key, value := range top {
		switch key {
		case "version":
			if err := json.Unmarshal(value, &scene.Version); err != nil {
				return Scene{}, fmt.Errorf("version: %w", err)
			}
		case "elements":
			var raws []json.RawMessage
			if err := json.Unmarshal(value, &raws); err != nil {
				return Scene{}, fmt.Errorf("elements: %w", err)
			}
			for _, raw := range raws {
				var element Element
				if err := json.Unmarshal(raw, &element); err != nil {
					return Scene{}, fmt.Errorf("element: %w", err)
				}
				// Element.UnmarshalJSON has kept the whole object, unescaped.
				scene.Elements = append(scene.Elements, element)
			}
		default:
			// An unknown top-level key, kept for the same reason as unknown
			// elements: a newer version put it there on purpose.
			scene.Extra[key] = value
		}
	}

	return scene, nil
}

// infoAttribute reads `key=value` out of a fence info string.
func infoAttribute(info, key string) string {
	for _, field := range strings.Fields(info) {
		name, value, found := strings.Cut(field, "=")
		if found && name == key {
			return value
		}
	}
	return ""
}
