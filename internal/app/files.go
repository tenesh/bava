package app

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
	"golang.design/x/clipboard"
)

// OpenedFolders are the folders the user opened this session: Spaces, and the
// folders of pages opened on their own. The page may be shown images and
// videos from these, and from nowhere else.
type OpenedFolders struct {
	mu      sync.Mutex
	folders map[string]bool
}

// NewOpenedFolders is an empty set: nothing is allowed until opened.
func NewOpenedFolders() *OpenedFolders { return &OpenedFolders{folders: map[string]bool{}} }

// Allow adds a folder the user opened. A nil set allows nothing, and adds
// nothing.
func (f *OpenedFolders) Allow(dir string) {
	if f == nil || !filepath.IsAbs(dir) {
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	f.folders[filepath.Clean(dir)] = true
}

// Allowed reports whether a folder was opened this session.
func (f *OpenedFolders) Allowed(dir string) bool {
	if f == nil || !filepath.IsAbs(dir) {
		return false
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.folders[filepath.Clean(dir)]
}

// FileRoutePrefix is where the page asks for a file: /bava-file/?root=&path=.
const FileRoutePrefix = "/bava-file/"

// mediaTypes are the files the route serves, by extension: images and videos.
var mediaTypes = map[string]string{
	".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
	".webp": "image/webp", ".svg": "image/svg+xml", ".ico": "image/x-icon",
	".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime",
}

// FileRoute serves the page an image or a video from a folder the user
// opened (docs/ipc.md, "Files the page shows"). root is the opened folder and
// path a file inside it: never outside it, never through a link, never a
// hidden file but the Space's attachments, never anything but an image or a
// video. Anything else is not found. Other requests go on to the app.
func FileRoute(folders *OpenedFolders) application.Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !strings.HasPrefix(r.URL.Path, FileRoutePrefix) {
				next.ServeHTTP(w, r)
				return
			}
			rel, kind, err := servable(folders, r.URL.Query().Get("root"), r.URL.Query().Get("path"))
			if err != nil {
				http.NotFound(w, r)
				return
			}
			// Opened through the folder itself: nothing can lead out of it
			// between the checks and the open.
			dir, err := os.OpenRoot(filepath.Clean(r.URL.Query().Get("root")))
			if err != nil {
				http.NotFound(w, r)
				return
			}
			defer dir.Close()
			file, err := dir.Open(rel)
			if err != nil {
				http.NotFound(w, r)
				return
			}
			defer file.Close()
			info, err := file.Stat()
			if err != nil || !info.Mode().IsRegular() {
				http.NotFound(w, r)
				return
			}
			w.Header().Set("Content-Type", kind)
			// Only ever an image or a video: never sniffed as something else,
			// and never run as a page (an SVG's script) if one is opened.
			w.Header().Set("X-Content-Type-Options", "nosniff")
			w.Header().Set("Content-Security-Policy", "sandbox; default-src 'none'; style-src 'unsafe-inline'")
			// Ranges are served, so a video seeks.
			http.ServeContent(w, r, info.Name(), info.ModTime(), file)
		})
	}
}

// servable is the file a request names, relative to its folder in the
// platform's form, and its type, when the route may serve it.
func servable(folders *OpenedFolders, root, rel string) (string, string, error) {
	// A backslash or a colon is a way out on Windows (`a\..\..`, `C:`, a
	// share, a stream): refused everywhere, so every platform serves alike.
	if !folders.Allowed(root) || rel == "" || path.IsAbs(rel) || filepath.IsAbs(rel) || strings.ContainsAny(rel, `\:`) {
		return "", "", errors.New("not served")
	}
	clean := path.Clean(rel)
	if clean == ".." || strings.HasPrefix(clean, "../") {
		return "", "", errors.New("not served")
	}
	parts := strings.Split(clean, "/")
	attachment := len(parts) == 3 && parts[0] == ".bava" && parts[1] == "attachments"
	for i, part := range parts {
		if strings.HasPrefix(part, ".") && !(attachment && i < 2) {
			return "", "", errors.New("not served")
		}
	}
	kind, ok := mediaTypes[strings.ToLower(path.Ext(clean))]
	if !ok {
		return "", "", errors.New("not served")
	}
	if _, err := noLinks(root, clean); err != nil {
		return "", "", errors.New("not served")
	}
	return filepath.FromSlash(clean), kind, nil
}

// noLinks is the file at clean (a cleaned, relative, slash-separated path)
// inside root, when no part of the way to it is a link: one could lead out
// of the folder.
func noLinks(root, clean string) (string, error) {
	at := filepath.Clean(root)
	for _, part := range strings.Split(clean, "/") {
		at = filepath.Join(at, part)
		info, err := os.Lstat(at)
		if err != nil {
			return "", err
		}
		if info.Mode()&os.ModeSymlink != 0 {
			return "", errors.New("the way to it is a link")
		}
	}
	return at, nil
}

// ReadClipboardImage is the clipboard's image as PNG, whatever the copying
// app used, or nil when the clipboard holds none or cannot be reached.
func ReadClipboardImage() []byte {
	if err := clipboard.Init(); err != nil {
		slog.Debug("clipboard unavailable", "err", err)
		return nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	data, err := clipboard.Read(ctx, clipboard.FmtImage)
	if err != nil {
		return nil
	}
	return data
}

// inOpened is the file at rel inside root, a folder the user opened; an
// error for anywhere else. As the file route, it refuses \ and : in rel.
func inOpened(folders *OpenedFolders, root, rel string) (string, error) {
	if !folders.Allowed(root) || rel == "" || path.IsAbs(rel) || filepath.IsAbs(rel) || strings.ContainsAny(rel, `\:`) {
		return "", errors.New("not a file in a folder you opened")
	}
	clean := path.Clean(rel)
	if clean == ".." || strings.HasPrefix(clean, "../") {
		return "", errors.New("not a file in a folder you opened")
	}
	return clean, nil
}

// FileDetailsResult is what a file card shows of a file: whether it is
// there, its size in bytes, and when it was last changed (RFC 3339).
type FileDetailsResult struct {
	Exists   bool   `json:"exists"`
	Size     int64  `json:"size"`
	Modified string `json:"modified"`
	Error    string `json:"error"`
}

// FileDetails reads a file card's details from the file, inside a folder the
// user opened. A file that is not there is no error: its card says so.
func (s *FileService) FileDetails(root, rel string) FileDetailsResult {
	clean, err := inOpened(s.options.Folders, root, rel)
	if err != nil {
		return FileDetailsResult{Error: err.Error()}
	}
	full, err := noLinks(root, clean)
	if errors.Is(err, os.ErrNotExist) {
		return FileDetailsResult{}
	}
	if err != nil {
		return FileDetailsResult{Error: err.Error()}
	}
	info, err := os.Lstat(full)
	if err != nil {
		return FileDetailsResult{Error: err.Error()}
	}
	return FileDetailsResult{Exists: true, Size: info.Size(), Modified: info.ModTime().UTC().Format(time.RFC3339)}
}

// documents are the files a click opens in their own app, by type: things
// to read, look at or listen to. Anything else (a program, a script, a file
// with no type, one whose name ends in a dot or a space) is shown in its
// folder instead, so one click never runs code. A list of what may open,
// never of what may not: a missed program type is shown, not run.
var documents = map[string]bool{
	".pdf": true, ".txt": true, ".md": true, ".rtf": true, ".doc": true, ".docx": true, ".odt": true, ".pages": true,
	".csv": true, ".tsv": true, ".xls": true, ".xlsx": true, ".ods": true, ".numbers": true,
	".ppt": true, ".pptx": true, ".odp": true, ".key": true,
	".png": true, ".jpg": true, ".jpeg": true, ".gif": true, ".webp": true, ".heic": true, ".tif": true, ".tiff": true, ".bmp": true,
	".mp3": true, ".wav": true, ".m4a": true, ".aac": true, ".flac": true, ".ogg": true,
	".mp4": true, ".mov": true, ".webm": true, ".mkv": true, ".avi": true,
	".zip": true,
}

// OpenFile opens a document of a folder the user opened in its own app, as
// a file card's click does; anything else is shown in its folder (see
// documents). A link on the way to it is refused. An error is its message.
func (s *FileService) OpenFile(root, rel string) string {
	clean, err := inOpened(s.options.Folders, root, rel)
	if err != nil {
		return err.Error()
	}
	full, err := noLinks(root, clean)
	if err != nil {
		return err.Error()
	}
	info, err := os.Lstat(full)
	if err != nil {
		return err.Error()
	}
	open, reveal := s.options.Open, s.options.Reveal
	if open == nil {
		open = func(path string) error { return application.Get().Browser.OpenFile(path) }
	}
	if reveal == nil {
		reveal = func(path string) error { return application.Get().Env.OpenFileManager(path, true) }
	}
	name := filepath.Base(full)
	plain := strings.TrimRight(name, ". ") == name
	if !info.Mode().IsRegular() || !plain || !documents[strings.ToLower(filepath.Ext(name))] {
		err = reveal(full)
	} else {
		err = open(full)
	}
	if err != nil {
		return err.Error()
	}
	return ""
}
