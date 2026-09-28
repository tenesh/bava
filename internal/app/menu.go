package app

import (
	"fmt"
	"sync"

	"github.com/wailsapp/wails/v3/pkg/application"

	"github.com/tenesh/bava/internal/app/menu"
)

// MenuCommandEvent is the one event a menu click raises. The frontend owns
// what each command does; the native menu only names it.
const MenuCommandEvent = "menu:command"

// MenuService owns the native menu bar and keeps it in step with the frontend.
//
// It is registered with the application before the menu exists, and built by
// InstallMenu afterwards: native role items read the application's name when they
// are constructed, so they cannot be made before application.New.
type MenuService struct {
	mu    sync.Mutex
	built *menu.Built
	// onMain runs a function on the main thread and waits for it: AppKit's
	// menu, like GTK's, may only be changed there, and bound methods run on
	// goroutines of their own.
	onMain func(func())
}

// NewMenuService constructs the service registered with the application.
func NewMenuService() *MenuService { return &MenuService{onMain: application.InvokeSync} }

// InstallMenu builds the menu bar for platform from the embedded spec, sets it
// as the application menu, and emits every click as MenuCommandEvent.
//
// A package function rather than a method, so it is not bound: the frontend
// reports state, it never builds menus. Call it after application.New.
func InstallMenu(wailsApp *application.App, s *MenuService, platform string) error {
	spec, err := menu.Load()
	if err != nil {
		return fmt.Errorf("load menu spec: %w", err)
	}
	built := menu.Build(spec.ForPlatform(platform), func(c menu.Command) {
		wailsApp.Event.Emit(MenuCommandEvent, c)
	})
	built.Apply(menu.State{})

	s.mu.Lock()
	s.built = built
	s.mu.Unlock()

	wailsApp.Menu.Set(built.Menu)
	return nil
}

// SetState makes checks, enabled items and recent files match the frontend.
// Before InstallMenu it does nothing: there is no menu to update yet.
func (s *MenuService) SetState(state menu.State) {
	s.mu.Lock()
	built := s.built
	s.mu.Unlock()
	if built == nil {
		return
	}
	// Checks, enabled items and any rebuild, all in one hop to the main
	// thread: a check set from here raced AppKit and crashed on macOS.
	s.onMain(func() {
		if built.Apply(state) {
			built.Menu.Update()
		}
	})
}
