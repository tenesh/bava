package app

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
