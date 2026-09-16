package app

import (
	"testing"

	"github.com/tenesh/bava/internal/app/menu"
)

// The frontend may report state before the menu bar exists; that must not
// crash the app on launch.
func TestMenuStateBeforeBuildIsIgnored(t *testing.T) {
	NewMenuService().SetState(menu.State{ViewMode: "both"})
}
