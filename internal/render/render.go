// Package render is the one path from D2 source to a rendered diagram.
//
// It owns parse, layout, render and text measurement. There is deliberately a
// single entry point: a second render path (for previews, exports or
// thumbnails) would drift from this one and produce output that differs from
// what the user saw.
package render

import (
	"context"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"regexp"

	"github.com/d2lang/d2/d2graph"
	"github.com/d2lang/d2/d2lib"
	"github.com/d2lang/d2/d2parser"
	"github.com/d2lang/d2/d2renderers/d2svg"
	d2log "github.com/d2lang/d2/lib/log"
	"github.com/d2lang/d2/lib/textmeasure"

	"github.com/tenesh/bava/internal/layout"
)

// Options selects how a diagram is rendered. It is an options struct rather
// than a widening parameter list because every field here crosses the IPC
// boundary, and adding one must not change the binding's signature.
type Options struct {
	// Engine names the layout algorithm. Empty selects layout.DefaultEngine.
	Engine string `json:"engine"`
	// Theme carries the diagram colours. Nil renders D2's own defaults, which
	// is what every golden committed before theming was added expects.
	Theme *Theme `json:"theme,omitempty"`
}

// Span locates something in the source.
//
// From and To are offsets in UTF-16 code units, which is how JavaScript and
// CodeMirror index a document, not byte offsets. Line is 1-indexed; D2's own
// lines are 0-indexed and the conversion happens here, once, so nothing
// downstream repeats it.
type Span struct {
	From int `json:"from"`
	To   int `json:"to"`
	Line int `json:"line"`
}

// Diagnostic is one compiler complaint about the source.
type Diagnostic struct {
	Message string `json:"message"`
	From    int    `json:"from"`
	To      int    `json:"to"`
	Line    int    `json:"line"`
}

// Result is the whole response to a render request.
type Result struct {
	// SVG is the rendered diagram, with no XML declaration so it can be
	// injected directly into the DOM node the canvas owns. Empty when the
	// source did not compile.
	SVG string `json:"svg"`
	// Errors carries compile diagnostics. A failed compile is an expected
	// state, not a failed call: the caller keeps the last good diagram on
	// screen and shows these.
	Errors []Diagnostic `json:"errors"`
	// NodeMap maps SVG element id to the source that produced it.
	NodeMap map[string]Span `json:"nodeMap"`
	// Layout is the geometry the canvas builds shapes from. Empty when the
	// source did not compile.
	Layout Layout `json:"layout"`
}

// Render compiles, lays out and renders source.
//
// A returned error means the request itself was malformed: an unknown engine,
// a ruler that would not initialise. Problems with the diagram text come back
// in Result.Errors with the call succeeding.
func Render(ctx context.Context, source string, opts Options) (Result, error) {
	engine, err := layout.Resolve(opts.Engine)
	if err != nil {
		return Result{}, err
	}

	ruler, err := textmeasure.NewRuler()
	if err != nil {
		return Result{}, fmt.Errorf("create text ruler: %w", err)
	}

	// d2lib.Compile pulls a logger from the context and dumps a full stack
	// trace to stderr when there is not one. Library code does not write to
	// stderr, so the default discards.
	ctx = d2log.With(ctx, discardLogger())

	renderOpts := &d2svg.RenderOpts{
		NoXMLTag:    boolPtr(true),
		OmitVersion: boolPtr(true),
	}

	if opts.Theme != nil {
		if err := opts.Theme.validate(); err != nil {
			return Result{}, err
		}
		renderOpts.ThemeOverrides = opts.Theme.overrides()
	}

	engineName := engine.Name
	diagram, graph, err := d2lib.Compile(ctx, source, &d2lib.CompileOptions{
		// Positions must be counted the way the consumer counts.
		// D2 reports UTF-8 byte offsets by default; JavaScript (and so
		// CodeMirror) indexes strings in UTF-16 code units. Without this, a
		// single non-ASCII label shifts every diagnostic and every jump-to-
		// source by the number of extra bytes ahead of it.
		UTF16Pos:       true,
		Ruler:          ruler,
		Layout:         &engineName,
		LayoutResolver: layout.Resolver(),
		// FS stays nil: imports are not supported yet, and an unrooted FS over
		// user-supplied paths would let a .d2 file read anywhere on disk.
	}, renderOpts)
	if err != nil {
		if diags := diagnostics(err); len(diags) > 0 {
			// The diagram did not compile. That is an expected state, not a
			// failed call: the caller keeps the last good SVG on screen.
			return Result{Errors: diags, Layout: layoutOf(nil)}, nil
		}
		return Result{}, fmt.Errorf("compile: %w", err)
	}

	svg, err := d2svg.Render(diagram, renderOpts)
	if err != nil {
		return Result{}, fmt.Errorf("render svg: %w", err)
	}

	return Result{SVG: string(svg), NodeMap: nodeMap(graph), Layout: layoutOf(diagram)}, nil
}

// nodeMap maps each object's SVG element id to where it was declared.
//
// Keyed by SVG id rather than by source position: click-on-node is then a
// direct lookup, and highlighting a shape from a diagnostic is a reverse scan,
// which is cheap at the diagram sizes this canvas supports.
func nodeMap(graph *d2graph.Graph) map[string]Span {
	if graph == nil {
		return nil
	}
	out := make(map[string]Span, len(graph.Objects))
	for _, obj := range graph.Objects {
		span, ok := declarationSpan(obj)
		if !ok {
			continue
		}
		out[obj.AbsID()] = span
	}
	return out
}

// declarationSpan locates where an object was declared. An object can be
// referenced several times (`web.api` is both declared inside `web` and named
// again by an edge), and jumping to source should land on the declaration, so
// the earliest reference wins.
func declarationSpan(obj *d2graph.Object) (Span, bool) {
	var best Span
	found := false
	for _, ref := range obj.References {
		if ref.Key == nil || ref.KeyPathIndex >= len(ref.Key.Path) {
			continue
		}
		// The key path segment, not the whole path: for `web.api` the object
		// is the `api` segment alone.
		r := ref.Key.Path[ref.KeyPathIndex].Unbox().GetRange()
		span := Span{From: r.Start.Byte, To: r.End.Byte, Line: r.Start.Line + 1}
		if span.To < span.From {
			span.To = span.From
		}
		if !found || span.From < best.From {
			best, found = span, true
		}
	}
	return best, found
}

// positionPrefix matches the "3:9: " that D2 prepends to its messages. The
// position is carried structurally in Diagnostic, so repeating it in the text
// is noise next to a marked line.
var positionPrefix = regexp.MustCompile(`^\d+:\d+: `)

// diagnostics flattens a D2 compile failure into displayable diagnostics.
// Returns nil if err is not a compile failure, which means the caller should
// treat it as a real error.
func diagnostics(err error) []Diagnostic {
	var parseErr *d2parser.ParseError
	if !errors.As(err, &parseErr) {
		return nil
	}
	diags := make([]Diagnostic, 0, len(parseErr.Errors))
	for _, e := range parseErr.Errors {
		from, to := e.Range.Start.Byte, e.Range.End.Byte
		if to < from {
			to = from
		}
		diags = append(diags, Diagnostic{
			Message: positionPrefix.ReplaceAllString(e.Message, ""),
			// UTF-16 code units, because UTF16Pos is set on the compile.
			From: from,
			To:   to,
			// D2 counts lines from zero; editors count from one. Convert here,
			// once, so nothing downstream repeats or doubles it.
			Line: e.Range.Start.Line + 1,
		})
	}
	return diags
}

func discardLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func boolPtr(b bool) *bool { return &b }
