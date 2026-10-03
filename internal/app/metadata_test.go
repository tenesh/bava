package app_test

import (
	"os"
	"regexp"
	"strings"
	"testing"

	"github.com/tenesh/bava/internal/testutil"
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
		content, err := os.ReadFile(testutil.RepoPath(t, "build", name))
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

// The key and its value, whatever the indentation between them.
var bundleName = regexp.MustCompile(`<key>CFBundleName</key>\s*<string>Bava</string>`)

func TestMacAppMenuIsTitledBava(t *testing.T) {
	for _, name := range []string{"darwin/Info.plist", "darwin/Info.dev.plist"} {
		content, err := os.ReadFile(testutil.RepoPath(t, "build", name))
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		if !bundleName.Match(content) {
			t.Errorf("%s: CFBundleName is not Bava", name)
		}
	}
}
