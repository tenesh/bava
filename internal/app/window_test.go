package app_test

import (
	"os"
	"regexp"
	"strconv"
	"strings"
	"testing"

	"github.com/wailsapp/wails/v3/pkg/application"

	"github.com/tenesh/bava/internal/app"
)

// Pinned rather than asserted for correctness: the point is that a later edit
// to the window size is a deliberate act with a test to update, not a silent
// drift back to something too narrow for four panes.
func TestWindowFitsFourRegions(t *testing.T) {
	if app.WindowWidth < 1280 {
		t.Errorf("WindowWidth = %d, want at least 1280, the width the shell was designed against", app.WindowWidth)
	}
	if app.WindowHeight < 800 {
		t.Errorf("WindowHeight = %d, want at least 800", app.WindowHeight)
	}
}

// Linux falls back to the application menu; Windows does not. Losing this
// flag leaves Windows with no way to open or save a file.
func TestWindowUsesTheApplicationMenu(t *testing.T) {
	if !app.MainWindowOptions().UseApplicationMenu {
		t.Error("UseApplicationMenu is false: Windows would show no menu bar")
	}
}

// When the webview's content process dies the window goes blank. Bava logs it,
// reloads, and tells the user once the page is back.
func TestContentProcessDeathLogsQueuesAndReloads(t *testing.T) {
	service, session, _ := logService(t)
	reloaded := 0

	app.ContentProcessDied(service, func() { reloaded++ })

	if reloaded != 1 {
		t.Errorf("reloaded %d times, want 1", reloaded)
	}
	if !strings.Contains(logText(t, session), "webview content process") {
		t.Error("the termination was not logged")
	}
	notices := service.TakeNotices()
	if len(notices) != 1 || notices[0].Kind != app.NoticeWebviewReloaded {
		t.Errorf("notices = %+v, want one webview-reloaded notice", notices)
	}
}

// The inset title bar positions the traffic lights for a ~52pt toolbar; Bava's
// bar is 36px, so they sat below its content and touched its border (seen at
// a running window, 2026-09-17). The standard hidden title bar centres them
// near a 36px bar, and the draggable strip is exactly the bar.
func TestMacTitleBarIsStandardAndMatchesTheBar(t *testing.T) {
	mac := app.MainWindowOptions().Mac
	if mac.TitleBar != application.MacTitleBarHidden {
		t.Errorf("TitleBar = %+v, want MacTitleBarHidden", mac.TitleBar)
	}
	if mac.InvisibleTitleBarHeight != app.TitleBarHeight {
		t.Errorf("InvisibleTitleBarHeight = %d, want the title bar's %d", mac.InvisibleTitleBarHeight, app.TitleBarHeight)
	}
	// The page draws the bar from the --size-titlebar token; the window's
	// draggable strip must follow it if the token changes.
	tokens, err := os.ReadFile("../../frontend/src/styles/tokens/_space.scss")
	if err != nil {
		t.Fatal(err)
	}
	match := regexp.MustCompile(`--size-titlebar:\s*(\d+)px;`).FindSubmatch(tokens)
	if match == nil {
		t.Fatal("--size-titlebar not found in _space.scss")
	}
	if want, _ := strconv.Atoi(string(match[1])); app.TitleBarHeight != want {
		t.Errorf("TitleBarHeight = %d, want --size-titlebar's %d", app.TitleBarHeight, want)
	}
}
