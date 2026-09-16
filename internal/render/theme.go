package render

import (
	"fmt"

	"github.com/d2lang/d2/d2target"
)

// Theme carries the diagram colours for a render.
//
// The token layer in `frontend/src/styles/tokens/_color.scss` is the source of
// truth for the values; Go holds the mapping onto D2's palette and no copy of
// the palette itself. A diagram's SVG does not inherit CSS, so a theme change
// has to travel this path or the canvas keeps the old colours while the chrome
// changes around it.
type Theme struct {
	Background    string `json:"background"`
	ContainerFill string `json:"containerFill"`
	NodeFill      string `json:"nodeFill"`
	NodeStroke    string `json:"nodeStroke"`
	Label         string `json:"label"`
	Edge          string `json:"edge"`
	EdgeLabel     string `json:"edgeLabel"`
}

// validate rejects a partly-filled theme.
//
// A struct with three fields set would render the rest from D2's defaults and
// look subtly wrong rather than fail, which is the harder bug to find.
func (t *Theme) validate() error {
	for name, value := range map[string]string{
		"background":    t.Background,
		"containerFill": t.ContainerFill,
		"nodeFill":      t.NodeFill,
		"nodeStroke":    t.NodeStroke,
		"label":         t.Label,
		"edge":          t.Edge,
		"edgeLabel":     t.EdgeLabel,
	} {
		if value == "" {
			return fmt.Errorf("incomplete theme: %s is empty", name)
		}
	}
	return nil
}

// overrides maps our seven colours onto D2's palette.
//
// D2 has two families and they are not interchangeable. The neutrals N1-N7 run
// darkest to lightest and carry text and canvas; the B and A families carry
// shapes. Measured on 2026-09-16 by rendering with a distinct colour in every
// slot and reading back which reached the output:
//
//	reached output : N1 N2 N3 N6 N7 · B1 B2 B4 B5 · AA4
//	never reached  : N4 N5 · B3 B6 · AA2 AA5 · AB4 AB5
//
// So shape stroke and fill must go through the B family. Mapping them onto N4
// and N5 — the obvious reading of "neutral scale" — produces a diagram where
// the node borders keep D2's default blue however the theme is set.
//
// Several slots are doubled up because D2 distinguishes shades we do not: it
// has two stroke weights and several fill tints where the design gives one of
// each.
//
// Background is deliberately absent. A diagram element sits on a surface the
// canvas owns and paints behind the SVG; passing a background here as well
// yields two backgrounds that disagree at the edges.
func (t *Theme) overrides() *d2target.ThemeOverrides {
	return &d2target.ThemeOverrides{
		// Text and canvas.
		N1: &t.Label,
		N2: &t.EdgeLabel,
		N3: &t.Edge,
		N4: &t.NodeStroke,
		N5: &t.NodeStroke,
		N6: &t.ContainerFill,
		N7: &t.NodeFill,
		// Shape strokes: D2's blues B1/B2 and the accent AA2.
		B1:  &t.NodeStroke,
		B2:  &t.NodeStroke,
		AA2: &t.NodeStroke,
		// Shape fills, D2's light tints. Every one is set: an unmapped slot
		// keeps its default pale blue and surfaces on whichever shape type
		// happens to use it — a cylinder nested in a container, or a person
		// shape — long after the theme looked correct on a rectangle.
		B3:  &t.NodeFill,
		B4:  &t.NodeFill,
		AB4: &t.NodeFill,
		B5:  &t.ContainerFill,
		B6:  &t.ContainerFill,
		AA4: &t.ContainerFill,
		AA5: &t.ContainerFill,
		AB5: &t.ContainerFill,
	}
}
