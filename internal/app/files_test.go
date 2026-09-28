package app_test

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"

	"github.com/tenesh/bava/internal/app"
)

// served asks the file route for a file, as the page does.
func served(t *testing.T, folders *app.OpenedFolders, root, path string, header http.Header) *httptest.ResponseRecorder {
	t.Helper()
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusTeapot) })
	handler := app.FileRoute(folders)(next)
	query := url.Values{"root": {root}, "path": {path}}
	req := httptest.NewRequest(http.MethodGet, "/bava-file/?"+query.Encode(), nil)
	for k, v := range header {
		req.Header[k] = v
	}
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec
}

func writeFile(t *testing.T, root, rel, content string) {
	t.Helper()
	full := filepath.Join(root, filepath.FromSlash(rel))
	if err := os.MkdirAll(filepath.Dir(full), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(full, []byte(content), 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestFileRouteServesImagesAndVideosFromAnOpenedFolder(t *testing.T) {
	root := t.TempDir()
	writeFile(t, root, ".bava/attachments/logo.png", "png bytes")
	writeFile(t, root, "images/photo.jpg", "jpg bytes")
	writeFile(t, root, ".bava/attachments/demo.mp4", "0123456789")
	folders := app.NewOpenedFolders()
	folders.Allow(root)

	for path, want := range map[string]string{".bava/attachments/logo.png": "png bytes", "images/photo.jpg": "jpg bytes"} {
		rec := served(t, folders, root, path, nil)
		if rec.Code != http.StatusOK || rec.Body.String() != want {
			t.Errorf("%s: %d %q", path, rec.Code, rec.Body.String())
		}
	}
	// A video seeks: a range of it.
	rec := served(t, folders, root, ".bava/attachments/demo.mp4", http.Header{"Range": {"bytes=2-5"}})
	if rec.Code != http.StatusPartialContent || rec.Body.String() != "2345" {
		t.Errorf("range: %d %q", rec.Code, rec.Body.String())
	}
	if rec.Header().Get("Content-Type") != "video/mp4" {
		t.Errorf("content type %q", rec.Header().Get("Content-Type"))
	}
}

func TestFileRouteRefusesAnythingElse(t *testing.T) {
	root := t.TempDir()
	writeFile(t, root, "notes.md", "text")
	writeFile(t, root, ".bava/space.json", "{}")
	writeFile(t, root, ".hidden/a.png", "png")
	writeFile(t, root, "ok.png", "png")
	writeFile(t, root, ".bava/trash/x.png", "png")
	writeFile(t, root, ".bava/x.png", "png")
	writeFile(t, root, ".bava/attachments/sub/x.png", "png")
	writeFile(t, root, ".bava/attachments/.x.png", "png")
	elsewhere := t.TempDir()
	writeFile(t, elsewhere, "secret.png", "png")
	folders := app.NewOpenedFolders()
	folders.Allow(root)

	cases := map[string][2]string{
		"a page":                      {root, "notes.md"},
		"the Space's own folder":      {root, ".bava/trash/x.png"},
		"beside the attachments":      {root, ".bava/x.png"},
		"inside an attachment folder": {root, ".bava/attachments/sub/x.png"},
		"a hidden attachment":         {root, ".bava/attachments/.x.png"},
		"a backslash way out":         {root, `a\..\..\` + filepath.Base(elsewhere) + `\secret.png`},
		"a drive":                     {root, `C:x.png`},
		"a share":                     {root, `\\srv\share\x.png`},
		"a hidden folder":             {root, ".hidden/a.png"},
		"out of the folder":           {root, "../" + filepath.Base(elsewhere) + "/secret.png"},
		"an absolute path":            {root, filepath.Join(elsewhere, "secret.png")},
		"a folder never opened":       {elsewhere, "secret.png"},
		"a relative root":             {"relative", "ok.png"},
		"a missing file":              {root, "gone.png"},
	}
	if runtime.GOOS != "windows" {
		if err := os.Symlink(filepath.Join(elsewhere, "secret.png"), filepath.Join(root, "link.png")); err != nil {
			t.Fatal(err)
		}
		cases["through a link"] = [2]string{root, "link.png"}
		if err := os.Symlink(elsewhere, filepath.Join(root, "linked")); err != nil {
			t.Fatal(err)
		}
		cases["through a linked folder"] = [2]string{root, "linked/secret.png"}
	}
	for name, c := range cases {
		if rec := served(t, folders, c[0], c[1], nil); rec.Code != http.StatusNotFound {
			t.Errorf("%s: %d", name, rec.Code)
		}
	}
}

func TestFileRouteLeavesOtherRequestsToTheApp(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusTeapot) })
	rec := httptest.NewRecorder()
	app.FileRoute(app.NewOpenedFolders())(next).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/index.html", nil))
	if rec.Code != http.StatusTeapot {
		t.Errorf("the app's own files: %d", rec.Code)
	}
}

func TestOpeningASpaceOrAPageAllowsItsFolder(t *testing.T) {
	folders := app.NewOpenedFolders()
	root := t.TempDir()
	app.NewSpaceService(app.SpaceServiceOptions{Folders: folders}).Open(root)
	if !folders.Allowed(root) {
		t.Error("an opened Space is not allowed")
	}
	dir := t.TempDir()
	writeFile(t, dir, "page.md", "# Page\n")
	app.NewFileService(app.FileServiceOptions{Folders: folders}).Open(filepath.Join(dir, "page.md"))
	if !folders.Allowed(dir) {
		t.Error("an opened page's folder is not allowed")
	}
}

func TestClipboardImageComesBackAsBase64(t *testing.T) {
	s := app.NewFileService(app.FileServiceOptions{ClipboardImage: func() []byte { return []byte("png") }})
	if got := s.ClipboardImage(); got != "cG5n" {
		t.Errorf("ClipboardImage = %q", got)
	}
	empty := app.NewFileService(app.FileServiceOptions{ClipboardImage: func() []byte { return nil }})
	if got := empty.ClipboardImage(); got != "" {
		t.Errorf("no image: %q", got)
	}
}

func TestChooseMediaAsksForImagesOrVideosAndReturnsEveryOneChosen(t *testing.T) {
	var asked []string
	s := app.NewFileService(app.FileServiceOptions{ChooseFiles: func(kind string) ([]string, error) {
		asked = append(asked, kind)
		return []string{"/a.png", "/b.png"}, nil
	}})
	got := s.ChooseMedia("image")
	if got.Error != "" || len(got.Paths) != 2 || got.Paths[1] != "/b.png" {
		t.Errorf("ChooseMedia = %+v", got)
	}
	s.ChooseMedia("video")
	s.ChooseMedia("file")
	if len(asked) != 3 || asked[0] != "image" || asked[1] != "video" || asked[2] != "file" {
		t.Errorf("asked for %v", asked)
	}
	if any := s.ChooseMedia("file"); any.Error != "" || len(any.Paths) != 2 {
		t.Errorf("any file: %+v", any)
	}
	if bad := s.ChooseMedia("pdf"); bad.Error == "" {
		t.Error("a kind that is not image or video was asked for")
	}
}

func TestChooseMediaCancelledIsNoFiles(t *testing.T) {
	s := app.NewFileService(app.FileServiceOptions{ChooseFiles: func(string) ([]string, error) { return nil, nil }})
	if got := s.ChooseMedia("video"); got.Error != "" || got.Paths == nil || len(got.Paths) != 0 {
		t.Errorf("cancelled: %+v", got)
	}
}

// An SVG is only ever an image: never run as a page of its own.
func TestFileRouteServesFilesThatCannotRunAsAPage(t *testing.T) {
	root := t.TempDir()
	writeFile(t, root, "a.svg", "<svg/>")
	folders := app.NewOpenedFolders()
	folders.Allow(root)
	rec := served(t, folders, root, "a.svg", nil)
	if rec.Code != http.StatusOK || rec.Header().Get("X-Content-Type-Options") != "nosniff" || !strings.Contains(rec.Header().Get("Content-Security-Policy"), "sandbox") {
		t.Errorf("served %d with %v", rec.Code, rec.Header())
	}
}

func TestFileDetailsAreReadFromTheFile(t *testing.T) {
	root := t.TempDir()
	writeFile(t, root, ".bava/attachments/Q3 report.pdf", "12345")
	folders := app.NewOpenedFolders()
	folders.Allow(root)
	s := app.NewFileService(app.FileServiceOptions{Folders: folders})
	got := s.FileDetails(root, ".bava/attachments/Q3 report.pdf")
	if got.Error != "" || !got.Exists || got.Size != 5 || got.Modified == "" {
		t.Errorf("FileDetails = %+v", got)
	}
	if gone := s.FileDetails(root, "gone.pdf"); gone.Error != "" || gone.Exists {
		t.Errorf("a missing file = %+v", gone)
	}
	for _, rel := range []string{"../x.pdf", `a\..\..\x.pdf`, "/etc/passwd"} {
		if bad := s.FileDetails(root, rel); bad.Error == "" {
			t.Errorf("%s: %+v", rel, bad)
		}
	}
	if other := s.FileDetails(t.TempDir(), "x.pdf"); other.Error == "" {
		t.Error("a folder never opened was read")
	}
}

func TestOpenFileOpensADocumentButOnlyShowsAProgram(t *testing.T) {
	root := t.TempDir()
	for _, name := range []string{"notes.pdf", "setup.exe", "run.sh", "Tool.app/x", "folder/y", "run", "page.hta", "script.js", "setup.exe.", "flow.workflow", "Tool.app/Contents/MacOS/Tool"} {
		writeFile(t, root, name, "x")
	}
	folders := app.NewOpenedFolders()
	folders.Allow(root)
	var opened, revealed []string
	s := app.NewFileService(app.FileServiceOptions{
		Folders: folders,
		Open:    func(path string) error { opened = append(opened, path); return nil },
		Reveal:  func(path string) error { revealed = append(revealed, path); return nil },
	})
	programs := []string{"setup.exe", "run.sh", "Tool.app", "folder", "run", "page.hta", "script.js", "setup.exe.", "flow.workflow", "Tool.app/Contents/MacOS/Tool"}
	for _, rel := range append([]string{"notes.pdf"}, programs...) {
		if err := s.OpenFile(root, rel); err != "" {
			t.Errorf("%s: %s", rel, err)
		}
	}
	if len(opened) != 1 || opened[0] != filepath.Join(root, "notes.pdf") {
		t.Errorf("opened %v", opened)
	}
	if len(revealed) != len(programs) {
		t.Errorf("revealed %v", revealed)
	}
	if err := s.OpenFile(t.TempDir(), "notes.pdf"); err == "" {
		t.Error("a file outside the opened folders was opened")
	}
}

// A folder linked from inside the opened one leads out of it: nothing
// through it is opened or read.
func TestOpenFileAndFileDetailsNeverGoThroughALink(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("links need privileges on Windows")
	}
	root, elsewhere := t.TempDir(), t.TempDir()
	writeFile(t, elsewhere, "doc.pdf", "outside")
	if err := os.Symlink(elsewhere, filepath.Join(root, "linked")); err != nil {
		t.Fatal(err)
	}
	folders := app.NewOpenedFolders()
	folders.Allow(root)
	var opened []string
	s := app.NewFileService(app.FileServiceOptions{Folders: folders, Open: func(p string) error { opened = append(opened, p); return nil }, Reveal: func(string) error { return nil }})
	if err := s.OpenFile(root, "linked/doc.pdf"); err == "" || len(opened) != 0 {
		t.Errorf("opened through a link: %q %v", err, opened)
	}
	if got := s.FileDetails(root, "linked/doc.pdf"); got.Exists || got.Error == "" {
		t.Errorf("read through a link: %+v", got)
	}
}

func TestFileRouteServesASitesIcon(t *testing.T) {
	root := t.TempDir()
	writeFile(t, root, ".bava/attachments/example.com icon.ico", "ico")
	folders := app.NewOpenedFolders()
	folders.Allow(root)
	if rec := served(t, folders, root, ".bava/attachments/example.com icon.ico", nil); rec.Code != http.StatusOK || rec.Header().Get("Content-Type") != "image/x-icon" {
		t.Errorf("served %d %q", rec.Code, rec.Header().Get("Content-Type"))
	}
}
