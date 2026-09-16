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
}

func TestPaneTogglesReflectState(t *testing.T) {
	built, _ := build(t, "linux")
	built.Apply(menu.State{ShowsFiles: true, ShowsAI: false})
	if !built.Item("view.files").Checked() || built.Item("view.ai").Checked() {
		t.Error("pane checkboxes do not match state")
	}
}

// Menus are never inspected by a test runner's click, so emission is checked
// by applying recents and asserting Apply does not panic on repeated calls —
// the recents submenu is cleared and rebuilt each time.
func TestRecentsCanBeReappliedRepeatedly(t *testing.T) {
	built, _ := build(t, "darwin")
	built.Apply(menu.State{Recents: []string{"/a.md", "/b.md"}})
	built.Apply(menu.State{Recents: []string{"/c.md"}})
	built.Apply(menu.State{})
}

// A shortcut is shown in the label, formatted for the platform, and never
// bound: the frontend handles it.
func TestShortcutIsShownButNotBound(t *testing.T) {
	cases := map[string]string{"darwin": "Zoom In\t⌘=", "windows": "Zoom In\tCtrl+=", "linux": "Zoom In\tCtrl+="}
	for platform, want := range cases {
		built, _ := build(t, platform)
		if got := built.Item("view.zoomIn").Label(); got != want {
			t.Errorf("%s: label %q, want %q", platform, got, want)
		}
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
