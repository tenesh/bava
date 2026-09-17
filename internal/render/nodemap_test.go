package render_test

import (
	"context"
	"testing"
	"unicode/utf16"

	"github.com/tenesh/bava/internal/render"
)

// Nested so the test covers a container child, whose SVG id ("web.api") is not
// the same string as its source text ("api"). That difference is where a naive
// implementation goes wrong.
const nestedSource = `users: Users
web: Web App {
  api: API
}
users -> web.api: request
`

// The strongest available assertion: slice the source with the span and get the
// identifier back. It fails if the offsets drift by a single byte, which a
// looser "is it roughly right" check would not catch.
func TestNodeMapSpansSliceTheSourceIdentifier(t *testing.T) {
	res, err := render.Render(context.Background(), nestedSource, render.Options{})
	if err != nil {
		t.Fatalf("Render returned error: %v", err)
	}
	for id, want := range map[string]string{
		"users":   "users",
		"web":     "web",
		"web.api": "api",
	} {
		span, ok := res.NodeMap[id]
		if !ok {
			t.Errorf("NodeMap has no entry for %q", id)
			continue
		}
		if span.From < 0 || span.To > len(nestedSource) || span.From > span.To {
			t.Errorf("%q: span [%d,%d) is not a valid range into a source of length %d", id, span.From, span.To, len(nestedSource))
			continue
		}
		if got := nestedSource[span.From:span.To]; got != want {
			t.Errorf("%q: source[%d:%d] = %q, want %q", id, span.From, span.To, got, want)
		}
	}
}

// Every shape the user can click must be resolvable back to source, or
// click-to-jump silently does nothing for some nodes.
func TestNodeMapCoversEveryRenderedShape(t *testing.T) {
	res, err := render.Render(context.Background(), nestedSource, render.Options{})
	if err != nil {
		t.Fatalf("Render returned error: %v", err)
	}
	if len(res.NodeMap) == 0 {
		t.Fatal("NodeMap is empty")
	}
	for _, id := range []string{"users", "web", "web.api"} {
		if _, ok := res.NodeMap[id]; !ok {
			t.Errorf("NodeMap is missing rendered shape %q", id)
		}
	}
}

func TestNodeMapLinesAreOneIndexed(t *testing.T) {
	res, err := render.Render(context.Background(), nestedSource, render.Options{})
	if err != nil {
		t.Fatalf("Render returned error: %v", err)
	}
	for id, want := range map[string]int{
		"users":   1,
		"web":     2,
		"web.api": 3,
	} {
		span, ok := res.NodeMap[id]
		if !ok {
			t.Errorf("NodeMap has no entry for %q", id)
			continue
		}
		if span.Line != want {
			t.Errorf("%q: Line = %d, want %d", id, span.Line, want)
		}
	}
}

// Positions cross the boundary in UTF-16 code units, because that is how
// JavaScript indexes a string. Measured in UTF-8 bytes, `web` in this source
// sits at 13; in UTF-16 it sits at 11. A frontend that trusts byte offsets
// puts every marker two characters out as soon as one label is non-ASCII,
// and an all-ASCII test suite never notices.
const nonASCIISource = "café: Café\nweb: Web\ncafé -> web\n"

func TestNodeMapSpansAreUTF16Offsets(t *testing.T) {
	res, err := render.Render(context.Background(), nonASCIISource, render.Options{})
	if err != nil {
		t.Fatalf("Render returned error: %v", err)
	}
	units := utf16.Encode([]rune(nonASCIISource))
	for id, want := range map[string]string{"café": "café", "web": "web"} {
		span, ok := res.NodeMap[id]
		if !ok {
			t.Errorf("NodeMap has no entry for %q", id)
			continue
		}
		if span.From < 0 || span.To > len(units) || span.From > span.To {
			t.Errorf("%q: span [%d,%d) is not valid in a document of %d UTF-16 units", id, span.From, span.To, len(units))
			continue
		}
		if got := string(utf16.Decode(units[span.From:span.To])); got != want {
			t.Errorf("%q: source[%d:%d] measured in UTF-16 = %q, want %q", id, span.From, span.To, got, want)
		}
	}
}
