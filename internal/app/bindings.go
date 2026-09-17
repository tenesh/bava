// Package app is the native surface the frontend can call.
//
// It stays deliberately thin: file I/O, window management, and the D2
// pipeline. Everything else lives in the frontend. Every bound method is API
// that must survive a Wails beta upgrade, so the surface is kept small on
// purpose.
package app

import (
	"context"
	"log/slog"
	"time"

	"github.com/tenesh/bava/internal/render"
)

// RenderService is the one render surface. Resist adding a second — a preview,
// export or thumbnail renderer would drift from this one and produce output
// that differs from what the user saw.
type RenderService struct{}

// NewRenderService constructs the service registered with the application.
func NewRenderService() *RenderService { return &RenderService{} }

// Render compiles D2 source and returns the SVG, any diagnostics, and the map
// from SVG element id to source position.
//
// A returned error means the request was malformed. Source that does not
// compile is not an error: it comes back in Result.Errors, and the frontend
// keeps the last good diagram on screen.
func (s *RenderService) Render(source string, opts render.Options) (render.Result, error) {
	started := time.Now()
	result, err := render.Render(context.Background(), source, opts)
	// Sizes and timings only: never the source, the SVG or a diagnostic's
	// message, which quotes the source.
	slog.Debug("render",
		"engine", opts.Engine,
		"sourceBytes", len(source),
		"diagnostics", len(result.Errors),
		"nodes", len(result.NodeMap),
		"failed", err != nil,
		"duration", time.Since(started),
	)
	return result, err
}
