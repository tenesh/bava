package render

import (
	"strings"

	"github.com/d2lang/d2/d2target"
)

// Layout is the geometry the canvas builds shapes from.
//
// It is what the diagram *is*, not how D2 painted it: position, size, label,
// nesting and the route of each connection. Colours, opacity, dashes, icons,
// tooltips and links are deliberately absent. A diagram inserted on the canvas
// arrives in Bava's own style (decided 2026-09-19), and leaving D2's palette
// out of this contract is what keeps that true: nothing downstream can come to
// depend on it.
//
// The SVG in the same result is for previewing. These two never disagree,
// because both come from the one compile.
type Layout struct {
	Shapes      []LayoutShape      `json:"shapes"`
	Connections []LayoutConnection `json:"connections"`
}

// LayoutShape is one node, in diagram coordinates.
type LayoutShape struct {
	// ID is D2's absolute id, dotted for a nested shape ("backend.compile").
	ID string `json:"id"`
	// Type is D2's shape name; the frontend maps it to Bava's shape set.
	Type string `json:"type"`
	// Parent is the container this shape sits in, or "" at the top level.
	Parent string  `json:"parent,omitempty"`
	X      float64 `json:"x"`
	Y      float64 `json:"y"`
	W      float64 `json:"w"`
	H      float64 `json:"h"`
	Label  string  `json:"label,omitempty"`
}

// LayoutConnection is one edge, with the route the engine chose.
type LayoutConnection struct {
	ID       string        `json:"id"`
	Src      string        `json:"src"`
	Dst      string        `json:"dst"`
	SrcArrow string        `json:"srcArrow,omitempty"`
	DstArrow string        `json:"dstArrow,omitempty"`
	Label    string        `json:"label,omitempty"`
	Route    []LayoutPoint `json:"route"`
}

type LayoutPoint struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// layoutOf reads the geometry out of a laid-out diagram.
func layoutOf(diagram *d2target.Diagram) Layout {
	if diagram == nil {
		return Layout{Shapes: []LayoutShape{}, Connections: []LayoutConnection{}}
	}

	ids := map[string]bool{}
	for _, shape := range diagram.Shapes {
		ids[shape.ID] = true
	}

	shapes := make([]LayoutShape, 0, len(diagram.Shapes))
	for _, shape := range diagram.Shapes {
		shapes = append(shapes, LayoutShape{
			ID:     shape.ID,
			Type:   shape.Type,
			Parent: parentOf(shape.ID, ids),
			X:      float64(shape.Pos.X),
			Y:      float64(shape.Pos.Y),
			W:      float64(shape.Width),
			H:      float64(shape.Height),
			Label:  shape.Label,
		})
	}

	connections := make([]LayoutConnection, 0, len(diagram.Connections))
	for _, connection := range diagram.Connections {
		route := make([]LayoutPoint, 0, len(connection.Route))
		for _, point := range connection.Route {
			if point == nil {
				continue
			}
			route = append(route, LayoutPoint{X: point.X, Y: point.Y})
		}
		connections = append(connections, LayoutConnection{
			ID:       connection.ID,
			Src:      connection.Src,
			Dst:      connection.Dst,
			SrcArrow: string(connection.SrcArrow),
			DstArrow: string(connection.DstArrow),
			Label:    connection.Label,
			Route:    route,
		})
	}

	return Layout{Shapes: shapes, Connections: connections}
}

// parentOf is the container a shape sits in, from its dotted absolute id.
//
// D2 does not hand the parent out directly, and the id is the one thing that
// already describes the nesting. The longest declared ancestor wins, so a
// label containing a dot cannot invent a parent that does not exist.
func parentOf(id string, ids map[string]bool) string {
	for at := strings.LastIndex(id, "."); at > 0; at = strings.LastIndex(id[:at], ".") {
		if candidate := id[:at]; ids[candidate] {
			return candidate
		}
	}
	return ""
}
