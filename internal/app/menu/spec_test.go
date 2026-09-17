package menu_test

import (
	"sort"
	"strings"
	"testing"

	"github.com/tenesh/bava/internal/app/menu"
)

func load(t *testing.T) menu.Spec {
	t.Helper()
	spec, err := menu.Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	return spec
}

func TestItemIdsAreUnique(t *testing.T) {
	seen := map[string]bool{}
	for _, item := range load(t).AllItems() {
		if item.ID == "" {
			continue
		}
		if seen[item.ID] {
			t.Errorf("duplicate item id %q", item.ID)
		}
		seen[item.ID] = true
	}
}

// Two items on the same accelerator: one of them silently never fires. Native
// roles carry accelerators of their own that spec.json never mentions, so they
// are counted too.
func TestAcceleratorsAreUniquePerPlatform(t *testing.T) {
	for _, platform := range menu.Platforms {
		seen := map[string]string{}
		for _, item := range load(t).ForPlatform(platform).AllItems() {
			accelerator := item.Accelerator
			if accelerator == "" {
				// A frontend-handled shortcut clashes just the same.
				accelerator = item.Shortcut
			}
			label := item.ID
			if item.Kind == menu.KindRole {
				accelerator = menu.RoleAccelerators[item.Role]
				label = "role " + item.Role
			}
			if accelerator == "" {
				continue
			}
			key := normalise(accelerator)
			if other, taken := seen[key]; taken {
				t.Errorf("%s: %q is bound to both %s and %s", platform, accelerator, other, label)
			}
			seen[key] = label
		}
	}
}

// normalise makes "Shift+CmdOrCtrl+S" and "CmdOrCtrl+Shift+s" compare equal.
func normalise(accelerator string) string {
	parts := strings.Split(strings.ToLower(accelerator), "+")
	key := parts[len(parts)-1]
	mods := parts[:len(parts)-1]
	for i := range mods {
		if mods[i] == "command" {
			mods[i] = "cmd"
		}
	}
	sort.Strings(mods)
	return strings.Join(mods, "+") + "+" + key
}

func TestEveryUsedRoleIsAccountedFor(t *testing.T) {
	for _, item := range load(t).AllItems() {
		if item.Kind != menu.KindRole {
			continue
		}
		if _, ok := menu.RoleAccelerators[item.Role]; !ok {
			t.Errorf("role %q is used but its built-in accelerator is not recorded", item.Role)
		}
	}
}

// A native accelerator is captured before the webview sees the key. Binding a
// bare letter, Backspace or an arrow would make it impossible to type that key
// in a text field anywhere in the app.
func TestNoAcceleratorWithoutAModifier(t *testing.T) {
	for _, item := range load(t).AllItems() {
		if item.Accelerator == "" {
			continue
		}
		if !strings.Contains(item.Accelerator, "+") {
			t.Errorf("%s: accelerator %q has no modifier", item.ID, item.Accelerator)
		}
	}
}

// Milestone 8 needs these for prose editing. Taking one now means breaking an
// existing shortcut later.
func TestReservedProseShortcutsAreFree(t *testing.T) {
	reserved := []string{"CmdOrCtrl+B", "CmdOrCtrl+I", "CmdOrCtrl+U", "CmdOrCtrl+K", "Shift+CmdOrCtrl+X"}
	for _, item := range load(t).AllItems() {
		for _, r := range reserved {
			if strings.EqualFold(item.Accelerator, r) {
				t.Errorf("%s takes %q, reserved for prose editing in Milestone 8", item.ID, r)
			}
		}
	}
}

func TestAcceleratorsParse(t *testing.T) {
	for _, item := range load(t).AllItems() {
		if item.Accelerator == "" {
			continue
		}
		if err := menu.ValidateAccelerator(item.Accelerator); err != nil {
			t.Errorf("%s: %v", item.ID, err)
		}
	}
}

func TestRolesAreKnown(t *testing.T) {
	for _, item := range load(t).AllItems() {
		if item.Kind != menu.KindRole {
			continue
		}
		if !menu.KnownRole(item.Role) {
			t.Errorf("unknown role %q", item.Role)
		}
	}
}

// The macOS application menu does not exist elsewhere; About and Settings move
// to Help and File on Windows and Linux.
func TestPlatformSpecificPlacement(t *testing.T) {
	spec := load(t)

	mac := spec.ForPlatform("darwin")
	if mac.Menus[0].ID != "app" {
		t.Errorf("first macOS menu is %q, want the app menu", mac.Menus[0].ID)
	}
	if mac.Find("help.about") != nil {
		t.Error("macOS has About under Help as well as in the app menu")
	}

	for _, platform := range []string{"windows", "linux"} {
		other := spec.ForPlatform(platform)
		if other.Menus[0].ID == "app" {
			t.Errorf("%s has a macOS app menu", platform)
		}
		if other.Find("help.about") == nil {
			t.Errorf("%s has no About", platform)
		}
		if other.Find("file.settings") == nil {
			t.Errorf("%s has no way to reach Settings", platform)
		}
	}
}

// Every platform must reach Settings and About exactly once.
func TestSettingsAndAboutReachableOncePerPlatform(t *testing.T) {
	for _, platform := range menu.Platforms {
		items := load(t).ForPlatform(platform).AllItems()
		var settings, about int
		for _, item := range items {
			if strings.HasSuffix(item.ID, ".settings") {
				settings++
			}
			if strings.HasSuffix(item.ID, ".about") {
				about++
			}
		}
		if settings != 1 || about != 1 {
			t.Errorf("%s: settings=%d about=%d, want 1 each", platform, settings, about)
		}
	}
}

func TestCommandIdsListsEveryDispatchableItem(t *testing.T) {
	ids := load(t).CommandIDs()
	for _, want := range []string{"file.save", "view.both", "view.files", "tool.rect", "file.openRecent"} {
		found := false
		for _, id := range ids {
			if id == want {
				found = true
			}
		}
		if !found {
			t.Errorf("CommandIDs missing %q", want)
		}
	}
}

// Wails on Windows matches an accelerator through virtual-key names: "=" is
// "oem_plus" there, so a menu item bound to CmdOrCtrl+= never fires. Native
// accelerators use letters, digits and function keys only; anything else is a
// Shortcut, which the frontend handles on every platform.
func TestNativeAcceleratorKeysArePortable(t *testing.T) {
	for _, item := range load(t).AllItems() {
		if item.Accelerator == "" {
			continue
		}
		if err := menu.ValidatePortableKey(item.Accelerator); err != nil {
			t.Errorf("%s: %v; use \"shortcut\" instead", item.ID, err)
		}
	}
}

func TestShortcutsParseAndCarryAModifier(t *testing.T) {
	for _, item := range load(t).AllItems() {
		if item.Shortcut == "" {
			continue
		}
		if item.Accelerator != "" {
			t.Errorf("%s has both an accelerator and a shortcut", item.ID)
		}
		if err := menu.ValidateAccelerator(item.Shortcut); err != nil {
			t.Errorf("%s: %v", item.ID, err)
		}
	}
}

// Wails names role items itself, from the application name. A label in the
// spec would be silently ignored and read as if it mattered.
func TestRolesCarryNoLabel(t *testing.T) {
	for _, item := range load(t).AllItems() {
		if item.Kind == menu.KindRole && item.Label != "" {
			t.Errorf("role %s has label %q, which Wails ignores", item.Role, item.Label)
		}
	}
}

// A shortcut may be native only on macOS, and only without Shift or Option:
// those change the character AppKit matches, so ⇧⌘] would silently not fire.
func TestNativeShortcutsAreSafeOnTheirPlatforms(t *testing.T) {
	for _, item := range load(t).AllItems() {
		for _, platform := range item.NativeOn {
			if item.Shortcut == "" {
				t.Errorf("%s lists nativeOn without a shortcut", item.ID)
			}
			if platform != "darwin" {
				t.Errorf("%s: native on %s, where punctuation accelerators are unverified or broken", item.ID, platform)
			}
			lower := strings.ToLower(item.Shortcut)
			if strings.Contains(lower, "shift") || strings.Contains(lower, "alt") || strings.Contains(lower, "option") {
				t.Errorf("%s: %q is native on darwin but uses a modifier that changes the character", item.ID, item.Shortcut)
			}
		}
	}
}

// A canvas-scoped shortcut acts only when the canvas has the keyboard. ⌘] indents
// in the source editor and ⇧H types a capital H; a native accelerator would
// take the key from both, so a scoped entry is always a page shortcut.
func TestCanvasScopedShortcutsAreNeverNative(t *testing.T) {
	scoped := 0
	for _, item := range load(t).AllItems() {
		if item.Scope == "" {
			continue
		}
		scoped++
		if item.Scope != "canvas" {
			t.Errorf("%s: unknown scope %q", item.ID, item.Scope)
		}
		if item.Accelerator != "" || len(item.NativeOn) > 0 || item.Shortcut == "" {
			t.Errorf("%s: a canvas-scoped item needs a shortcut and no native accelerator", item.ID)
		}
	}
	if scoped == 0 {
		t.Error("no canvas-scoped items: the check exercised nothing")
	}
}
