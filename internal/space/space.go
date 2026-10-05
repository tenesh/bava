package space

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"strings"
)

// Dir is the hidden folder a Space keeps its own data in.
const Dir = ".bava"

// Kinds of entry in a Space.
const (
	KindPage   = "page"
	KindFolder = "folder"
	// KindAttachment is a file of .bava/attachments, in the Trash.
	KindAttachment = "attachment"
)

// PageExt is the extension of a page.
const PageExt = ".md"

// Space is a folder opened as a Space.
type Space struct {
	// Root is the Space's folder, absolute.
	Root string
}

// Entry is a page or folder in a Space.
type Entry struct {
	Name string `json:"name"`
	// Path is relative to the Space, with "/" between folders.
	Path string `json:"path"`
	Kind string `json:"kind"`
}

// Open opens a folder as a Space, creating .bava/space.json when missing.
func Open(dir string) (Space, error) {
	abs, err := filepath.Abs(dir)
	if err != nil {
		return Space{}, fmt.Errorf("open space: %w", err)
	}
	info, err := os.Stat(abs)
	if err != nil {
		return Space{}, fmt.Errorf("open space: %w", err)
	}
	if !info.IsDir() {
		return Space{}, fmt.Errorf("open space: %s is not a folder", filepath.Base(abs))
	}
	s := Space{Root: abs}
	if err := os.MkdirAll(filepath.Join(abs, Dir), 0o755); err != nil {
		return Space{}, fmt.Errorf("open space: %w", err)
	}
	if _, err := os.Stat(s.spaceFile()); errors.Is(err, os.ErrNotExist) {
		if err := WriteFile(s.spaceFile(), File{Version: Version}); err != nil {
			return Space{}, fmt.Errorf("open space: %w", err)
		}
	}
	return s, nil
}

// Create makes a new folder named name inside parent, an absolute path the
// user chose, and opens it as a Space. A name that is taken is refused:
// nothing is overwritten.
func Create(parent, name string) (Space, error) {
	if !filepath.IsAbs(parent) {
		return Space{}, refuse(ErrOutside, "new space: %q is not an absolute place", parent)
	}
	name, err := validName(name)
	if err != nil {
		return Space{}, err
	}
	dir := filepath.Join(parent, name)
	if err := os.Mkdir(dir, 0o755); err != nil {
		if errors.Is(err, os.ErrExist) {
			return Space{}, refuse(ErrExists, "%q already exists", name)
		}
		return Space{}, fmt.Errorf("new space: %w", err)
	}
	return Open(dir)
}

// List returns a folder's pages and folders in the Space's order: folders
// and .md pages only, never a hidden entry or .bava.
func (s Space) List(folder string) ([]Entry, error) {
	rel, err := s.resolve(folder)
	if err != nil {
		return nil, err
	}
	kinds, err := s.children(rel)
	if err != nil {
		return nil, err
	}
	f, err := ReadFile(s.spaceFile())
	if err != nil {
		return nil, err
	}
	present := make([]string, 0, len(kinds))
	for name := range kinds {
		present = append(present, name)
	}
	var out []Entry
	for _, name := range Ordered(f.Order[rel], present) {
		out = append(out, Entry{Name: name, Path: join(rel, name), Kind: kinds[name]})
	}
	return out, nil
}

// children reads a folder's pages and folders, by kind.
func (s Space) children(rel string) (map[string]string, error) {
	items, err := os.ReadDir(s.abs(rel))
	if err != nil {
		return nil, fmt.Errorf("list %s: %w", display(rel), err)
	}
	out := map[string]string{}
	for _, item := range items {
		name := item.Name()
		// Hidden entries and links are not listed: every operation refuses a
		// path through a link.
		if strings.HasPrefix(name, ".") || item.Type()&fs.ModeSymlink != 0 {
			continue
		}
		switch {
		case item.IsDir():
			out[name] = KindFolder
		case strings.EqualFold(filepath.Ext(name), PageExt):
			out[name] = KindPage
		}
	}
	return out, nil
}

// Load is a Space already opened: an absolute folder holding .bava. The
// frontend hands roots back to Go, so each call checks it is one.
func Load(root string) (Space, error) {
	if root == "" || !filepath.IsAbs(root) {
		return Space{}, refuse(ErrNotSpace, "%q is not a Space", root)
	}
	if info, err := os.Stat(filepath.Join(root, Dir)); err != nil || !info.IsDir() {
		return Space{}, refuse(ErrNotSpace, "%s is not a Space", filepath.Base(root))
	}
	return Space{Root: filepath.Clean(root)}, nil
}

// Abs is a path given relative to the Space, made absolute; one that leaves
// the Space, is hidden, or goes through a link is refused.
func (s Space) Abs(p string) (string, error) {
	rel, err := s.resolve(p)
	if err != nil {
		return "", err
	}
	return s.abs(rel), nil
}

// resolve cleans a path given relative to the Space and refuses one that goes
// through a symbolic link: a link to a folder outside would take pages out.
func (s Space) resolve(p string) (string, error) {
	rel, err := clean(p)
	if err != nil || rel == "" {
		return rel, err
	}
	parts := strings.Split(rel, "/")
	for i := range parts {
		info, err := os.Lstat(s.abs(strings.Join(parts[:i+1], "/")))
		if err != nil {
			// Not there (yet): nothing further can be a link.
			return rel, nil
		}
		if info.Mode()&os.ModeSymlink != 0 {
			return "", refuse(ErrThroughLink, "%q goes through a link", p)
		}
	}
	return rel, nil
}

// replaces reports whether moving from onto to would replace another file:
// true when something is at to that is not the same file (a rename changing
// only case lands on itself on a case-insensitive disk).
func (s Space) replaces(from, to string) bool {
	target, err := os.Lstat(to)
	if err != nil {
		return false
	}
	source, err := os.Lstat(from)
	return err != nil || !os.SameFile(source, target)
}

// PageWidth returns the Space's default page width, or "" for none.
func (s Space) PageWidth() (string, error) {
	f, err := ReadFile(s.spaceFile())
	return f.PageWidth, err
}

// SetPageWidth sets the Space's default page width: narrow, wide, full, or
// "" to clear it.
func (s Space) SetPageWidth(width string) error {
	switch width {
	case "", "narrow", "wide", "full":
	default:
		return fmt.Errorf("page width %q: not narrow, wide or full", width)
	}
	return s.update(func(f *File) error {
		f.PageWidth = width
		return nil
	})
}

// DeleteData deletes the Space's .bava folder for good: its attachments, its
// Trash (pages in it included), its page order and settings. The pages in the
// Space's folders are kept. A .bava that is not a plain folder (a link most
// of all) is refused, so nothing outside the Space can be deleted through it.
func (s Space) DeleteData() error {
	dir := filepath.Join(s.Root, Dir)
	info, err := os.Lstat(dir)
	if err != nil {
		return fmt.Errorf("delete space data: %w", err)
	}
	if info.Mode()&os.ModeSymlink != 0 {
		return refuse(ErrThroughLink, "delete space data: %s is a link", dir)
	}
	if !info.IsDir() {
		return refuse(ErrNotFolder, "delete space data: %s is not a folder", dir)
	}
	if err := os.RemoveAll(dir); err != nil {
		return fmt.Errorf("delete space data: %w", err)
	}
	return nil
}

func (s Space) spaceFile() string { return filepath.Join(s.Root, Dir, "space.json") }
func (s Space) trashDir() string  { return filepath.Join(s.Root, Dir, "trash") }

// abs turns a cleaned relative path into an absolute one inside the Space.
func (s Space) abs(rel string) string {
	return filepath.Join(s.Root, filepath.FromSlash(rel))
}

// update reads space.json, changes it and writes it back, dropping order
// entries for names that are gone.
func (s Space) update(change func(f *File) error) error {
	f, err := ReadFile(s.spaceFile())
	if err != nil {
		return err
	}
	if f.Order == nil {
		f.Order = map[string][]string{}
	}
	if err := change(&f); err != nil {
		return err
	}
	f.Prune(func(folder, name string) bool {
		_, err := os.Lstat(s.abs(join(folder, name)))
		return err == nil
	})
	return WriteFile(s.spaceFile(), f)
}

// arranged is a folder's names as shown now, so an edit to the order starts
// from what the user sees.
func (s Space) arranged(f *File, folder string) []string {
	kinds, err := s.children(folder)
	if err != nil {
		return append([]string(nil), f.Order[folder]...)
	}
	present := make([]string, 0, len(kinds))
	for name := range kinds {
		present = append(present, name)
	}
	return Ordered(f.Order[folder], present)
}

// clean checks a path given relative to the Space: never absolute, never
// leaving the Space, never hidden (which keeps .bava out of reach).
func clean(rel string) (string, error) {
	if rel == "" || rel == "." {
		return "", nil
	}
	if filepath.IsAbs(rel) || strings.HasPrefix(rel, "/") || strings.HasPrefix(rel, "\\") {
		return "", refuse(ErrOutside, "%q is not a path inside the Space", rel)
	}
	p := path.Clean(filepath.ToSlash(rel))
	for _, part := range strings.Split(p, "/") {
		if part == ".." {
			return "", refuse(ErrOutside, "%q leaves the Space", rel)
		}
		if strings.HasPrefix(part, ".") {
			return "", refuse(ErrOutside, "%q is hidden", rel)
		}
	}
	return p, nil
}

// validName checks a name the user typed for a page or folder.
func validName(name string) (string, error) {
	name = strings.TrimSpace(name)
	switch {
	case name == "":
		return "", refuse(ErrNameEmpty, "a name is needed")
	case strings.ContainsAny(name, "/\\\x00"):
		return "", refuse(ErrNameSlash, "%q: a name cannot hold / or \\", name)
	case strings.HasPrefix(name, "."):
		return "", refuse(ErrNameDot, "%q: a name cannot start with a dot", name)
	case strings.ContainsAny(name, `:*?"<>|`) || strings.HasSuffix(name, "."):
		return "", refuse(ErrNameReserved, "%q: a name cannot hold : * ? \" < > | or end with a dot", name)
	case reservedOnWindows(name):
		return "", refuse(ErrNameReserved, "%q is a name Windows keeps for devices", name)
	}
	return name, nil
}

// reservedOnWindows reports a device name Windows refuses as a file name,
// with or without an extension: CON, PRN, AUX, NUL, COM1-9, LPT1-9. Refused on
// every platform so a Space opens intact wherever it is copied.
func reservedOnWindows(name string) bool {
	base := strings.ToUpper(strings.TrimSpace(strings.SplitN(name, ".", 2)[0]))
	switch base {
	case "CON", "PRN", "AUX", "NUL":
		return true
	}
	if len(base) == 4 && (strings.HasPrefix(base, "COM") || strings.HasPrefix(base, "LPT")) {
		return base[3] >= '1' && base[3] <= '9'
	}
	return false
}

// join puts a name in a folder, as a relative path.
func join(folder, name string) string {
	if folder == "" {
		return name
	}
	return folder + "/" + name
}

func parent(rel string) string {
	dir := path.Dir(rel)
	if dir == "." {
		return ""
	}
	return dir
}

func display(rel string) string {
	if rel == "" {
		return "the Space"
	}
	return rel
}
