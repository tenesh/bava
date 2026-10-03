package app

// In package app to build a MenuService with a stand-in for the main thread
// (its built and onMain fields).

import (
	"testing"

	"github.com/wailsapp/wails/v3/pkg/application"

	"github.com/tenesh/bava/internal/app/menu"
)

// The frontend may report state before the menu bar exists; that must not
// crash the app on launch. It checks only that nothing panics.
func TestMenuStateBeforeBuildIsIgnored(t *testing.T) {
	NewMenuService().SetState(menu.State{ViewMode: "both"})
}

// AppKit's menu must only be changed on the main thread: a check set from a
// bound call's goroutine crashed the app on macOS. The whole update runs in
// one hop to the main thread.
func TestMenuStateIsAppliedOnTheMainThread(t *testing.T) {
	spec, err := menu.Load()
	if err != nil {
		t.Fatal(err)
	}
	built := menu.Build(spec.ForPlatform("darwin"), func(menu.Command) {}, menu.Options{
		Platform: "darwin",
		// Wails' role constructors need a running application.
		AddRole: func(*application.Menu, application.Role) {},
	})
	var queued []func()
	s := &MenuService{built: built, onMain: func(fn func()) { queued = append(queued, fn) }}

	s.SetState(menu.State{ViewMode: "canvas"})
	if built.Item("view.canvas").Checked() {
		t.Fatal("the menu changed off the main thread")
	}
	if len(queued) != 1 {
		t.Fatalf("%d hops to the main thread; want 1", len(queued))
	}
	queued[0]()
	if !built.Item("view.canvas").Checked() {
		t.Error("the state was not applied on the main thread")
	}
}
