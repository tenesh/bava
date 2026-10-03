package config_test

import (
	"testing"

	"github.com/tenesh/bava/internal/config"
	"github.com/tenesh/bava/internal/testutil"
)

// The frontend reads and saves settings by these names, and the settings file
// holds them: a renamed key would lose the user's preference.
func TestSettingsKeepTheirJSONKeys(t *testing.T) {
	testutil.AssertJSONKeys(t, config.Settings{},
		"arrowBinding", "autosave", "autosaveDelayMs", "debounceMs", "layoutEngine",
		"midpointSnap", "objectSnap", "pageWidth", "verboseLogging")
}
