package app

import "github.com/wailsapp/wails/v3/pkg/application"

// Window dimensions.
//
// Four regions have to fit side by side (file tree, document, canvas, AI
// pane), and the design's artboard is 1280 wide for that reason. Narrower
// and the panes stop being usable rather than merely tight.
//
// The native background colour is deliberately not set here. The scaffold
// pinned it to a near-black, which fights the stylesheet's
// `color-scheme: light dark` and flashes dark behind a light page on launch.
// The webview paints its own background from the token layer instead.
const (
	WindowWidth  = 1280
	WindowHeight = 800
)

// TitleBarHeight is the page's title bar height in CSS pixels
// (--size-titlebar), which the macOS window's draggable strip matches.
const TitleBarHeight = 36

// MainWindowOptions are the options for Bava's one window.
func MainWindowOptions() application.WebviewWindowOptions {
	return application.WebviewWindowOptions{
		Title:  "Bava",
		Width:  WindowWidth,
		Height: WindowHeight,
		Mac: application.MacWindow{
			// The draggable strip is exactly the page's title bar.
			InvisibleTitleBarHeight: TitleBarHeight,
			Backdrop:                application.MacBackdropTranslucent,
			// Not the inset variant: its toolbar places the traffic lights for a
			// ~52pt bar, below the content of Bava's 36px one.
			TitleBar: application.MacTitleBarHidden,
		},
		URL: "/",
		// Windows shows the application menu only on a window that opts in.
		// Without this Windows has no menu bar, and so no Open, Save or Undo:
		// those live in the menu, not the title bar.
		UseApplicationMenu: true,
	}
}

// ContentProcessDied handles the webview's content process terminating. On
// macOS, WKWebView reports it and the window is left blank. It logs, queues a
// notice so the reloaded page can say what happened, and reloads.
//
// Wails v3.0.0-beta.20 exposes this event on macOS only. WebView2's
// ProcessFailed and WebKitGTK's equivalent are not surfaced, so on Windows and
// Linux a dead content process still leaves a blank window.
func ContentProcessDied(service *LogService, reload func()) {
	service.logger().Error("webview content process terminated; reloading the window")
	service.addNotice(Notice{Kind: NoticeWebviewReloaded})
	reload()
}
