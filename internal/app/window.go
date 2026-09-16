package app

import "github.com/wailsapp/wails/v3/pkg/application"

// Window dimensions.
//
// Four regions have to fit side by side — file tree, document, canvas, AI pane
// — and the design's artboard is 1280 wide for that reason. Narrower and the
// panes stop being usable rather than merely tight.
//
// The native background colour is deliberately not set here. The scaffold
// pinned it to a near-black, which fights the stylesheet's
// `color-scheme: light dark` and flashes dark behind a light page on launch.
// The webview paints its own background from the token layer instead.
const (
	WindowWidth  = 1280
	WindowHeight = 800
)

// MainWindowOptions are the options for Bava's one window.
func MainWindowOptions() application.WebviewWindowOptions {
	return application.WebviewWindowOptions{
		Title:  "Bava",
		Width:  WindowWidth,
		Height: WindowHeight,
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropTranslucent,
			TitleBar:                application.MacTitleBarHiddenInset,
		},
		URL: "/",
		// Windows shows the application menu only on a window that opts in.
		// Without this Windows has no menu bar, and so no Open, Save or Undo:
		// those live in the menu, not the title bar.
		UseApplicationMenu: true,
	}
}
