package render

import (
	"strings"

	"github.com/d2lang/d2/d2graph"
	"github.com/d2lang/d2/d2target"
)

// Layout is the geometry the canvas builds shapes from.
//
// It is what the diagram *is*, not how D2 painted it: position, size, label,
// nesting and the route of each connection. Colours, opacity, dashes, icons,
// tooltips and links are deliberately absent. A diagram inserted on the canvas
// arrives in Bava's own style, and leaving D2's palette out of this contract
// is what keeps that true: nothing downstream can come to depend on it.
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
	// Rows are a SQL table's columns or a UML class's members as the canvas
	// writes them, one a line ("id int pk", "+ save(): bool"); empty for any
	// other shape.
	Rows string `json:"rows,omitempty"`
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
	// SrcColumn and DstColumn are the SQL table columns a link joins, by
	// index, when it joins columns rather than whole tables.
	SrcColumn *int `json:"srcColumn,omitempty"`
	DstColumn *int `json:"dstColumn,omitempty"`
}

type LayoutPoint struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

// layoutOf reads the geometry out of a laid-out diagram.
func layoutOf(diagram *d2target.Diagram, graph *d2graph.Graph) Layout {
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
			Rows:   rowsOf(shape),
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
		src, dst := columnsOf(graph, connection.ID)
		connections = append(connections, LayoutConnection{
			SrcColumn: src,
			DstColumn: dst,
			ID:        connection.ID,
			Src:       connection.Src,
			Dst:       connection.Dst,
			SrcArrow:  string(connection.SrcArrow),
			DstArrow:  string(connection.DstArrow),
			Label:     connection.Label,
			Route:     route,
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

// rowsOf writes a table's columns and a class's members as lines the canvas
// reads back (docs/file-format.md, "Tables and classes").
func rowsOf(shape d2target.Shape) string {
	var lines []string
	switch shape.Type {
	case d2target.ShapeSQLTable:
		for _, column := range shape.Columns {
			name := column.Name.Label
			// A name with a space is quoted, so its words stay one name.
			if strings.ContainsAny(name, " \t") {
				name = `"` + name + `"`
			}
			words := []string{name}
			if column.Type.Label != "" {
				words = append(words, column.Type.Label)
			}
			// Keys last, where the canvas reads them; any other constraint
			// before them, kept as part of the type rather than lost.
			var keys []string
			for _, constraint := range column.Constraint {
				switch constraint {
				case "primary_key":
					keys = append(keys, "pk")
				case "foreign_key":
					keys = append(keys, "fk")
				case "unique":
					keys = append(keys, "unique")
				default:
					words = append(words, constraint)
				}
			}
			lines = append(lines, strings.Join(append(words, keys...), " "))
		}
	case d2target.ShapeClass:
		member := func(visibility, name, kind string) string {
			line := visibilityMark(visibility) + " " + name
			if kind != "" {
				line += ": " + kind
			}
			return line
		}
		for _, field := range shape.Fields {
			lines = append(lines, member(field.Visibility, field.Name, field.Type))
		}
		for _, method := range shape.Methods {
			ret := method.Return
			if ret == "void" {
				ret = ""
			}
			lines = append(lines, member(method.Visibility, method.Name, ret))
		}
	}
	return strings.Join(lines, "\n")
}

// visibilityMark is the sign a class member is written with.
func visibilityMark(visibility string) string {
	switch visibility {
	case "private":
		return "-"
	case "protected":
		return "#"
	default:
		return "+"
	}
}

// columnsOf is the table columns the connection with this id joins, as D2's
// graph records them; nil where it joins a whole shape.
func columnsOf(graph *d2graph.Graph, id string) (src, dst *int) {
	if graph == nil {
		return nil, nil
	}
	for _, edge := range graph.Edges {
		if edge.AbsID() == id {
			return edge.SrcTableColumnIndex, edge.DstTableColumnIndex
		}
	}
	return nil, nil
}
