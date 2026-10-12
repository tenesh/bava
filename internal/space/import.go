package space

import (
	"archive/zip"
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"slices"
	"sort"
	"strings"
)

// What an import brings: a page, a folder, a file for the attachments, or a
// template.
const (
	ImportPage     = "page"
	ImportFolder   = "folder"
	ImportFile     = "file"
	ImportTemplate = "template"
)

// ImportEntry is one thing an import brings in.
type ImportEntry struct {
	Kind string `json:"kind"`
	// Origin is the index of what was picked that it comes from.
	Origin int `json:"origin"`
	// From is its path within that pick, with "/": what its own links are
	// relative to ("Q4 notes/Research/Survey.md", ".bava/attachments/logo.png").
	From string `json:"from"`
	// Entry is its path inside the zip it comes from, or "" for a file on disk.
	Entry string `json:"entry"`
	// To is where it lands: a path in the Space for a page or folder; the
	// name a file asks for in the attachments (identical bytes reuse a file
	// already there, and a different file with that name is numbered when it
	// lands); a template's path in the templates folder ("Team/Retro.md").
	To   string `json:"to"`
	Size int64  `json:"size"`
}

// ImportRename is a name that came in numbered to keep both.
type ImportRename struct {
	From string `json:"from"`
	To   string `json:"to"`
}

// ImportOrigin is one thing picked: the file or folder on disk, and the
// folder its entries' From paths start in ("" for a zip, whose paths start
// inside it).
type ImportOrigin struct {
	Path string `json:"path"`
	Root string `json:"root"`
}

// ImportPlan is what an import will bring and where, before anything is
// written.
type ImportPlan struct {
	Into      string         `json:"into"`
	Origins   []ImportOrigin `json:"origins"`
	Entries   []ImportEntry  `json:"entries"`
	Renames   []ImportRename `json:"renames"`
	Pages     int            `json:"pages"`
	Files     int            `json:"files"`
	Templates int            `json:"templates"`
	Bytes     int64          `json:"bytes"`
}

// ImportPlan works out what importing sources into the folder into brings,
// writing nothing. Each source is an absolute path: a page (.md), a folder,
// or a zip. A folder comes in whole; a page lands in the folder; a zip's
// contents land in the folder keeping their own folders. Whatever would take
// a name already there, or one given out earlier in the same import, is
// numbered to keep both. Hidden files and links stay behind, except that a
// folder which is itself a Space, or a zip of one, brings its attachments and
// templates (never its settings or its Trash).
func (s Space) ImportPlan(sources []string, into string) (ImportPlan, error) {
	dir, err := s.resolve(into)
	if err != nil {
		return ImportPlan{}, err
	}
	if dir != "" && s.kindOf(dir) != KindFolder {
		return ImportPlan{}, refuse(ErrNotFolder, "%q is not a folder", into)
	}
	p := &planner{s: s, plan: ImportPlan{Into: dir, Origins: []ImportOrigin{}, Entries: []ImportEntry{}, Renames: []ImportRename{}}, given: map[string]bool{}}
	for i, source := range sources {
		if !filepath.IsAbs(source) {
			return ImportPlan{}, refuse(ErrNotImport, "%q is not an absolute path", source)
		}
		info, err := os.Lstat(source)
		if err != nil {
			return ImportPlan{}, fmt.Errorf("import %s: %w", filepath.Base(source), err)
		}
		switch {
		case info.IsDir():
			err = p.folder(i, source)
		case info.Mode().IsRegular() && strings.EqualFold(filepath.Ext(source), ".zip"):
			err = p.zip(i, source)
		case info.Mode().IsRegular() && strings.EqualFold(filepath.Ext(source), PageExt):
			err = p.page(i, source, info.Size())
		default:
			err = refuse(ErrNotImport, "%s is not a page, a folder or a zip", filepath.Base(source))
		}
		if err != nil {
			return ImportPlan{}, err
		}
	}
	return p.plan, nil
}

type planner struct {
	s    Space
	plan ImportPlan
	// given holds the names handed out in the folder imported into, and the
	// templates, lower-cased: two picks never land on one name.
	given map[string]bool
}

func (p *planner) add(e ImportEntry) {
	p.plan.Entries = append(p.plan.Entries, e)
	p.plan.Bytes += e.Size
	switch e.Kind {
	case ImportPage:
		p.plan.Pages++
	case ImportFile:
		p.plan.Files++
	case ImportTemplate:
		p.plan.Templates++
	}
}

// landing is the name something called name takes in the folder imported
// into: its own, or numbered when that is taken on disk or already given.
func (p *planner) landing(name string, folder bool) string {
	key := func(n string) string { return "into/" + strings.ToLower(n) }
	taken := func(n string) bool { return p.given[key(n)] || onDisk(p.s.abs(p.plan.Into))(n) }
	got := FreeName(name, taken)
	if folder {
		got = FreeFolderName(name, taken)
	}
	p.given[key(got)] = true
	if got != name {
		p.plan.Renames = append(p.plan.Renames, ImportRename{From: strings.TrimSuffix(name, PageExt), To: strings.TrimSuffix(got, PageExt)})
	}
	return got
}

// inside is where name lands in parent, a folder this import makes: numbered
// against what the import already put there, case aside, for a disk that
// ignores case would take "a.md" and "A.md" for one.
func (p *planner) inside(parent, name string, folder bool) string {
	key := func(n string) string { return "in/" + strings.ToLower(join(parent, n)) }
	taken := func(n string) bool { return p.given[key(n)] }
	got := FreeName(name, taken)
	if folder {
		got = FreeFolderName(name, taken)
	}
	p.given[key(got)] = true
	if got != name {
		p.plan.Renames = append(p.plan.Renames, ImportRename{From: strings.TrimSuffix(name, PageExt), To: strings.TrimSuffix(got, PageExt)})
	}
	return got
}

// template is where a template called file in group lands, numbered when the
// templates folder or this import already has it.
func (p *planner) template(group, file string) string {
	dir := p.s.abs(join(TemplatesDir, group))
	key := func(n string) string { return "templates/" + strings.ToLower(join(group, n)) }
	got := FreeName(file, func(n string) bool { return p.given[key(n)] || onDisk(dir)(n) })
	p.given[key(got)] = true
	if got != file {
		p.plan.Renames = append(p.plan.Renames, ImportRename{From: strings.TrimSuffix(file, PageExt), To: strings.TrimSuffix(got, PageExt)})
	}
	return join(group, got)
}

func (p *planner) page(origin int, source string, size int64) error {
	name := filepath.Base(source)
	// What was picked lands under the name the Space holds, read as it is.
	landed, err := validName(name)
	if err != nil {
		return err
	}
	p.plan.Origins = append(p.plan.Origins, ImportOrigin{Path: source, Root: filepath.Dir(source)})
	p.add(ImportEntry{Kind: ImportPage, Origin: origin, From: name, To: join(p.plan.Into, p.landing(landed, false)), Size: size})
	return nil
}

func (p *planner) folder(origin int, source string) error {
	name := filepath.Base(source)
	landed, err := validName(name)
	if err != nil {
		return err
	}
	p.plan.Origins = append(p.plan.Origins, ImportOrigin{Path: source, Root: filepath.Dir(source)})
	top := join(p.plan.Into, p.landing(landed, true))
	p.add(ImportEntry{Kind: ImportFolder, Origin: origin, From: name, To: top})
	if err := p.walk(origin, source, name, top); err != nil {
		return err
	}
	// A folder that is a Space brings its attachments and templates.
	if realDir(filepath.Join(source, Dir)) {
		return p.bava(origin, filepath.Join(source, Dir), name+"/"+Dir)
	}
	return nil
}

// walk lists a folder on disk: pages, folders and every other file, leaving
// hidden ones, links and names a Space cannot hold behind.
func (p *planner) walk(origin int, dir, from, to string) error {
	items, err := os.ReadDir(dir)
	if err != nil {
		return fmt.Errorf("import %s: %w", filepath.Base(dir), err)
	}
	for _, item := range items {
		name := item.Name()
		if strings.HasPrefix(name, ".") || item.Type()&os.ModeSymlink != 0 {
			continue
		}
		if !holdable(name) {
			continue
		}
		full := filepath.Join(dir, name)
		switch {
		case item.IsDir():
			landed := join(to, p.inside(to, name, true))
			p.add(ImportEntry{Kind: ImportFolder, Origin: origin, From: from + "/" + name, To: landed})
			if err := p.walk(origin, full, from+"/"+name, landed); err != nil {
				return err
			}
		case item.Type().IsRegular():
			info, err := item.Info()
			if err != nil {
				return fmt.Errorf("import %s: %w", name, err)
			}
			if strings.EqualFold(filepath.Ext(name), PageExt) {
				p.add(ImportEntry{Kind: ImportPage, Origin: origin, From: from + "/" + name, To: join(to, p.inside(to, name, false)), Size: info.Size()})
			} else {
				p.add(ImportEntry{Kind: ImportFile, Origin: origin, From: from + "/" + name, To: name, Size: info.Size()})
			}
		}
	}
	return nil
}

// bava brings a Space's attachments and templates from its .bava folder on
// disk: never its settings or its Trash.
func (p *planner) bava(origin int, dir, from string) error {
	var files []os.DirEntry
	if attachments := filepath.Join(dir, "attachments"); realDir(attachments) {
		var err error
		if files, err = os.ReadDir(attachments); err != nil {
			return fmt.Errorf("import attachments: %w", err)
		}
	}
	for _, f := range files {
		if strings.HasPrefix(f.Name(), ".") || !f.Type().IsRegular() {
			continue
		}
		info, err := f.Info()
		if err != nil {
			return fmt.Errorf("import %s: %w", f.Name(), err)
		}
		p.add(ImportEntry{Kind: ImportFile, Origin: origin, From: from + "/attachments/" + f.Name(), To: f.Name(), Size: info.Size()})
	}
	templates := filepath.Join(dir, "templates")
	var groups []os.DirEntry
	if realDir(templates) {
		var err error
		if groups, err = os.ReadDir(templates); err != nil {
			return fmt.Errorf("import templates: %w", err)
		}
	}
	for _, g := range groups {
		if strings.HasPrefix(g.Name(), ".") {
			continue
		}
		if g.Type().IsRegular() && isTemplateFile(g) {
			info, err := g.Info()
			if err != nil {
				return fmt.Errorf("import %s: %w", g.Name(), err)
			}
			p.add(ImportEntry{Kind: ImportTemplate, Origin: origin, From: from + "/templates/" + g.Name(), To: p.template("", g.Name()), Size: info.Size()})
			continue
		}
		if !g.IsDir() {
			continue
		}
		inside, err := os.ReadDir(filepath.Join(templates, g.Name()))
		if err != nil {
			return fmt.Errorf("import templates: %w", err)
		}
		for _, t := range inside {
			if !t.Type().IsRegular() || !isTemplateFile(t) {
				continue
			}
			info, err := t.Info()
			if err != nil {
				return fmt.Errorf("import %s: %w", t.Name(), err)
			}
			p.add(ImportEntry{Kind: ImportTemplate, Origin: origin, From: from + "/templates/" + g.Name() + "/" + t.Name(), To: p.template(g.Name(), t.Name()), Size: info.Size()})
		}
	}
	return nil
}

// zip lists a zip: its pages and folders land in the folder imported into,
// keeping their own folders; a Bava zip's attachments and templates come
// too. An entry that would leave the zip, or is hidden, stays behind.
func (p *planner) zip(origin int, source string) error {
	r, err := zip.OpenReader(source)
	if err != nil {
		return refuse(ErrNotImport, "%s is not a zip that opens: %v", filepath.Base(source), err)
	}
	defer r.Close()
	p.plan.Origins = append(p.plan.Origins, ImportOrigin{Path: source})
	type item struct {
		name string
		size int64
	}
	var items []item
	for _, f := range r.File {
		name := path.Clean(strings.ReplaceAll(f.Name, "\\", "/"))
		if f.FileInfo().IsDir() || f.Mode()&os.ModeSymlink != 0 || name == "." || strings.HasPrefix(name, "/") || name == ".." || strings.HasPrefix(name, "../") {
			continue
		}
		items = append(items, item{name, int64(f.UncompressedSize64)})
	}
	sort.Slice(items, func(i, j int) bool { return items[i].name < items[j].name })

	// Each top-level name lands once, numbered against the folder: a folder
	// keeps its whole name, a page its extension.
	tops := map[string]string{}
	topOf := func(name string, folder bool) string {
		if got, ok := tops[name]; ok {
			return got
		}
		got := p.landing(name, folder)
		tops[name] = got
		return got
	}
	landed := map[string]string{}
	for _, it := range items {
		parts := strings.Split(it.name, "/")
		if parts[0] == Dir {
			p.zipBava(origin, it.name, parts, it.size)
			continue
		}
		if hidden(parts) || !validParts(parts) {
			continue
		}
		isPage := strings.EqualFold(path.Ext(it.name), PageExt)
		if len(parts) == 1 && !isPage {
			// A file at the top goes to the attachments: no name in the folder.
			p.add(ImportEntry{Kind: ImportFile, Origin: origin, From: it.name, Entry: it.name, To: it.name, Size: it.size})
			continue
		}
		// Each folder lands once, by its path in the zip.
		parent := p.plan.Into
		for i := 0; i < len(parts)-1; i++ {
			from := strings.Join(parts[:i+1], "/")
			if got, ok := landed[from]; ok {
				parent = got
				continue
			}
			if i == 0 {
				parent = join(p.plan.Into, topOf(parts[0], true))
			} else {
				parent = join(parent, p.inside(parent, parts[i], true))
			}
			landed[from] = parent
			p.add(ImportEntry{Kind: ImportFolder, Origin: origin, From: from, Entry: from + "/", To: parent})
		}
		to := join(parent, parts[len(parts)-1])
		if len(parts) == 1 {
			to = join(p.plan.Into, topOf(parts[0], false))
		} else if isPage {
			to = join(parent, p.inside(parent, parts[len(parts)-1], false))
		}
		if isPage {
			p.add(ImportEntry{Kind: ImportPage, Origin: origin, From: it.name, Entry: it.name, To: to, Size: it.size})
		} else {
			p.add(ImportEntry{Kind: ImportFile, Origin: origin, From: it.name, Entry: it.name, To: parts[len(parts)-1], Size: it.size})
		}
	}
	return nil
}

// zipBava brings an entry of a Bava zip's .bava folder: an attachment or a
// template, never its settings or Trash.
func (p *planner) zipBava(origin int, name string, parts []string, size int64) {
	if hidden(parts[1:]) || !validParts(parts[1:]) {
		return
	}
	switch {
	case len(parts) == 3 && parts[1] == "attachments":
		p.add(ImportEntry{Kind: ImportFile, Origin: origin, From: name, Entry: name, To: parts[2], Size: size})
	case len(parts) == 3 && parts[1] == "templates" && strings.EqualFold(path.Ext(parts[2]), PageExt):
		p.add(ImportEntry{Kind: ImportTemplate, Origin: origin, From: name, Entry: name, To: p.template("", parts[2]), Size: size})
	case len(parts) == 4 && parts[1] == "templates" && strings.EqualFold(path.Ext(parts[3]), PageExt):
		p.add(ImportEntry{Kind: ImportTemplate, Origin: origin, From: name, Entry: name, To: p.template(parts[2], parts[3]), Size: size})
	}
}

func hidden(parts []string) bool {
	for _, part := range parts {
		if strings.HasPrefix(part, ".") {
			return true
		}
	}
	return false
}

// realDir reports a folder that is there and is no link.
func realDir(p string) bool {
	info, err := os.Lstat(p)
	return err == nil && info.IsDir()
}

func validParts(parts []string) bool {
	for _, part := range parts {
		if !holdable(part) {
			return false
		}
	}
	return true
}

// holdable reports a name the Space holds as it is: valid, and not one it
// would trim.
func holdable(name string) bool {
	got, err := validName(name)
	return err == nil && got == name
}

// ImportedPage is a page an import wrote: where it is now, and where it came
// from (its pick and its path there), for following its links.
type ImportedPage struct {
	Path   string `json:"path"`
	Origin int    `json:"origin"`
	From   string `json:"from"`
}

// ImportResult is what an import brought: the plan as carried out, the pages
// it wrote, and the attachment each file became, keyed "<origin>:<from>".
type ImportResult struct {
	Plan     ImportPlan        `json:"plan"`
	Pages    []ImportedPage    `json:"pages"`
	Attached map[string]string `json:"attached"`
}

// AttachedKey is how ImportResult.Attached names a file it brought.
func AttachedKey(origin int, from string) string { return fmt.Sprintf("%d:%s", origin, from) }

// Import brings sources into the folder into, planned afresh as ImportPlan
// does, so a name taken since the plan was shown is numbered, never
// overwritten. Pages are written byte for byte; every other file joins the
// attachments, reusing a file with the same bytes; templates join the
// templates. progress, when not nil, is told after each item. A cancelled
// ctx stops it and removes everything it made, leaving a reused attachment
// and everything that was there before: it returns ctx's error.
func (s Space) Import(ctx context.Context, sources []string, into string, progress func(done, total int)) (ImportResult, error) {
	plan, err := s.ImportPlan(sources, into)
	if err != nil {
		return ImportResult{}, err
	}
	res := ImportResult{Plan: plan, Pages: []ImportedPage{}, Attached: map[string]string{}}
	zips := map[int]*zip.ReadCloser{}
	defer func() {
		for _, r := range zips {
			r.Close()
		}
	}()
	// What was there before, so undoing never takes a file the import reused.
	attachedBefore := map[string]bool{}
	if existing, err := os.ReadDir(s.attachmentsDir()); err == nil {
		for _, e := range existing {
			attachedBefore[e.Name()] = true
		}
	}
	_, statErr := os.Stat(s.attachmentsDir())
	hadAttachments := statErr == nil
	var made []string // absolute paths, in the order made
	undo := func() {
		for i := len(made) - 1; i >= 0; i-- {
			_ = os.Remove(made[i])
		}
		if !hadAttachments {
			_ = os.Remove(s.attachmentsDir()) // only when left empty
		}
		_ = s.update(func(*File) error { return nil })
	}
	// openEntry gives an entry's bytes as a stream: a file is copied without
	// being held whole, however large.
	openEntry := func(e ImportEntry) (io.ReadCloser, error) {
		if e.Entry == "" {
			return os.Open(filepath.Join(plan.Origins[e.Origin].Root, filepath.FromSlash(e.From)))
		}
		r, ok := zips[e.Origin]
		if !ok {
			r, err = zip.OpenReader(plan.Origins[e.Origin].Path)
			if err != nil {
				return nil, refuse(ErrNotImport, "%s no longer opens", filepath.Base(plan.Origins[e.Origin].Path))
			}
			zips[e.Origin] = r
		}
		for _, f := range r.File {
			if path.Clean(strings.ReplaceAll(f.Name, "\\", "/")) == e.Entry {
				return f.Open()
			}
		}
		return nil, fmt.Errorf("%s is not in the zip", e.Entry)
	}
	// open is openEntry stopped mid-copy by a cancel.
	open := func(e ImportEntry) (io.ReadCloser, error) {
		r, err := openEntry(e)
		if err != nil {
			return nil, err
		}
		return untilCancelled(ctx, r), nil
	}
	for i, e := range plan.Entries {
		if err := ctx.Err(); err != nil {
			undo()
			return ImportResult{}, err
		}
		if err := s.importOne(e, open, &res, &made, attachedBefore); err != nil {
			undo()
			return ImportResult{}, fmt.Errorf("import %s: %w", path.Base(e.To), err)
		}
		if progress != nil {
			progress(i+1, len(plan.Entries))
		}
	}
	return res, nil
}

func (s Space) importOne(e ImportEntry, open func(ImportEntry) (io.ReadCloser, error), res *ImportResult, made *[]string, attachedBefore map[string]bool) error {
	// A page or a template is read whole: it is text, written byte for byte.
	read := func(e ImportEntry) ([]byte, error) {
		r, err := open(e)
		if err != nil {
			return nil, err
		}
		defer r.Close()
		return io.ReadAll(r)
	}
	switch e.Kind {
	case ImportFolder:
		rel, err := s.CreateFolder(parent(e.To), path.Base(e.To))
		if err != nil {
			return err
		}
		*made = append(*made, s.abs(rel))
	case ImportPage:
		content, err := read(e)
		if err != nil {
			return err
		}
		rel, err := s.CreatePageWith(parent(e.To), path.Base(e.To), content)
		if err != nil {
			return err
		}
		*made = append(*made, s.abs(rel))
		res.Pages = append(res.Pages, ImportedPage{Path: rel, Origin: e.Origin, From: e.From})
	case ImportFile:
		name, err := s.attach(e.To, e.Size, func() (io.ReadCloser, error) { return open(e) })
		if err != nil {
			return err
		}
		if !attachedBefore[name] {
			*made = append(*made, filepath.Join(s.attachmentsDir(), name))
			attachedBefore[name] = true
		}
		res.Attached[AttachedKey(e.Origin, e.From)] = name
	case ImportTemplate:
		content, err := read(e)
		if err != nil {
			return err
		}
		group, file := parent(e.To), path.Base(e.To)
		// The folders this template makes go too when undone: never one
		// the Space had, even empty.
		for _, dir := range []string{TemplatesDir, join(TemplatesDir, group)} {
			if _, err := os.Lstat(s.abs(dir)); errors.Is(err, os.ErrNotExist) && !slices.Contains(*made, s.abs(dir)) {
				*made = append(*made, s.abs(dir))
			}
		}
		rel, err := s.SaveTemplate(group, strings.TrimSuffix(file, path.Ext(file)), content, false)
		if err != nil {
			return err
		}
		*made = append(*made, s.abs(rel))
	}
	return nil
}

// untilCancelled reads r until ctx is cancelled, then fails with its error.
func untilCancelled(ctx context.Context, r io.ReadCloser) io.ReadCloser {
	return cancelledReader{ctx, r}
}

type cancelledReader struct {
	ctx context.Context
	io.ReadCloser
}

func (r cancelledReader) Read(p []byte) (int, error) {
	if err := r.ctx.Err(); err != nil {
		return 0, err
	}
	return r.ReadCloser.Read(p)
}
