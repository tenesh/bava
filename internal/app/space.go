package app

import (
	"encoding/base64"
	"fmt"
	"path/filepath"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"

	"github.com/tenesh/bava/internal/space"
)

// SpaceService is a Space's file surface (docs/ipc.md, "SpaceService"): open
// a folder as a Space, list it, and change it through one Apply, so the bound
// surface stays small. Problems the user can act on come back in Error.
type SpaceService struct {
	options SpaceServiceOptions
}

// SpaceServiceOptions are the platform hooks the service needs.
type SpaceServiceOptions struct {
	// Reveal opens a folder in the platform's file manager, or with
	// selectFile shows an item inside its folder.
	Reveal func(path string, selectFile bool) error
	// ChooseFolder answers the folder picker instead of showing the native
	// one: the smoke test build takes its answers from the scenario. Nil
	// shows the native picker.
	ChooseFolder func(title string) (string, error)
	// Folders learns each Space opened, so the page may be shown its images
	// and videos. Nil allows nothing.
	Folders *OpenedFolders
}

// NewSpaceService constructs the service registered with the application.
func NewSpaceService(options SpaceServiceOptions) *SpaceService {
	return &SpaceService{options: options}
}

// SpaceInfo is an opened Space.
type SpaceInfo struct {
	Root      string `json:"root"`
	Name      string `json:"name"`
	PageWidth string `json:"pageWidth"`
	Error     string `json:"error"`
	// Code names a refusal the frontend words itself (space.Code); "" for
	// any other failure, whose Error is shown as it is.
	Code string `json:"code"`
}

// SpaceList is one folder of a Space, in the Space's order.
type SpaceList struct {
	Entries []space.Entry `json:"entries"`
	Error   string        `json:"error"`
	Code    string        `json:"code"`
}

// Operation is one change to a Space. Kind is createPage, createFolder,
// rename, move, duplicate, trash, restore, deleteForever, emptyTrash,
// renameSpace, setPageWidth, relink, attach, attachData or renameAttachment;
// the other fields are what it needs.
type Operation struct {
	Kind   string `json:"kind"`
	Path   string `json:"path"`
	Folder string `json:"folder"`
	Name   string `json:"name"`
	// Index is where in Folder a move lands; -1 for the end.
	Index int    `json:"index"`
	ID    string `json:"id"`
	Width string `json:"width"`
	// Edits are relink's pages: each written only if it still reads as
	// Before.
	Edits []PageEdit `json:"edits"`
	// Source is the file attach copies in, from anywhere on disk.
	Source string `json:"source"`
	// Data is what attachData saves, in base64, under Name.
	Data string `json:"data"`
	// Attachment is the file renameAttachment renames, to Name.
	Attachment string `json:"attachment"`
}

// PageEdit is a page's text before and after its links followed a rename.
type PageEdit struct {
	Path   string `json:"path"`
	Before string `json:"before"`
	After  string `json:"after"`
}

// OpResult is what an operation made: the item's new path, a Trash item's id,
// or a renamed Space's new root.
type OpResult struct {
	Path string `json:"path"`
	ID   string `json:"id"`
	Root string `json:"root"`
	// Missed lists relink's pages that were not written: changed since they
	// were read, or not writable.
	Missed []string `json:"missed"`
	// Name is the attachment's name after attach, attachData or
	// renameAttachment.
	Name  string `json:"name"`
	Error string `json:"error"`
	Code  string `json:"code"`
}

// SpaceIndex is every page in a Space, in the tree's order.
type SpaceIndex struct {
	Pages []IndexPage `json:"pages"`
	Error string      `json:"error"`
	Code  string      `json:"code"`
}

// IndexPage is a page: its path, its name without .md, and its text when
// asked for.
type IndexPage struct {
	Name string `json:"name"`
	Path string `json:"path"`
	Text string `json:"text"`
}

// TrashList is the Space's Trash and its total size in bytes.
type TrashList struct {
	Items []space.TrashItem `json:"items"`
	Size  int64             `json:"size"`
	Error string            `json:"error"`
	Code  string            `json:"code"`
}

// Open opens a folder as a Space, creating .bava/space.json when missing.
func (s *SpaceService) Open(dir string) SpaceInfo {
	sp, err := space.Open(dir)
	if err != nil {
		return SpaceInfo{Error: err.Error(), Code: space.Code(err)}
	}
	width, err := sp.PageWidth()
	if err != nil {
		return SpaceInfo{Error: err.Error(), Code: space.Code(err)}
	}
	s.options.Folders.Allow(sp.Root)
	return SpaceInfo{Root: sp.Root, Name: filepath.Base(sp.Root), PageWidth: width}
}

// Create makes a new folder in parent, named as the user typed, and opens it
// as a Space.
func (s *SpaceService) Create(parent, name string) SpaceInfo {
	sp, err := space.Create(parent, name)
	if err != nil {
		return SpaceInfo{Error: err.Error(), Code: space.Code(err)}
	}
	return s.Open(sp.Root)
}

// List lists one folder of a Space.
func (s *SpaceService) List(root, folder string) SpaceList {
	sp, err := space.Load(root)
	if err != nil {
		return SpaceList{Error: err.Error(), Code: space.Code(err)}
	}
	entries, err := sp.List(folder)
	if err != nil {
		return SpaceList{Error: err.Error(), Code: space.Code(err)}
	}
	if entries == nil {
		entries = []space.Entry{}
	}
	return SpaceList{Entries: entries}
}

// Apply runs one operation on a Space.
func (s *SpaceService) Apply(root string, op Operation) OpResult {
	sp, err := space.Load(root)
	if err != nil {
		return OpResult{Error: err.Error(), Code: space.Code(err)}
	}
	var res OpResult
	switch op.Kind {
	case "createPage":
		res.Path, err = sp.CreatePage(op.Folder, op.Name)
	case "createFolder":
		res.Path, err = sp.CreateFolder(op.Folder, op.Name)
	case "rename":
		res.Path, err = sp.Rename(op.Path, op.Name)
	case "move":
		res.Path, err = sp.Move(op.Path, op.Folder, op.Index)
	case "duplicate":
		res.Path, err = sp.Duplicate(op.Path)
	case "trash":
		var item space.TrashItem
		item, err = sp.Trash(op.Path)
		res.ID, res.Path = item.ID, item.Path
	case "restore":
		res.Path, err = sp.Restore(op.ID)
	case "deleteForever":
		err = sp.DeleteForever(op.ID)
	case "emptyTrash":
		err = sp.EmptyTrash()
	case "renameSpace":
		var next space.Space
		next, err = sp.RenameSpace(op.Name)
		res.Root = next.Root
	case "setPageWidth":
		err = sp.SetPageWidth(op.Width)
	case "attach":
		res.Name, err = sp.Attach(op.Source)
	case "attachData":
		var data []byte
		if data, err = base64.StdEncoding.DecodeString(op.Data); err == nil {
			// Bytes with no name (a pasted screenshot) are named by when they came.
			name := op.Name
			if name == "" {
				name = space.PastedImageName(time.Now())
			}
			res.Name, err = sp.AttachData(name, data)
		}
	case "renameAttachment":
		res.Name, err = sp.RenameAttachment(op.Attachment, op.Name)
	case "relink":
		for _, edit := range op.Edits {
			if sp.WriteIfUnchanged(edit.Path, edit.Before, edit.After) != nil {
				res.Missed = append(res.Missed, edit.Path)
			}
		}
	default:
		err = fmt.Errorf("unknown operation %q", op.Kind)
	}
	if err != nil {
		return OpResult{Error: err.Error(), Code: space.Code(err)}
	}
	return res
}

// Index lists every page in a Space, with each page's text when withText is
// set: the frontend reads links with the Document's own reader, so what a
// link is never differs between an open page and the others.
func (s *SpaceService) Index(root string, withText bool) SpaceIndex {
	sp, err := space.Load(root)
	if err != nil {
		return SpaceIndex{Error: err.Error(), Code: space.Code(err)}
	}
	pages, err := sp.Pages()
	if err != nil {
		return SpaceIndex{Error: err.Error(), Code: space.Code(err)}
	}
	index := SpaceIndex{Pages: []IndexPage{}}
	for _, page := range pages {
		entry := IndexPage{Name: page.Name, Path: page.Path}
		if withText {
			// A page that cannot be read has no links to read.
			entry.Text, _ = sp.ReadPage(page.Path)
		}
		index.Pages = append(index.Pages, entry)
	}
	return index
}

// Trash lists the Space's Trash, most recently deleted first.
func (s *SpaceService) Trash(root string) TrashList {
	sp, err := space.Load(root)
	if err != nil {
		return TrashList{Error: err.Error(), Code: space.Code(err)}
	}
	items, err := sp.TrashItems()
	if err != nil {
		return TrashList{Error: err.Error(), Code: space.Code(err)}
	}
	var total int64
	for _, item := range items {
		total += item.Size
	}
	return TrashList{Items: items, Size: total}
}

// ChooseFolder shows the native folder picker, which can also make a new
// folder, titled as the frontend words it. An empty path means the user
// cancelled.
func (s *SpaceService) ChooseFolder(title string) DialogResult {
	if s.options.ChooseFolder != nil {
		path, err := s.options.ChooseFolder(title)
		if err != nil {
			return DialogResult{Error: err.Error()}
		}
		return DialogResult{Path: path}
	}
	dialog := application.Get().Dialog.OpenFile()
	dialog.SetTitle(title)
	dialog.CanChooseFiles(false)
	dialog.CanChooseDirectories(true)
	dialog.CanCreateDirectories(true)
	path, err := dialog.PromptForSingleSelection()
	if err != nil {
		return DialogResult{Error: err.Error()}
	}
	return DialogResult{Path: path}
}

// Problem is a failure the user may see: its message for the log, and a code
// the frontend words (space.Code), empty for any other failure.
type Problem struct {
	Error string `json:"error"`
	Code  string `json:"code"`
}

// Reveal shows the Space's folder, or with a path, that item selected in its
// folder, in the platform's file manager. A zero Problem means it worked.
func (s *SpaceService) Reveal(root, path string) Problem {
	if s.options.Reveal == nil {
		return Problem{Error: "showing folders is unavailable", Code: "revealUnavailable"}
	}
	sp, err := space.Load(root)
	if err != nil {
		return problem(err)
	}
	target, selectFile := sp.Root, false
	if path != "" {
		abs, err := sp.Abs(path)
		if err != nil {
			return problem(err)
		}
		target, selectFile = abs, true
	}
	if err := s.options.Reveal(target, selectFile); err != nil {
		return problem(err)
	}
	return Problem{}
}

func problem(err error) Problem {
	return Problem{Error: err.Error(), Code: space.Code(err)}
}
