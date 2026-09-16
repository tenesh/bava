package main

import (
	"embed"
	"log"

	"github.com/wailsapp/wails/v3/pkg/application"

	"github.com/tenesh/bava/internal/app"
)

// Wails uses Go's `embed` package to embed the frontend files into the binary.
// Any files in the frontend/dist folder will be embedded into the binary and
// made available to the frontend.
// See https://pkg.go.dev/embed for more information.

//go:embed all:frontend/dist
var assets embed.FS

// main creates the application, registers the render service, and opens the
// window. The native surface stays thin on purpose: the render pipeline and
// file I/O live in internal/, everything else in the frontend.
func main() {
	wailsApp := application.New(application.Options{
		Name:        "bava",
		Description: "Local-only diagrams and docs",
		Services: []application.Service{
			application.NewService(app.NewRenderService()),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	wailsApp.Window.NewWithOptions(application.WebviewWindowOptions{
		Title: "Bava",
		// Window sized to the golden ratio (1000 / 618 ≈ 1.618).
		Width:  1000,
		Height: 618,
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropTranslucent,
			TitleBar:                application.MacTitleBarHiddenInset,
		},
		// No BackgroundColour: the stylesheet sets `color-scheme: light dark`, so
		// pinning a near-black native background would flash dark behind a light
		// page on launch. Milestone 2's Go-side theme mapping owns this.
		URL: "/",
	})

	// Blocks until the application exits.
	if err := wailsApp.Run(); err != nil {
		log.Fatal(err)
	}
}
