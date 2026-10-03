package app_test

import (
	"testing"

	"github.com/tenesh/bava/internal/app"
	"github.com/tenesh/bava/internal/render"
)

// Compile failures must reach the frontend as data on a successful call.
func TestServiceReturnsDiagnosticsWithoutError(t *testing.T) {
	svc := app.NewRenderService()
	res, err := svc.Render("broken: {", render.Options{})
	if err != nil {
		t.Fatalf("service returned a transport error for a compile failure: %v", err)
	}
	if len(res.Errors) == 0 {
		t.Error("service returned no diagnostics for source that does not compile")
	}
}

func TestServiceRendersValidSource(t *testing.T) {
	svc := app.NewRenderService()
	res, err := svc.Render("a -> b", render.Options{})
	if err != nil {
		t.Fatalf("service returned error: %v", err)
	}
	if res.SVG == "" {
		t.Error("service returned empty SVG for valid source")
	}
}
