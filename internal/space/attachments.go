package space

import (
	"bytes"
	"crypto/sha256"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/tenesh/bava/internal/store"
)

// attachmentsDir is where a Space keeps the files its pages show.
func (s Space) attachmentsDir() string { return filepath.Join(s.Root, Dir, "attachments") }

// PastedImageName is the name a pasted image with none of its own is saved
// under: "Pasted image 2026-09-29 14.32.05.png".
func PastedImageName(at time.Time) string {
	return "Pasted image " + at.Format("2006-01-02 15.04.05") + ".png"
}

// Attach copies a file from anywhere into the attachments and returns the
// name it is kept under: its own, or numbered when a different file has that
// name; an identical file already there is used instead of a second copy.
func (s Space) Attach(source string) (string, error) {
	info, err := os.Stat(source)
	if err != nil || !info.Mode().IsRegular() {
		return "", fmt.Errorf("attach %s: not a file", filepath.Base(source))
	}
	open := func() (io.ReadCloser, error) { return os.Open(source) }
	return s.attach(filepath.Base(source), info.Size(), open)
}

// AttachData saves bytes, a pasted image, into the attachments under name,
// with the same rules as Attach.
func (s Space) AttachData(name string, data []byte) (string, error) {
	open := func() (io.ReadCloser, error) { return io.NopCloser(bytes.NewReader(data)), nil }
	return s.attach(name, int64(len(data)), open)
}

// attaching is held while a name is chosen and its file written, and while
// one is renamed: two files added at once never take the same free name.
var attaching sync.Mutex

func (s Space) attach(name string, size int64, open func() (io.ReadCloser, error)) (string, error) {
	attaching.Lock()
	defer attaching.Unlock()
	name, err := validName(name)
	if err != nil {
		return "", err
	}
	dir, err := s.attachmentsFolder()
	if err != nil {
		return "", err
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", fmt.Errorf("attach %s: %w", name, err)
	}
	sum, err := hashOf(open)
	if err != nil {
		return "", fmt.Errorf("attach %s: %w", name, err)
	}
	if same, err := s.identical(size, sum); err != nil {
		return "", err
	} else if same != "" {
		return same, nil
	}
	if _, err := os.Lstat(filepath.Join(dir, name)); err == nil {
		ext := filepath.Ext(name)
		name = s.freeAttachmentName(strings.TrimSuffix(name, ext), ext)
	}
	r, err := open()
	if err != nil {
		return "", fmt.Errorf("attach %s: %w", name, err)
	}
	defer r.Close()
	if err := store.SaveFrom(filepath.Join(dir, name), r); err != nil {
		return "", err
	}
	return name, nil
}

// identical is the name of an attachment holding exactly these bytes, or "".
func (s Space) identical(size int64, sum []byte) (string, error) {
	entries, err := os.ReadDir(s.attachmentsDir())
	if err != nil {
		return "", fmt.Errorf("read attachments: %w", err)
	}
	for _, entry := range entries {
		info, err := entry.Info()
		if err != nil || !info.Mode().IsRegular() || info.Size() != size {
			continue
		}
		path := filepath.Join(s.attachmentsDir(), entry.Name())
		other, err := hashOf(func() (io.ReadCloser, error) { return os.Open(path) })
		if err == nil && bytes.Equal(other, sum) {
			return entry.Name(), nil
		}
	}
	return "", nil
}

func hashOf(open func() (io.ReadCloser, error)) ([]byte, error) {
	r, err := open()
	if err != nil {
		return nil, err
	}
	defer r.Close()
	h := sha256.New()
	if _, err := io.Copy(h, r); err != nil {
		return nil, err
	}
	return h.Sum(nil), nil
}

// freeAttachmentName is "base 2.ext", "base 3.ext" and on: the first not taken.
func (s Space) freeAttachmentName(base, ext string) string {
	for n := 2; ; n++ {
		name := fmt.Sprintf("%s %d%s", base, n, ext)
		if _, err := os.Lstat(filepath.Join(s.attachmentsDir(), name)); errors.Is(err, os.ErrNotExist) {
			return name
		}
	}
}

// RenameAttachment renames a file in the attachments, keeping its extension
// whatever the name typed; a name taken by another file is refused. Pages
// that show it are rewritten by the caller, as for a page's rename.
func (s Space) RenameAttachment(name, next string) (string, error) {
	attaching.Lock()
	defer attaching.Unlock()
	from, err := s.AttachmentPath(name)
	if err != nil {
		return "", err
	}
	next, err = validName(next)
	if err != nil {
		return "", err
	}
	ext := filepath.Ext(name)
	if !strings.EqualFold(filepath.Ext(next), ext) {
		next += ext
	}
	to := filepath.Join(s.attachmentsDir(), next)
	if s.replaces(from, to) {
		return "", refuse(ErrExists, "%q already exists", next)
	}
	if err := os.Rename(from, to); err != nil {
		return "", fmt.Errorf("rename %s: %w", name, err)
	}
	return next, nil
}

// attachmentsRel is the attachments folder, relative to the Space.
const attachmentsRel = Dir + "/attachments"

// Attachment is a file of the attachments folder: its name, size in bytes,
// and date modified (RFC 3339), which is when Bava attached it.
type Attachment struct {
	Name     string `json:"name"`
	Size     int64  `json:"size"`
	Modified string `json:"modified"`
}

// Attachments lists the attachments folder's files by name: none when it is
// not there yet. Folders, links and hidden files in it are not attachments.
func (s Space) Attachments() ([]Attachment, error) {
	dir, err := s.attachmentsFolder()
	if err != nil {
		return nil, err
	}
	entries, err := os.ReadDir(dir)
	if errors.Is(err, os.ErrNotExist) {
		return []Attachment{}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read attachments: %w", err)
	}
	out := []Attachment{}
	for _, entry := range entries {
		if !entry.Type().IsRegular() || strings.HasPrefix(entry.Name(), ".") {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		out = append(out, Attachment{Name: entry.Name(), Size: info.Size(), Modified: info.ModTime().UTC().Format(time.RFC3339)})
	}
	return out, nil
}

// TrashAttachment moves an attachment to the Trash, where it can be
// restored to the attachments folder.
func (s Space) TrashAttachment(name string) (TrashItem, error) {
	if _, err := s.AttachmentPath(name); err != nil {
		return TrashItem{}, err
	}
	attaching.Lock()
	defer attaching.Unlock()
	return s.trash(attachmentsRel+"/"+name, KindAttachment)
}

// AttachmentPath is where an attachment is on disk, by its exact name as the
// folder lists it (never trimmed: that could be another file); the
// attachments folder is hidden, so Space paths do not reach it. An error
// when no plain file of that name is there.
func (s Space) AttachmentPath(name string) (string, error) {
	if name == "" || name == "." || name == ".." || strings.HasPrefix(name, ".") || strings.ContainsAny(name, "/\\\x00") {
		return "", refuse(ErrNotAttachment, "%q is not an attachment", name)
	}
	dir, err := s.attachmentsFolder()
	if err != nil {
		return "", err
	}
	path := filepath.Join(dir, name)
	if info, err := os.Lstat(path); err != nil || !info.Mode().IsRegular() {
		return "", refuse(ErrNotAttachment, "%q is not an attachment", name)
	}
	return path, nil
}

// attachmentsFolder is the attachments folder, when neither it nor .bava is
// a link: one could lead out of the Space. It may not be there yet.
func (s Space) attachmentsFolder() (string, error) {
	for _, dir := range []string{filepath.Join(s.Root, Dir), s.attachmentsDir()} {
		if info, err := os.Lstat(dir); err == nil && info.Mode()&os.ModeSymlink != 0 {
			return "", refuse(ErrThroughLink, "%s is a link", dir)
		}
	}
	return s.attachmentsDir(), nil
}
