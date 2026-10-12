package space

import (
	"archive/zip"
	"context"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"

	"github.com/tharabyte/bava/internal/store"
)

// The kinds of zip: the whole Space, one folder, or one page.
const (
	ZipSpace  = "space"
	ZipFolder = "folder"
	ZipPage   = "page"
)

// ZipScope is what a Markdown zip exports. A folder or a page carries the
// attachments its pages use, by name, as the frontend reads them; a Space
// carries everything.
type ZipScope struct {
	Kind        string   `json:"kind"`
	Path        string   `json:"path"`
	Attachments []string `json:"attachments"`
}

// ZipFile is one file of a zip: its path there and its size.
type ZipFile struct {
	Path string `json:"path"`
	Size int64  `json:"size"`
}

// ZipPlan lists what a zip of scope will hold, sorted by path.
//
// A Space's zip is every file of the Space as it lies, and its .bava folder
// without the Trash, so it reopens as the same Space. A folder's or a page's
// keeps its place in the Space and carries only the attachments named, so
// every link to them still works; it has no templates and no settings,
// which belong to the whole Space. Hidden files and links are never
// followed into a zip.
func (s Space) ZipPlan(scope ZipScope) ([]ZipFile, error) {
	var files []ZipFile
	var err error
	switch scope.Kind {
	case ZipSpace:
		files, err = s.zipTree("")
	case ZipFolder:
		rel, resolveErr := s.existing(scope.Path)
		if resolveErr != nil {
			return nil, resolveErr
		}
		if s.kindOf(rel) != KindFolder {
			return nil, refuse(ErrNotFolder, "%s is not a folder", display(rel))
		}
		files, err = s.zipTree(rel)
	case ZipPage:
		if rel, existErr := s.existing(scope.Path); existErr == nil && s.kindOf(rel) == KindFolder {
			return nil, refuse(ErrNotPage, "%s is not a page", display(rel))
		}
		rel, pageErr := s.existingPage(scope.Path)
		if pageErr != nil {
			return nil, pageErr
		}
		files, err = s.zipFiles([]string{rel})
	default:
		return nil, fmt.Errorf("unknown zip %q", scope.Kind)
	}
	if err != nil {
		return nil, err
	}
	if scope.Kind != ZipSpace {
		for _, name := range scope.Attachments {
			p, attachErr := s.AttachmentPath(name)
			if attachErr != nil {
				return nil, attachErr
			}
			info, statErr := os.Stat(p)
			if statErr != nil {
				return nil, fmt.Errorf("read %s: %w", name, statErr)
			}
			files = append(files, ZipFile{Path: path.Join(Dir, "attachments", name), Size: info.Size()})
		}
	}
	sort.Slice(files, func(i, j int) bool { return files[i].Path < files[j].Path })
	return dedupe(files), nil
}

// zipTree is every plain file under rel ("" for the whole Space): hidden
// entries and links passed over, except the Space's own .bava, whose Trash
// stays behind.
func (s Space) zipTree(rel string) ([]ZipFile, error) {
	var out []ZipFile
	var walk func(dir string) error
	walk = func(dir string) error {
		entries, err := os.ReadDir(s.abs(dir))
		if err != nil {
			return fmt.Errorf("read %s: %w", display(dir), err)
		}
		for _, e := range entries {
			name := e.Name()
			p := join(dir, name)
			if strings.HasPrefix(name, ".") && p != Dir {
				continue
			}
			if p == Dir+"/trash" {
				continue
			}
			info, err := os.Lstat(s.abs(p))
			if err != nil {
				return fmt.Errorf("read %s: %w", display(p), err)
			}
			switch {
			case info.Mode()&os.ModeSymlink != 0:
				continue
			case info.IsDir():
				if err := walk(p); err != nil {
					return err
				}
			case info.Mode().IsRegular():
				out = append(out, ZipFile{Path: p, Size: info.Size()})
			}
		}
		return nil
	}
	return out, walk(rel)
}

// zipFiles is the given files of the Space with their sizes.
func (s Space) zipFiles(rels []string) ([]ZipFile, error) {
	var out []ZipFile
	for _, rel := range rels {
		info, err := os.Lstat(s.abs(rel))
		if err != nil {
			return nil, fmt.Errorf("read %s: %w", display(rel), err)
		}
		out = append(out, ZipFile{Path: rel, Size: info.Size()})
	}
	return out, nil
}

func dedupe(files []ZipFile) []ZipFile {
	out := files[:0]
	for i, f := range files {
		if i > 0 && f.Path == files[i-1].Path {
			continue
		}
		out = append(out, f)
	}
	return out
}

// WriteZip writes the zip of scope to out, a full path: through the
// store's atomic save, so a failure never leaves half a zip there. Each file
// is read through the Space's root, so one swapped for a link after it was
// planned is not followed out of the Space. progress, when not nil, is told
// after each file; a cancelled ctx stops it, leaving nothing at out, and is
// returned as its error.
func (s Space) WriteZip(ctx context.Context, scope ZipScope, out string, progress func(done, total int)) error {
	if out == "" || !filepath.IsAbs(out) {
		return refuse(ErrOutside, "the zip's place must be a full path, not %q", out)
	}
	plan, err := s.ZipPlan(scope)
	if err != nil {
		return err
	}
	root, err := os.OpenRoot(s.Root)
	if err != nil {
		return fmt.Errorf("open the Space: %w", err)
	}
	defer root.Close()
	read, write := io.Pipe()
	go func() {
		w := zip.NewWriter(write)
		for i, f := range plan {
			// A cancel ends the write with its error: the temporary file
			// goes, and nothing is left at out.
			if err := ctx.Err(); err != nil {
				write.CloseWithError(err)
				return
			}
			if err := addToZip(w, root, f.Path); err != nil {
				write.CloseWithError(err)
				return
			}
			if progress != nil {
				progress(i+1, len(plan))
			}
		}
		write.CloseWithError(w.Close())
	}()
	err = store.SaveFrom(out, read)
	read.Close()
	return err
}

// addToZip copies one file of the Space into the zip, with its time.
func addToZip(w *zip.Writer, root *os.Root, rel string) error {
	src, err := root.Open(filepath.FromSlash(rel))
	if err != nil {
		return fmt.Errorf("read %s: %w", display(rel), err)
	}
	defer src.Close()
	info, err := src.Stat()
	if err != nil {
		return fmt.Errorf("read %s: %w", display(rel), err)
	}
	header, err := zip.FileInfoHeader(info)
	if err != nil {
		return fmt.Errorf("zip %s: %w", display(rel), err)
	}
	header.Name = rel
	header.Method = zip.Deflate
	dst, err := w.CreateHeader(header)
	if err != nil {
		return fmt.Errorf("zip %s: %w", display(rel), err)
	}
	if _, err := io.Copy(dst, src); err != nil {
		return fmt.Errorf("zip %s: %w", display(rel), err)
	}
	return nil
}
