package app_test

import (
	"os"
	"regexp"
	"strings"
	"testing"

	"github.com/tharabyte/bava/internal/testutil"
)

// The Wails template names the app "My Product" everywhere it is packaged.
// macOS shows CFBundleName as the application menu's title, so a leftover is
// visible the moment the app starts.
func TestPackagingMetadataIsNotTheWailsTemplate(t *testing.T) {
	placeholders := []string{"My Product", "My Company", "mycompany", "myproduct", "does X", "This is a comment", "Some Product Comments", "A bava application", "wails.io", `license: "MIT"`}
	files := []string{
		"config.yml",
		"darwin/Info.plist",
		"darwin/Info.dev.plist",
		"linux/desktop",
		"windows/info.json",
		"windows/nsis/wails_tools.nsh",
		"windows/msix/template.xml",
		"windows/msix/app_manifest.xml",
		"linux/nfpm/nfpm.yaml",
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

// The app ID the stores know Bava by, and its publisher, in every file the
// app is packaged from. The ID can never change after the first release.
func TestEveryPlatformFileNamesTharabytesApp(t *testing.T) {
	want := map[string][]string{
		"config.yml":                    {`productIdentifier: "com.tharabyte.bava"`, `companyName: "Tharabyte"`, `copyright: "© 2026 Tharabyte"`},
		"darwin/Info.plist":             {"<string>com.tharabyte.bava</string>", "<string>© 2026 Tharabyte</string>"},
		"darwin/Info.dev.plist":         {"<string>com.tharabyte.bava</string>", "<string>© 2026 Tharabyte</string>"},
		"windows/info.json":             {`"CompanyName": "Tharabyte"`, `"LegalCopyright": "© 2026 Tharabyte"`},
		"windows/msix/app_manifest.xml": {`Name="com.tharabyte.bava"`, `Publisher="CN=Tharabyte"`, "<PublisherDisplayName>Tharabyte</PublisherDisplayName>", `<Application Id="com.tharabyte.bava"`},
		"windows/msix/template.xml":     {`PublisherName="CN=Tharabyte"`, `PublisherDisplayName="Tharabyte"`, `Id="com.tharabyte.bava"`},
		"windows/nsis/wails_tools.nsh":  {`!define INFO_COMPANYNAME "Tharabyte"`, `!define INFO_COPYRIGHT "© 2026 Tharabyte"`},
		"windows/wails.exe.manifest":    {`name="com.tharabyte.bava"`},
		"linux/nfpm/nfpm.yaml":          {`vendor: "Tharabyte"`, `license: "Apache-2.0"`, `homepage: "https://github.com/tharabyte/bava"`},
		"windows/nsis/project.nsi":      {`# Default "Tharabyte"`},
	}
	for name, lines := range want {
		content, err := os.ReadFile(testutil.RepoPath(t, "build", name))
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		for _, line := range lines {
			if !strings.Contains(string(content), line) {
				t.Errorf("%s: no %s", name, line)
			}
		}
		if strings.Contains(string(content), "tenesh") {
			t.Errorf("%s still names the old owner", name)
		}
	}
}
