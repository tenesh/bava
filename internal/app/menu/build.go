package menu

import (
	"runtime"
	"slices"
	"strings"
	"sync"

	"github.com/wailsapp/wails/v3/pkg/application"
)

// Command is what a menu click sends to the frontend.
type Command struct {
	ID string `json:"id"`
	// Arg carries data a command needs: the path, for a recent file.
	Arg string `json:"arg,omitempty"`
}

// State is what the frontend reports so the menu reflects the app.
type State struct {
	ViewMode     string `json:"viewMode"`
	ShowsFiles   bool   `json:"showsFiles"`
	ShowsAI      bool   `json:"showsAI"`
	Theme        string `json:"theme"`
	Tool         string `json:"tool"`
	HasSelection bool   `json:"hasSelection"`
	// CanPasteStyles reports a style copied with Copy Styles.
	CanPasteStyles bool `json:"canPasteStyles"`
	// HasLocked reports at least one locked element in the scene.
	HasLocked bool     `json:"hasLocked"`
	Recents   []string `json:"recents"`
}

// Built is a constructed menu bar and handles to the items state changes.
type Built struct {
	Menu *application.Menu

	mu       sync.Mutex
	items    map[string]*application.MenuItem
	recents  *application.Menu
	emit     func(Command)
	addRole  func(*application.Menu, application.Role)
	platform string
	// native records items whose shortcut is a real accelerator here.
	native map[string]bool
	// shown is the recents list the menu currently displays; nil until the
	// first Apply, so the placeholder is built once.
	shown []string
}

// Options adjust how a menu is built.
type Options struct {
	// AddRole adds a native role item. Defaults to the real one. Tests replace
	// it: Wails' role constructors read the running application's name and
	// panic without one.
	AddRole func(*application.Menu, application.Role)
	// Platform formats shortcut labels. Defaults to runtime.GOOS.
	Platform string
}

var roles = map[string]application.Role{
	"ServicesMenu": application.ServicesMenu, "Hide": application.Hide,
	"HideOthers": application.HideOthers, "ShowAll": application.ShowAll,
	"Quit": application.Quit, "CloseWindow": application.CloseWindow,
	"Cut": application.Cut, "Copy": application.Copy, "Paste": application.Paste,
	"ToggleFullscreen": application.ToggleFullscreen, "Minimise": application.Minimise,
	"Zoom": application.Zoom, "BringAllToFront": application.BringAllToFront,
}

// Build constructs the menu bar for a platform-filtered spec. emit is called
// with a Command whenever a dispatchable item is clicked.
func Build(spec Spec, emit func(Command), options ...Options) *Built {
	addRole := func(m *application.Menu, r application.Role) { m.AddRole(r) }
	platform := runtime.GOOS
	for _, o := range options {
		if o.AddRole != nil {
			addRole = o.AddRole
		}
		if o.Platform != "" {
			platform = o.Platform
		}
	}

	built := &Built{
		Menu:     application.NewMenu(),
		items:    map[string]*application.MenuItem{},
		emit:     emit,
		addRole:  addRole,
		platform: platform,
		native:   map[string]bool{},
	}
	for _, m := range spec.Menus {
		built.addItems(built.Menu.AddSubmenu(m.Label), m.Items)
	}
	return built
}

func (b *Built) addItems(parent *application.Menu, items []Item) {
	for _, item := range items {
		switch item.Kind {
		case KindSeparator:
			parent.AddSeparator()

		case KindSubmenu:
			b.addItems(parent.AddSubmenu(item.Label), item.Items)

		case KindRecents:
			b.recents = parent.AddSubmenu(item.Label)

		case KindRole:
			if role, ok := roles[item.Role]; ok {
				b.addRole(parent, role)
			}

		case KindRadio, KindCheckbox, KindCommand:
			label := item.Label
			native := item.Shortcut != "" && slices.Contains(item.NativeOn, b.platform)
			// Only Windows right-aligns text after a tab in a menu label; macOS
			// and GTK print it as spacing, mid-row. Elsewhere the label stays
			// plain and Help ▸ Keyboard Shortcuts lists the keys.
			if b.platform == "windows" {
				switch {
				case item.Hint != "":
					label += "\t" + item.Hint
				case item.Shortcut != "":
					label += "\t" + FormatShortcut(item.Shortcut, b.platform)
				}
			}

			var menuItem *application.MenuItem
			switch item.Kind {
			case KindRadio:
				menuItem = parent.AddRadio(label, false)
			case KindCheckbox:
				menuItem = parent.AddCheckbox(label, false)
			default:
				menuItem = parent.Add(label)
			}
			switch {
			case item.Accelerator != "":
				menuItem.SetAccelerator(item.Accelerator)
			case native:
				menuItem.SetAccelerator(item.Shortcut)
				b.native[item.ID] = true
			}

			id := item.ID
			menuItem.OnClick(func(*application.Context) { b.emit(Command{ID: id}) })
			b.items[id] = menuItem
		}
	}
}

// IsNativeShortcut reports whether id's shortcut is bound natively on this
// platform rather than handled by the frontend.
func (b *Built) IsNativeShortcut(id string) bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.native[id]
}

// Item returns the handle for id, for tests and state updates.
func (b *Built) Item(id string) *application.MenuItem {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.items[id]
}

// Apply updates checks, enabled state and the recents submenu to match state.
//
// It reports whether the native menu must be rebuilt with Menu.Update. Checks
// and enabled state reach the native items directly; only a changed recents
// list alters the menu's structure. Rebuilding on every tool switch would be
// wasteful everywhere and, on Linux, a GTK call off the main thread.
func (b *Built) Apply(state State) bool {
	b.mu.Lock()
	defer b.mu.Unlock()

	check := func(id string, on bool) {
		if item := b.items[id]; item != nil {
			item.SetChecked(on)
		}
	}
	enable := func(id string, on bool) {
		if item := b.items[id]; item != nil {
			item.SetEnabled(on)
		}
	}

	for _, mode := range []string{"document", "both", "canvas"} {
		check("view."+mode, state.ViewMode == mode)
	}
	check("view.files", state.ShowsFiles)
	check("view.ai", state.ShowsAI)
	for _, theme := range []string{"light", "dark", "system"} {
		check("view.theme."+theme, state.Theme == theme)
	}
	for id := range b.items {
		if len(id) > 5 && id[:5] == "tool." {
			check(id, id == "tool."+state.Tool)
		}
	}
	for _, id := range []string{
		"canvas.group", "canvas.ungroup",
		"canvas.bringToFront", "canvas.bringForward", "canvas.sendBackward", "canvas.sendToBack",
		"canvas.flipHorizontal", "canvas.flipVertical", "canvas.duplicate",
		"canvas.alignLeft", "canvas.alignCenter", "canvas.alignRight",
		"canvas.alignTop", "canvas.alignMiddle", "canvas.alignBottom",
		"canvas.distributeHorizontal", "canvas.distributeVertical",
		"canvas.copyStyles",
	} {
		enable(id, state.HasSelection)
	}
	enable("canvas.pasteStyles", state.HasSelection && state.CanPasteStyles)
	enable("canvas.lock", state.HasSelection)
	enable("canvas.unlockAll", state.HasLocked)

	if b.recents == nil || (b.shown != nil && slices.Equal(b.shown, state.Recents)) {
		return false
	}
	b.shown = append([]string{}, state.Recents...)
	b.recents.Clear()
	if len(state.Recents) == 0 {
		b.recents.Add("No Recent Files").SetEnabled(false)
	}
	for _, path := range state.Recents {
		p := path
		b.recents.Add(p).OnClick(func(*application.Context) {
			b.emit(Command{ID: "file.openRecent", Arg: p})
		})
	}
	return true
}

var macSymbols = map[string]string{"ctrl": "⌃", "optionoralt": "⌥", "shift": "⇧", "cmdorctrl": "⌘"}
var macOrder = []string{"ctrl", "optionoralt", "shift", "cmdorctrl"}
var otherNames = map[string]string{"cmdorctrl": "Ctrl", "ctrl": "Ctrl", "shift": "Shift", "optionoralt": "Alt"}
var otherOrder = []string{"cmdorctrl", "ctrl", "shift", "optionoralt"}

// FormatShortcut renders an accelerator-syntax shortcut for display, the way
// the platform's own menus would. frontend/src/shell/shortcuts.ts formats the
// same way for the Shortcuts dialog.
func FormatShortcut(shortcut, platform string) string {
	parts := strings.Split(shortcut, "+")
	key := parts[len(parts)-1]
	if len(key) == 1 {
		key = strings.ToUpper(key)
	}
	mods := map[string]bool{}
	for _, m := range parts[:len(parts)-1] {
		mods[strings.ToLower(m)] = true
	}
	if platform == "darwin" {
		var out strings.Builder
		for _, m := range macOrder {
			if mods[m] {
				out.WriteString(macSymbols[m])
			}
		}
		return out.String() + key
	}
	var names []string
	for _, m := range otherOrder {
		if mods[m] {
			names = append(names, otherNames[m])
		}
	}
	return strings.Join(append(names, key), "+")
}
