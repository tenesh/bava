// Package menu builds the native application menu from a declarative spec.
//
// The menu is data, in spec.json, read by Go to build the menu bar and by the
// frontend's tests to check that every command has a handler. A later item is
// a spec entry plus a handler; nothing in the wiring changes.
package menu

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"strings"
)

//go:embed spec.json
var specJSON []byte

// Kinds of menu item.
const (
	KindCommand   = "command"   // emits its id when clicked
	KindRadio     = "radio"     // emits its id; one checked per group
	KindCheckbox  = "checkbox"  // emits its id; toggles
	KindRole      = "role"      // a native platform behaviour
	KindSubmenu   = "submenu"   // holds items
	KindSeparator = "separator" // a divider
	KindRecents   = "recents"   // a submenu filled at runtime
)

// Platforms Bava ships on, as runtime.GOOS spells them.
var Platforms = []string{"darwin", "windows", "linux"}

// Item is one entry in a menu.
type Item struct {
	Kind        string `json:"kind"`
	ID          string `json:"id,omitempty"`
	Label       string `json:"label,omitempty"`
	Accelerator string `json:"accelerator,omitempty"`
	// Hint is a shortcut shown in the label but not bound natively: tool
	// letters and Delete, which a native accelerator would steal from text
	// fields.
	Hint string `json:"hint,omitempty"`
	// Shortcut is a modifier shortcut the frontend handles, shown in the label
	// formatted for the platform but not bound natively. Used for punctuation
	// keys, which Wails on Windows cannot match as accelerators.
	Shortcut string `json:"shortcut,omitempty"`
	// NativeOn lists platforms where Shortcut is bound as a real accelerator
	// instead: the menu handles and aligns it, and the frontend stands down.
	NativeOn []string `json:"nativeOn,omitempty"`
	// Scope "canvas" limits Shortcut to when the canvas has the keyboard: the
	// frontend ignores it while a text field or the source editor has focus,
	// and the source editor keeps the key.
	Scope     string   `json:"scope,omitempty"`
	Role      string   `json:"role,omitempty"`
	Group     string   `json:"group,omitempty"`
	Platforms []string `json:"platforms,omitempty"`
	Items     []Item   `json:"items,omitempty"`
}

// Menu is a top-level menu.
type Menu struct {
	ID        string   `json:"id"`
	Label     string   `json:"label"`
	Platforms []string `json:"platforms,omitempty"`
	Items     []Item   `json:"items"`
}

// Spec is the whole menu bar.
type Spec struct {
	Menus []Menu `json:"menus"`
}

// Load parses the embedded spec.
func Load() (Spec, error) {
	var spec Spec
	if err := json.Unmarshal(specJSON, &spec); err != nil {
		return Spec{}, fmt.Errorf("menu spec: %w", err)
	}
	return spec, nil
}

func onPlatform(platforms []string, platform string) bool {
	if len(platforms) == 0 {
		return true
	}
	for _, p := range platforms {
		if p == platform {
			return true
		}
	}
	return false
}

// ForPlatform returns the spec with everything not meant for platform removed.
func (s Spec) ForPlatform(platform string) Spec {
	var out Spec
	for _, m := range s.Menus {
		if !onPlatform(m.Platforms, platform) {
			continue
		}
		out.Menus = append(out.Menus, Menu{
			ID:    m.ID,
			Label: m.Label,
			Items: filterItems(m.Items, platform),
		})
	}
	return out
}

func filterItems(items []Item, platform string) []Item {
	var out []Item
	for _, item := range items {
		if !onPlatform(item.Platforms, platform) {
			continue
		}
		if len(item.Items) > 0 {
			item.Items = filterItems(item.Items, platform)
		}
		out = append(out, item)
	}
	return out
}

// AllItems flattens every item, submenus included.
func (s Spec) AllItems() []Item {
	var out []Item
	var walk func([]Item)
	walk = func(items []Item) {
		for _, item := range items {
			out = append(out, item)
			walk(item.Items)
		}
	}
	for _, m := range s.Menus {
		walk(m.Items)
	}
	return out
}

// Find returns the item with id, or nil.
func (s Spec) Find(id string) *Item {
	for _, item := range s.AllItems() {
		if item.ID == id {
			found := item
			return &found
		}
	}
	return nil
}

// CommandIDs lists every id the frontend must handle.
func (s Spec) CommandIDs() []string {
	var ids []string
	for _, item := range s.AllItems() {
		switch item.Kind {
		case KindCommand, KindRadio, KindCheckbox, KindRecents:
			ids = append(ids, item.ID)
		}
	}
	return ids
}

var modifiers = map[string]bool{
	"cmdorctrl": true, "cmd": true, "ctrl": true, "optionoralt": true,
	"alt": true, "option": true, "shift": true, "super": true,
}

var namedKeys = map[string]bool{
	"backspace": true, "tab": true, "return": true, "enter": true, "escape": true,
	"left": true, "right": true, "up": true, "down": true, "space": true,
	"delete": true, "home": true, "end": true, "plus": true,
}

// ValidateAccelerator mirrors the parser in wails/v3/pkg/application/keys.go,
// which is unexported. A bad accelerator there fails at runtime when the menu
// is built; here it fails in a test.
func ValidateAccelerator(accelerator string) error {
	parts := strings.Split(accelerator, "+")
	if len(parts) < 2 {
		return fmt.Errorf("%q has no modifier", accelerator)
	}
	for _, m := range parts[:len(parts)-1] {
		if !modifiers[strings.ToLower(m)] {
			return fmt.Errorf("%q: %q is not a modifier", accelerator, m)
		}
	}
	key := strings.ToLower(parts[len(parts)-1])
	if namedKeys[key] || (len(key) == 1 && key[0] > ' ' && key[0] < 127) {
		return nil
	}
	if strings.HasPrefix(key, "f") && len(key) <= 3 {
		return nil
	}
	return fmt.Errorf("%q: %q is not a key", accelerator, parts[len(parts)-1])
}

// ValidatePortableKey reports an accelerator whose key is not a letter, digit
// or function key. Wails on Windows matches accelerators by virtual-key name,
// where "=" is "oem_plus" and "/" is "oem_2", so a punctuation accelerator
// parses everywhere and fires nowhere on Windows.
func ValidatePortableKey(accelerator string) error {
	parts := strings.Split(accelerator, "+")
	key := strings.ToLower(parts[len(parts)-1])
	if len(key) == 1 && ((key[0] >= 'a' && key[0] <= 'z') || (key[0] >= '0' && key[0] <= '9')) {
		return nil
	}
	if len(key) >= 2 && len(key) <= 3 && key[0] == 'f' && strings.Trim(key[1:], "0123456789") == "" {
		return nil
	}
	return fmt.Errorf("%q: key %q is not portable across platforms", accelerator, parts[len(parts)-1])
}

var knownRoles = map[string]bool{
	"AppMenu": true, "EditMenu": true, "ViewMenu": true, "WindowMenu": true,
	"ServicesMenu": true, "HelpMenu": true, "Hide": true, "HideOthers": true,
	"ShowAll": true, "BringAllToFront": true, "UnHide": true, "About": true,
	"Undo": true, "Redo": true, "Cut": true, "Copy": true, "Paste": true,
	"PasteAndMatchStyle": true, "SelectAll": true, "Delete": true, "Quit": true,
	"FileMenu": true, "CloseWindow": true, "ToggleFullscreen": true,
	"Minimise": true, "Zoom": true, "FullScreen": true,
}

// RoleAccelerators are the shortcuts Wails binds on a role itself, which never
// appear in spec.json. Read from wails/v3/pkg/application/menuitem_roles.go at
// beta.20. They take part in the uniqueness check: a spec item bound to ⌘H
// would silently lose to Hide.
//
// Only roles the spec is allowed to use are listed. The Delete role is absent
// on purpose: it binds bare Backspace, which would steal the key from every
// text field in the app, so Delete is a custom command instead. Cut, Copy and
// Paste are absent too: on Windows those roles run clipboard scripts in the
// page that never reach the canvas, so they are custom commands as well.
var RoleAccelerators = map[string]string{
	"Hide":             "CmdOrCtrl+h",
	"HideOthers":       "CmdOrCtrl+OptionOrAlt+h",
	"Quit":             "CmdOrCtrl+q",
	"CloseWindow":      "CmdOrCtrl+w",
	"ToggleFullscreen": "Ctrl+Command+F",
	"Minimise":         "CmdOrCtrl+M",
	"ServicesMenu":     "",
	"ShowAll":          "",
	"Zoom":             "",
	"BringAllToFront":  "",
}

// KnownRole reports whether role is one Wails v3 beta.20 defines.
func KnownRole(role string) bool {
	return knownRoles[role]
}
