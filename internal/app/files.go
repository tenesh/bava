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
	".webp": "image/webp", ".svg": "image/svg+xml",
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
	// No part of the way may be a link: one could lead out of the folder.
	at := filepath.Clean(root)
	for _, part := range parts {
		at = filepath.Join(at, part)
		info, err := os.Lstat(at)
		if err != nil || info.Mode()&os.ModeSymlink != 0 {
			return "", "", errors.New("not served")
		}
	}
	return filepath.FromSlash(clean), kind, nil
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
