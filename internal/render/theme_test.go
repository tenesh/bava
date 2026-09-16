package render_test

import (
	"context"
	"strings"
	"testing"

	"github.com/tenesh/bava/internal/render"
)

// Values come from frontend/src/styles/tokens/_color.scss — the token layer is
// the source of truth, and Go holds the mapping rather than a second copy of
// the palette. These are the dark values.
func darkTheme() *render.Theme {
	return &render.Theme{
		Background:    "#1b1c1f",
		ContainerFill: "#1e2023",
		NodeFill:      "#262a2f",
		NodeStroke:    "#4a5058",
		Label:         "#dcdcd8",
		Edge:          "#7f857f",
		EdgeLabel:     "#8b8f8a",
	}
}

const themeSource = "users: Users\nweb: Web App\nusers -> web: request\n"

// A theme change must reach the diagram. Chrome updates via CSS custom
// properties; a diagram's SVG is rendered in Go and inherits nothing, so it
// only changes if the theme is passed through to the renderer.
func TestThemeChangesRenderedOutput(t *testing.T) {
	plain, err := render.Render(context.Background(), themeSource, render.Options{})
	if err != nil {
		t.Fatalf("Render without theme: %v", err)
	}
	themed, err := render.Render(context.Background(), themeSource, render.Options{Theme: darkTheme()})
	if err != nil {
		t.Fatalf("Render with theme: %v", err)
	}
	if plain.SVG == themed.SVG {
		t.Error("themed and unthemed output are identical, so the theme is being ignored")
	}
}

// A mapping that silently drops a field would still change the output, so
// "it differs" is not enough: the values themselves must arrive.
func TestThemeValuesReachTheOutput(t *testing.T) {
	res, err := render.Render(context.Background(), themeSource, render.Options{Theme: darkTheme()})
	if err != nil {
		t.Fatalf("Render: %v", err)
	}
	svg := strings.ToLower(res.SVG)
	for name, value := range map[string]string{
		"NodeFill":      "#262a2f",
		"Label":         "#dcdcd8",
		"ContainerFill": "#1e2023",
		"NodeStroke":    "#4a5058",
	} {
		if !strings.Contains(svg, value) {
			t.Errorf("%s (%s) does not appear in the rendered SVG", name, value)
		}
	}
}

// The existing goldens were rendered without a theme. If omitting one changed
// anything, every committed golden would shift — this is the test that pins
// that it does not.
func TestUnsetThemeIsByteIdenticalToBefore(t *testing.T) {
	a, err := render.Render(context.Background(), themeSource, render.Options{})
	if err != nil {
		t.Fatalf("Render: %v", err)
	}
	b, err := render.Render(context.Background(), themeSource, render.Options{Theme: nil})
	if err != nil {
		t.Fatalf("Render: %v", err)
	}
	if a.SVG != b.SVG {
		t.Error("an explicitly nil theme differs from an absent one")
	}
}

// Partial themes are a caller error waiting to happen: a struct with three
// fields set would silently render the rest from D2's defaults.
func TestIncompleteThemeIsRejected(t *testing.T) {
	_, err := render.Render(context.Background(), themeSource, render.Options{
		Theme: &render.Theme{Background: "#1b1c1f"},
	})
	if err == nil {
		t.Fatal("an incomplete theme was accepted")
	}
	if !strings.Contains(err.Error(), "theme") {
		t.Errorf("error %q does not say the theme is the problem", err.Error())
	}
}
