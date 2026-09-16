package main

import (
	"embed"
	"log"
	"runtime"

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
	menus := app.NewMenuService()
	wailsApp := application.New(application.Options{
		// Wails builds the native role labels from this — "Hide Bava", "Quit Bava".
		Name:        "Bava",
		Description: "Local-only diagrams and docs",
		Services: []application.Service{
			application.NewService(app.NewRenderService()),
			application.NewService(app.NewFileService()),
			application.NewService(menus),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	// After application.New: native role items need the application.
	if err := app.InstallMenu(wailsApp, menus, runtime.GOOS); err != nil {
		log.Fatal(err)
	}

	wailsApp.Window.NewWithOptions(app.MainWindowOptions())

	// Blocks until the application exits.
	if err := wailsApp.Run(); err != nil {
		log.Fatal(err)
	}
}
