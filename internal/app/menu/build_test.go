package menu_test

import (
	"slices"
	"testing"

	"github.com/wailsapp/wails/v3/pkg/application"

	"github.com/tharabyte/bava/internal/app/menu"
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

	for _, id := range []string{"canvas.bringForward", "canvas.sendBackward", "canvas.duplicate", "canvas.flipHorizontal", "canvas.flipVertical", "canvas.alignLeft", "canvas.distributeVertical", "view.zoomToSelection"} {
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

// Canvas ▸ Snap to Objects is ticked when the setting is on.
func TestSnapToObjectsReflectsState(t *testing.T) {
	built, _ := build(t, "darwin")
	built.Apply(menu.State{ObjectSnap: true})
	if item := built.Item("canvas.snapToObjects"); item == nil || !item.Checked() {
		t.Fatal("Snap to Objects is not ticked with the setting on")
	}
	built.Apply(menu.State{ObjectSnap: false})
	if built.Item("canvas.snapToObjects").Checked() {
		t.Error("Snap to Objects is ticked with the setting off")
	}
}

// What needs a Space is enabled only with one open.
func TestSpaceItemsFollowHasSpace(t *testing.T) {
	built, _ := build(t, "darwin")
	ids := []string{"file.newFolder", "space.trash", "file.spaceSettings", "file.importFiles", "file.importFolder"}
	built.Apply(menu.State{})
	for _, id := range ids {
		if item := built.Item(id); item == nil || item.Enabled() {
			t.Errorf("%s is enabled (or missing) with no Space", id)
		}
	}
	built.Apply(menu.State{HasSpace: true})
	for _, id := range ids {
		if !built.Item(id).Enabled() {
			t.Errorf("%s is disabled with a Space open", id)
		}
	}
}

// The recents submenu is cleared and rebuilt each time the list changes: it
// shows the latest list only, and a placeholder when there is none.
func TestRecentsSubmenuShowsTheLatestList(t *testing.T) {
	built, _ := build(t, "darwin")
	item := built.Menu.FindByLabel("Open Recent")
	if item == nil || item.GetSubmenu() == nil {
		t.Fatal("no Open Recent submenu")
	}
	recents := item.GetSubmenu()
	labels := func() []string {
		var out []string
		for i := 0; recents.ItemAt(i) != nil; i++ {
			out = append(out, recents.ItemAt(i).Label())
		}
		return out
	}

	built.Apply(menu.State{Recents: []string{"/a.md", "/b.md"}})
	if got := labels(); !slices.Equal(got, []string{"/a.md", "/b.md"}) {
		t.Errorf("two recents: %v", got)
	}
	built.Apply(menu.State{Recents: []string{"/c.md"}})
	if got := labels(); !slices.Equal(got, []string{"/c.md"}) {
		t.Errorf("one recent: %v", got)
	}
	built.Apply(menu.State{})
	if got := labels(); !slices.Equal(got, []string{"No Recent Files"}) || recents.ItemAt(0).Enabled() {
		t.Errorf("no recents: %v, enabled %v", got, recents.ItemAt(0).Enabled())
	}
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
// Unlock All is offered only when something is locked.
func TestUnlockAllNeedsSomethingLocked(t *testing.T) {
	built, _ := build(t, "darwin")
	built.Apply(menu.State{})
	if built.Item("canvas.unlockAll").Enabled() {
		t.Error("Unlock All is enabled with nothing locked")
	}
	built.Apply(menu.State{HasLocked: true})
	if !built.Item("canvas.unlockAll").Enabled() {
		t.Error("Unlock All is disabled with something locked")
	}
	built.Apply(menu.State{HasSelection: true})
	if !built.Item("canvas.lock").Enabled() {
		t.Error("Lock is disabled with a selection")
	}
}

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

// Export writes what is on the canvas, so it needs a document open; the two
// selection exports need something selected.
func TestExportEntriesFollowTheState(t *testing.T) {
	built, _ := build(t, "darwin")

	built.Apply(menu.State{})
	if built.Item("file.export").Enabled() {
		t.Error("Export is enabled with no document open")
	}
	for _, id := range []string{"canvas.copyPng", "canvas.copySvg", "canvas.exportSelection"} {
		if built.Item(id).Enabled() {
			t.Errorf("%s is enabled with nothing selected", id)
		}
	}

	built.Apply(menu.State{HasDocument: true, HasSelection: true})
	if !built.Item("file.export").Enabled() {
		t.Error("Export is disabled with a document open")
	}
	for _, id := range []string{"canvas.copyPng", "canvas.copySvg", "canvas.exportSelection"} {
		if !built.Item(id).Enabled() {
			t.Errorf("%s is disabled with a selection", id)
		}
	}
}

// Inserting a diagram needs somewhere to put it.
func TestInsertDiagramNeedsADocument(t *testing.T) {
	built, _ := build(t, "darwin")

	built.Apply(menu.State{})
	if built.Item("insert.d2Diagram").Enabled() {
		t.Error("D2 Diagram is enabled with no document open")
	}
	// A document open but the canvas hidden: there is nowhere to put it, and
	// an item that is enabled and does nothing is worse than a disabled one.
	built.Apply(menu.State{HasDocument: true})
	if built.Item("insert.d2Diagram").Enabled() {
		t.Error("D2 Diagram is enabled with the canvas hidden")
	}

	built.Apply(menu.State{HasDocument: true, ShowsCanvas: true})
	if !built.Item("insert.d2Diagram").Enabled() {
		t.Error("D2 Diagram is disabled with a document open and the canvas shown")
	}
}

// A picture goes on the canvas, so it needs one shown, as a diagram does.
func TestInsertPictureNeedsTheCanvas(t *testing.T) {
	built, _ := build(t, "darwin")

	built.Apply(menu.State{HasDocument: true})
	if built.Item("insert.picture").Enabled() {
		t.Error("Picture is enabled with the canvas hidden")
	}
	built.Apply(menu.State{HasDocument: true, ShowsCanvas: true})
	if !built.Item("insert.picture").Enabled() {
		t.Error("Picture is disabled with a document open and the canvas shown")
	}
}

// Zoom to Fit and Zoom to Selection follow Actual Size, their shortcuts left
// to the canvas: Shift+1 is "!" in a text field.
func TestZoomToFitFollowsActualSize(t *testing.T) {
	spec, err := menu.Load()
	if err != nil {
		t.Fatal(err)
	}
	ids := []string{}
	for _, m := range spec.Menus {
		if m.ID == "view" {
			for _, item := range m.Items {
				ids = append(ids, item.ID)
			}
		}
	}
	built, _ := build(t, "windows")
	at := slices.Index(ids, "view.actualSize")
	if at < 0 || at+2 >= len(ids) || ids[at+1] != "view.zoomToFit" || ids[at+2] != "view.zoomToSelection" {
		t.Fatalf("View menu = %v, want Zoom to Fit and Zoom to Selection after Actual Size", ids)
	}
	if got := built.Item("view.zoomToFit").Label(); got != "Zoom to Fit\tShift+1" {
		t.Errorf("label %q", got)
	}
	if built.IsNativeShortcut("view.zoomToFit") {
		t.Error("Zoom to Fit is bound natively, taking ! from text fields")
	}
}

// Every item that says when it can run is enabled exactly then, read from
// the spec: the menu keeps no list of its own to drift from it.
func TestItemsAreEnabledAsTheSpecSays(t *testing.T) {
	spec, err := menu.Load()
	if err != nil {
		t.Fatal(err)
	}
	built, _ := build(t, "darwin")
	all := menu.State{HasSelection: true, HasSpace: true, HasDocument: true, ShowsCanvas: true, CanPasteStyles: true, HasLocked: true}
	for _, item := range spec.ForPlatform("darwin").AllItems() {
		if len(item.When) == 0 || built.Item(item.ID) == nil {
			continue
		}
		built.Apply(all)
		if !built.Item(item.ID).Enabled() {
			t.Errorf("%s is disabled with everything it needs", item.ID)
		}
		for _, key := range item.When {
			without := all
			without.Set(key, false)
			built.Apply(without)
			if built.Item(item.ID).Enabled() {
				t.Errorf("%s is enabled without %s", item.ID, key)
			}
		}
	}
}

// What adds to the canvas is grouped at the top of the Canvas menu: the
// Diagram submenu, then Picture; File holds neither.
func TestCanvasMenuStartsWithWhatAddsToTheCanvas(t *testing.T) {
	spec, err := menu.Load()
	if err != nil {
		t.Fatal(err)
	}
	menus := map[string]menu.Menu{}
	for _, m := range spec.Menus {
		menus[m.ID] = m
	}
	items := menus["canvas"].Items
	if len(items) < 3 || items[0].Kind != "submenu" || items[0].ID != "canvas.diagram" || items[0].Label != "Diagram" {
		t.Fatalf("Canvas menu starts %+v, want the Diagram submenu", items[:min(len(items), 3)])
	}
	if got := items[0].Items; len(got) == 0 || got[0].ID != "insert.d2Diagram" || got[0].Label != "D2 Diagram" {
		t.Errorf("Diagram submenu = %+v, want D2 Diagram first", got)
	}
	if items[1].ID != "insert.picture" || items[2].Kind != "separator" {
		t.Errorf("after Diagram: %+v, %+v; want Picture, then a separator", items[1], items[2])
	}
	var inFile func([]menu.Item) []string
	inFile = func(list []menu.Item) []string {
		var ids []string
		for _, item := range list {
			ids = append(ids, item.ID)
			ids = append(ids, inFile(item.Items)...)
		}
		return ids
	}
	for _, id := range inFile(menus["file"].Items) {
		if id == "insert.d2Diagram" || id == "insert.picture" {
			t.Errorf("File still holds %s", id)
		}
	}
}
