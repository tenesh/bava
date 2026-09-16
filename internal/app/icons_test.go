package app_test

import (
	"crypto/sha256"
	"encoding/hex"
	"image/png"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// The Wails template's icons, by SHA-256, as they were at the scaffold commit.
// A build that ships one of these ships someone else's logo under our name.
var templateIcons = map[string]string{
	"appicon.png":       "985eb536bb829188b6fc3cb65d8130b4743ff773fa5ed170c0955c317cb98739",
	"darwin/icons.icns": "8b1f45cf9d3b459f9c6ea3782c6c640ecf01a677a1c445318a4828b8859e3a9b",
	"windows/icon.ico":  "691c30bf1720f74a279048d6cf5ba9454cb429b3b62c4bcb27efa5ec1abe8e58",
	"darwin/Assets.car": "48e5c620766a4fe70274c57fa43c74f39b9c2e20f3c3976adc415e768e01e635",
}

func buildPath(name string) string {
	return filepath.Join("..", "..", "build", filepath.FromSlash(name))
}

// Each platform's icon comes from its own designer export: macOS a squircle
// with Apple's margin, Windows full-bleed, Linux rounded.
func TestIconSourcesAre1024SquarePNGs(t *testing.T) {
	for _, name := range []string{"appicon.png", "darwin/appicon-mac.png", "windows/appicon-windows.png"} {
		file, err := os.Open(buildPath(name))
		if err != nil {
			t.Errorf("%s: %v", name, err)
			continue
		}
		config, err := png.DecodeConfig(file)
		file.Close()
		if err != nil {
			t.Errorf("%s is not a PNG: %v", name, err)
			continue
		}
		if config.Width != 1024 || config.Height != 1024 {
			t.Errorf("%s is %dx%d, want 1024x1024", name, config.Width, config.Height)
		}
	}
}

func TestNoIconIsTheWailsTemplate(t *testing.T) {
	for name, template := range templateIcons {
		content, err := os.ReadFile(buildPath(name))
		if os.IsNotExist(err) {
			continue
		}
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		sum := sha256.Sum256(content)
		if hex.EncodeToString(sum[:]) == template {
			t.Errorf("%s is still the Wails template icon", name)
		}
	}
}

// Info.plist names CFBundleIconName, which resolves through Assets.car and
// wins over icons.icns. Assets.car is compiled by Xcode's actool from an Icon
// Composer file; without Xcode it cannot be rebuilt, and a stale one silently
// keeps the template icon on macOS 26.
func TestNoAssetsCarShipsSoMacOSUsesTheIcns(t *testing.T) {
	for _, name := range []string{"darwin/Assets.car", "appicon.icon"} {
		if _, err := os.Stat(buildPath(name)); err == nil {
			t.Errorf("%s exists: macOS would show it instead of icons.icns", name)
		}
	}
	// `wails3 update build-assets` writes the key back.
	for _, name := range []string{"darwin/Info.plist", "darwin/Info.dev.plist"} {
		content, err := os.ReadFile(buildPath(name))
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		if strings.Contains(string(content), "CFBundleIconName") {
			t.Errorf("%s names CFBundleIconName, an asset catalogue that does not ship", name)
		}
	}
}
