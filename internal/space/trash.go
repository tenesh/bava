package space

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// TrashItem is a page, a folder or an attachment in the Trash
// (docs/file-format.md, "Spaces").
type TrashItem struct {
	ID string `json:"id"`
	// Path is where it came from, relative to the Space.
	Path      string `json:"path"`
	Kind      string `json:"kind"`
	DeletedAt string `json:"deletedAt"`
	// Size is its size on disk in bytes; not stored.
	Size int64 `json:"size"`
}

// itemFile is the stored part of a TrashItem: item.json.
type itemFile struct {
	Path      string `json:"path"`
	Kind      string `json:"kind"`
	DeletedAt string `json:"deletedAt"`
}

// Trash moves a page or folder, whole, into .bava/trash, where it stays until
// deleted from there or the Trash is emptied.
func (s Space) Trash(p string) (TrashItem, error) {
	rel, err := s.existing(p)
	if err != nil {
		return TrashItem{}, err
	}
	return s.trash(rel, s.kindOf(rel))
}

// trash moves rel, of a kind, into its own slot of the Trash. A page or a
// folder leaves the page order; an attachment was never in it.
func (s Space) trash(rel, kind string) (TrashItem, error) {
	id, err := newID()
	if err != nil {
		return TrashItem{}, err
	}
	slot := filepath.Join(s.trashDir(), id)
	if err := os.MkdirAll(slot, 0o755); err != nil {
		return TrashItem{}, fmt.Errorf("move to trash: %w", err)
	}
	// Until the item is in its slot, a failure leaves no slot behind: the
	// Trash would list it and could not restore it.
	moved := false
	defer func() {
		if !moved {
			_ = os.RemoveAll(slot)
		}
	}()
	stored := itemFile{Path: rel, Kind: kind, DeletedAt: time.Now().UTC().Format(time.RFC3339)}
	raw, err := json.MarshalIndent(stored, "", "  ")
	if err != nil {
		return TrashItem{}, fmt.Errorf("move to trash: %w", err)
	}
	if err := os.WriteFile(filepath.Join(slot, "item.json"), append(raw, '\n'), 0o644); err != nil {
		return TrashItem{}, fmt.Errorf("move to trash: %w", err)
	}
	var order []string
	dir, name := parent(rel), path.Base(rel)
	if kind != KindAttachment {
		if err := s.update(func(f *File) error {
			order = s.arranged(f, dir)
			return nil
		}); err != nil {
			return TrashItem{}, err
		}
	}
	if err := os.Rename(s.abs(rel), filepath.Join(slot, name)); err != nil {
		return TrashItem{}, fmt.Errorf("move to trash: %w", err)
	}
	moved = true
	item := TrashItem{ID: id, Path: rel, Kind: kind, DeletedAt: stored.DeletedAt}
	if kind == KindAttachment {
		return item, nil
	}
	return item, s.update(func(f *File) error {
		f.Order[dir] = remove(order, name)
		if kind == KindFolder {
			drop(f, rel)
		}
		return nil
	})
}

// TrashItems lists the Trash, most recently deleted first.
func (s Space) TrashItems() ([]TrashItem, error) {
	slots, err := os.ReadDir(s.trashDir())
	if errors.Is(err, fs.ErrNotExist) {
		return []TrashItem{}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read trash: %w", err)
	}
	items := []TrashItem{}
	for _, slot := range slots {
		if !slot.IsDir() {
			continue
		}
		stored, err := s.readItem(slot.Name())
		if err != nil {
			continue
		}
		items = append(items, TrashItem{
			ID: slot.Name(), Path: stored.Path, Kind: stored.Kind, DeletedAt: stored.DeletedAt,
			Size: sizeOf(filepath.Join(s.trashDir(), slot.Name(), path.Base(stored.Path))),
		})
	}
	sort.SliceStable(items, func(i, j int) bool { return items[i].DeletedAt > items[j].DeletedAt })
	return items, nil
}

// Restore moves an item back to where it came from, recreating missing
// folders; a name that is taken comes back numbered. Returns where it went.
func (s Space) Restore(id string) (string, error) {
	slot, err := s.slot(id)
	if err != nil {
		return "", err
	}
	stored, err := s.readItem(id)
	if err != nil {
		return "", err
	}
	if stored.Kind == KindAttachment {
		return s.restoreAttachment(slot, stored)
	}
	// Resolved, not only cleaned: a folder on the way back may have become a
	// link since the item was trashed.
	rel, err := s.resolve(stored.Path)
	if err != nil {
		return "", err
	}
	if rel == "" {
		return "", refuse(ErrOutside, "restore: %q is not a place in the Space", stored.Path)
	}
	dir, name := parent(rel), path.Base(rel)
	if err := os.MkdirAll(s.abs(dir), 0o755); err != nil {
		return "", fmt.Errorf("restore: %w", err)
	}
	back := name
	if _, err := os.Lstat(s.abs(rel)); err == nil {
		ext := ""
		if stored.Kind == KindPage {
			ext = filepath.Ext(name)
		}
		back = s.numbered(dir, strings.TrimSuffix(name, ext), ext)
	}
	target := join(dir, back)
	if err := os.Rename(filepath.Join(slot, name), s.abs(target)); err != nil {
		return "", fmt.Errorf("restore: %w", err)
	}
	if err := os.RemoveAll(slot); err != nil {
		return "", fmt.Errorf("restore: %w", err)
	}
	return target, s.update(func(f *File) error {
		f.Order[dir] = appendOnce(s.arranged(f, dir), back)
		return nil
	})
}

// DeleteForever removes one item from the Trash for good.
func (s Space) DeleteForever(id string) error {
	slot, err := s.slot(id)
	if err != nil {
		return err
	}
	if err := os.RemoveAll(slot); err != nil {
		return fmt.Errorf("delete: %w", err)
	}
	return nil
}

// EmptyTrash removes everything in the Trash for good.
func (s Space) EmptyTrash() error {
	if err := os.RemoveAll(s.trashDir()); err != nil {
		return fmt.Errorf("empty trash: %w", err)
	}
	return nil
}

// slot is the folder of one Trash item, refusing an id that is not one.
func (s Space) slot(id string) (string, error) {
	if id == "" || strings.ContainsAny(id, "/\\") || strings.HasPrefix(id, ".") {
		return "", fmt.Errorf("%q is not a Trash item", id)
	}
	slot := filepath.Join(s.trashDir(), id)
	if info, err := os.Stat(slot); err != nil || !info.IsDir() {
		return "", fmt.Errorf("%q is not in the Trash", id)
	}
	return slot, nil
}

func (s Space) readItem(id string) (itemFile, error) {
	var stored itemFile
	raw, err := os.ReadFile(filepath.Join(s.trashDir(), id, "item.json"))
	if err != nil {
		return stored, fmt.Errorf("read trash item: %w", err)
	}
	if err := json.Unmarshal(raw, &stored); err != nil {
		return stored, fmt.Errorf("read trash item: %w", err)
	}
	return stored, nil
}

func newID() (string, error) {
	random := make([]byte, 4)
	if _, err := rand.Read(random); err != nil {
		return "", fmt.Errorf("trash id: %w", err)
	}
	return fmt.Sprintf("%d-%s", time.Now().UnixNano(), hex.EncodeToString(random)), nil
}

// sizeOf is a file's size, or the total of a folder's files.
func sizeOf(p string) int64 {
	var total int64
	_ = filepath.WalkDir(p, func(_ string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil
		}
		if info, err := d.Info(); err == nil {
			total += info.Size()
		}
		return nil
	})
	return total
}

// restoreAttachment puts an attachment back in the attachments folder,
// numbered when its name was taken meanwhile. The page order is untouched.
func (s Space) restoreAttachment(slot string, stored itemFile) (string, error) {
	name := path.Base(stored.Path)
	if _, err := validName(name); err != nil || stored.Path != attachmentsRel+"/"+name {
		return "", refuse(ErrOutside, "restore: %q is not an attachment", stored.Path)
	}
	if _, err := s.attachmentsFolder(); err != nil {
		return "", err
	}
	if err := os.MkdirAll(s.attachmentsDir(), 0o755); err != nil {
		return "", fmt.Errorf("restore: %w", err)
	}
	back := name
	if _, err := os.Lstat(filepath.Join(s.attachmentsDir(), name)); err == nil {
		ext := filepath.Ext(name)
		back = freeName(s.attachmentsDir(), strings.TrimSuffix(name, ext), ext)
	}
	if err := os.Rename(filepath.Join(slot, name), filepath.Join(s.attachmentsDir(), back)); err != nil {
		return "", fmt.Errorf("restore: %w", err)
	}
	if err := os.RemoveAll(slot); err != nil {
		return "", fmt.Errorf("restore: %w", err)
	}
	return attachmentsRel + "/" + back, nil
}

// freeName finds "base 2ext", "base 3ext", … free in a folder on disk.
func freeName(dir, base, ext string) string {
	for n := 2; ; n++ {
		name := fmt.Sprintf("%s %d%s", base, n, ext)
		if _, err := os.Lstat(filepath.Join(dir, name)); errors.Is(err, os.ErrNotExist) {
			return name
		}
	}
}
