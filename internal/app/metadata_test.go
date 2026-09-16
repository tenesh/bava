package app_test

import (
	"os"
	"strings"
	"testing"
)

// The Wails template names the app "My Product" everywhere it is packaged.
// macOS shows CFBundleName as the application menu's title, so a leftover is
// visible the moment the app starts.
func TestPackagingMetadataIsNotTheWailsTemplate(t *testing.T) {
	placeholders := []string{"My Product", "My Company", "mycompany", "myproduct", "does X", "This is a comment", "Some Product Comments"}
	files := []string{
		"config.yml",
		"darwin/Info.plist",
		"darwin/Info.dev.plist",
		"linux/desktop",
		"windows/info.json",
		"windows/nsis/wails_tools.nsh",
		"windows/msix/template.xml",
		"windows/msix/app_manifest.xml",
	}
	for _, name := range files {
		content, err := os.ReadFile(buildPath(name))
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		for _, placeholder := range placeholders {
			if strings.Contains(string(content), placeholder) {
				t.Errorf("%s still contains the template's %q", name, placeholder)
			}
		}
	}
}

func TestMacAppMenuIsTitledBava(t *testing.T) {
	for _, name := range []string{"darwin/Info.plist", "darwin/Info.dev.plist"} {
		content, err := os.ReadFile(buildPath(name))
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		if !strings.Contains(string(content), "<key>CFBundleName</key>\n            <string>Bava</string>") {
			t.Errorf("%s: CFBundleName is not Bava", name)
		}
	}
}
