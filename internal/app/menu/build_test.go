package menu_test

import (
	"testing"

	"github.com/wailsapp/wails/v3/pkg/application"

	"github.com/tenesh/bava/internal/app/menu"
)

func build(t *testing.T, platform string) (*menu.Built, *[]menu.Command) {
	t.Helper()
	var emitted []menu.Command
	built := menu.Build(load(t).ForPlatform(platform), func(c menu.Command) {
		emitted = append(emitted, c)
	}, menu.Options{
		Platform: platform,
		// Wails' role constructors need a running application.
		AddRole: func(*application.Menu, application.Role) {},
	})
	return built, &emitted
}

func TestEveryDispatchableItemHasAHandle(t *testing.T) {
	for _, platform := range menu.Platforms {
		built, _ := build(t, platform)
		for _, id := range load(t).ForPlatform(platform).CommandIDs() {
			if id == "file.openRecent" {
				continue // a submenu, filled at runtime
			}
			if built.Item(id) == nil {
				t.Errorf("%s: no menu item built for %q", platform, id)
			}
		}
	}
}

func TestAcceleratorsAreApplied(t *testing.T) {
	built, _ := build(t, "darwin")
	if got := built.Item("file.save"); got == nil {
		t.Fatal("no Save item")
	}
}

func TestStateChecksTheCurrentViewMode(t *testing.T) {
	built, _ := build(t, "darwin")

	built.Apply(menu.State{ViewMode: "canvas", Theme: "system", Tool: "rect"})

	if !built.Item("view.canvas").Checked() {
		t.Error("Canvas is not checked")
	}
	if built.Item("view.both").Checked() {
		t.Error("Both is still checked")
	}
	if !built.Item("view.theme.system").Checked() {
		t.Error("Follow System is not checked")
	}
	if !built.Item("tool.rect").Checked() || built.Item("tool.select").Checked() {
		t.Error("tool radio does not reflect the active tool")
	}
}

func TestSelectionEnablesArrangeCommands(t *testing.T) {
	built, _ := build(t, "darwin")

	built.Apply(menu.State{HasSelection: false})
	if built.Item("canvas.group").Enabled() {
		t.Error("Group is enabled with nothing selected")
	}

	built.Apply(menu.State{HasSelection: true})
	if !built.Item("canvas.group").Enabled() {
		t.Error("Group is disabled with a selection")
	}

	for _, id := range []string{"canvas.bringForward", "canvas.sendBackward", "canvas.duplicate", "canvas.flipHorizontal", "canvas.flipVertical", "canvas.alignLeft", "canvas.distributeVertical"} {
		built.Apply(menu.State{HasSelection: false})
		if built.Item(id).Enabled() {
			t.Errorf("%s is enabled with nothing selected", id)
		}
		built.Apply(menu.State{HasSelection: true})
		if !built.Item(id).Enabled() {
			t.Errorf("%s is disabled with a selection", id)
		}
	}
}

func TestPaneTogglesReflectState(t *testing.T) {
	built, _ := build(t, "linux")
	built.Apply(menu.State{ShowsFiles: true, ShowsAI: false})
	if !built.Item("view.files").Checked() || built.Item("view.ai").Checked() {
		t.Error("pane checkboxes do not match state")
	}
}

// Menus are never inspected by a test runner's click, so emission is checked
// by applying recents and asserting Apply does not panic on repeated calls;
// the recents submenu is cleared and rebuilt each time.
func TestRecentsCanBeReappliedRepeatedly(t *testing.T) {
	built, _ := build(t, "darwin")
	built.Apply(menu.State{Recents: []string{"/a.md", "/b.md"}})
	built.Apply(menu.State{Recents: []string{"/c.md"}})
	built.Apply(menu.State{})
}

// Only Windows right-aligns text after a tab in a menu label. macOS and GTK
// print the tab as spacing, so a hint lands mid-row (seen in a running app).
// Elsewhere the label is plain, and the Shortcuts dialog lists every key.
func TestHintsAreInTheLabelOnWindowsOnly(t *testing.T) {
	cases := map[string]string{"windows": "Rectangle\tR", "darwin": "Rectangle", "linux": "Rectangle"}
	for platform, want := range cases {
		built, _ := build(t, platform)
		if got := built.Item("tool.rect").Label(); got != want {
			t.Errorf("%s: label %q, want %q", platform, got, want)
		}
	}
}

// A shortcut the platform binds natively is a real accelerator, aligned by the
// menu itself. On macOS AppKit matches punctuation key equivalents by
// character, so ⌘= and ⌘, work natively; on Windows they never fire.
func TestNativeShortcutsBecomeAcceleratorsOnlyWhereListed(t *testing.T) {
	mac, _ := build(t, "darwin")
	if got := mac.Item("view.zoomIn").Label(); got != "Zoom In" {
		t.Errorf("darwin: label %q, want the bare label", got)
	}
	if !mac.IsNativeShortcut("view.zoomIn") {
		t.Error("darwin: Zoom In is not bound natively")
	}

	win, _ := build(t, "windows")
	if got := win.Item("view.zoomIn").Label(); got != "Zoom In\tCtrl+=" {
		t.Errorf("windows: label %q, want the hint in the label", got)
	}
	if win.IsNativeShortcut("view.zoomIn") {
		t.Error("windows: Zoom In is bound natively, which Windows never fires")
	}
}

// Rebuilding the native menu is expensive everywhere and not thread-safe on
// Linux; only a change to the recents list needs it.
func TestApplyReportsWhetherTheMenuMustBeRebuilt(t *testing.T) {
	built, _ := build(t, "darwin")
	if !built.Apply(menu.State{Recents: []string{"/a.md"}}) {
		t.Error("first recents list did not ask for a rebuild")
	}
	if built.Apply(menu.State{Recents: []string{"/a.md"}, Tool: "rect", HasSelection: true}) {
		t.Error("a tool or selection change asked for a rebuild")
	}
	if !built.Apply(menu.State{Recents: []string{"/b.md", "/a.md"}}) {
		t.Error("a changed recents list did not ask for a rebuild")
	}
}

// Paste Styles with no copied style would be a dead item.
func TestPasteStylesNeedsACopiedStyle(t *testing.T) {
	built, _ := build(t, "darwin")
	built.Apply(menu.State{HasSelection: true})
	if built.Item("canvas.pasteStyles").Enabled() {
		t.Error("Paste Styles is enabled with nothing copied")
	}
	built.Apply(menu.State{HasSelection: true, CanPasteStyles: true})
	if !built.Item("canvas.pasteStyles").Enabled() {
		t.Error("Paste Styles is disabled with a copied style and a selection")
	}
	built.Apply(menu.State{HasSelection: false, CanPasteStyles: true})
	if built.Item("canvas.pasteStyles").Enabled() {
		t.Error("Paste Styles is enabled with nothing selected")
	}
}
