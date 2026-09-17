package app_test

import (
	"strings"
	"testing"

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
