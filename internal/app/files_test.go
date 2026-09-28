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
	if len(asked) != 2 || asked[0] != "image" || asked[1] != "video" {
		t.Errorf("asked for %v", asked)
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
