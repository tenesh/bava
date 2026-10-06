package space

import (
	"bytes"
	"errors"
	"fmt"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"

	"github.com/tenesh/bava/internal/store"
)

// TemplatesDir is the Space's templates folder, relative to its root.
const TemplatesDir = Dir + "/templates"

// Template is one of the Space's page templates: its group ("" for none),
// its name without .md, and its path relative to the Space's root.
type Template struct {
	Group string `json:"group"`
	Name  string `json:"name"`
	Path  string `json:"path"`
}

// Templates lists the Space's templates: each group's by name, groups by
// name, then those in no group. Deeper folders and other files are not read.
func (s Space) Templates() ([]Template, error) {
	if err := s.realFolders(""); err != nil {
		return nil, err
	}
	root := s.abs(TemplatesDir)
	entries, err := os.ReadDir(root)
	if errors.Is(err, os.ErrNotExist) {
		return []Template{}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("templates: %w", err)
	}
	var grouped, loose []Template
	for _, entry := range entries {
		switch {
		case entry.IsDir() && !strings.HasPrefix(entry.Name(), "."):
			inner, err := os.ReadDir(filepath.Join(root, entry.Name()))
			if err != nil {
				return nil, fmt.Errorf("templates: %w", err)
			}
			for _, file := range inner {
				if isTemplateFile(file) {
					grouped = append(grouped, templateOf(entry.Name(), file.Name()))
				}
			}
		case isTemplateFile(entry):
			loose = append(loose, templateOf("", entry.Name()))
		}
	}
	byName := func(list []Template) {
		sort.Slice(list, func(i, j int) bool {
			if list[i].Group != list[j].Group {
				return list[i].Group < list[j].Group
			}
			return list[i].Name < list[j].Name
		})
	}
	byName(grouped)
	byName(loose)
	return append(append([]Template{}, grouped...), loose...), nil
}

func isTemplateFile(entry os.DirEntry) bool {
	return entry.Type().IsRegular() && strings.EqualFold(filepath.Ext(entry.Name()), PageExt) && !strings.HasPrefix(entry.Name(), ".")
}

func templateOf(group, file string) Template {
	return Template{Group: group, Name: strings.TrimSuffix(file, filepath.Ext(file)), Path: templatePath(group, file)}
}

func templatePath(group, file string) string {
	if group == "" {
		return TemplatesDir + "/" + file
	}
	return TemplatesDir + "/" + group + "/" + file
}

// SaveTemplate writes a template named name in group ("" for none), making
// the group's folder; a name the group has is refused unless replace.
func (s Space) SaveTemplate(group, name string, content []byte, replace bool) (string, error) {
	group, err := templateGroup(group)
	if err != nil {
		return "", err
	}
	if name, err = validName(name); err != nil {
		return "", err
	}
	if err := s.realFolders(group); err != nil {
		return "", err
	}
	rel := templatePath(group, pageName(name))
	if _, err := os.Lstat(s.abs(rel)); err == nil && !replace {
		return "", refuse(ErrExists, "%q already exists", name)
	}
	if err := os.MkdirAll(filepath.Dir(s.abs(rel)), 0o755); err != nil {
		return "", fmt.Errorf("save template: %w", err)
	}
	if err := store.SaveFrom(s.abs(rel), bytes.NewReader(content)); err != nil {
		return "", fmt.Errorf("save template %s: %w", name, err)
	}
	return rel, nil
}

// RenameTemplate renames a template within its group.
func (s Space) RenameTemplate(p, name string) (string, error) {
	group, file, err := s.template(p)
	if err != nil {
		return "", err
	}
	if name, err = validName(name); err != nil {
		return "", err
	}
	return s.relocateTemplate(templatePath(group, file), templatePath(group, pageName(name)))
}

// MoveTemplate moves a template to another group ("" for none), keeping its
// name; a group left empty is removed.
func (s Space) MoveTemplate(p, group string) (string, error) {
	from, file, err := s.template(p)
	if err != nil {
		return "", err
	}
	if group, err = templateGroup(group); err != nil {
		return "", err
	}
	return s.relocateTemplate(templatePath(from, file), templatePath(group, file))
}

// DuplicateTemplate copies a template beside itself under a numbered name.
func (s Space) DuplicateTemplate(p string) (string, error) {
	group, file, err := s.template(p)
	if err != nil {
		return "", err
	}
	content, err := os.ReadFile(s.abs(templatePath(group, file)))
	if err != nil {
		return "", fmt.Errorf("duplicate template: %w", err)
	}
	dir := parent(templatePath(group, file))
	copyName := s.numbered(dir, strings.TrimSuffix(file, filepath.Ext(file)), filepath.Ext(file))
	target := join(dir, copyName)
	if err := os.WriteFile(s.abs(target), content, 0o644); err != nil {
		return "", fmt.Errorf("duplicate template: %w", err)
	}
	return target, nil
}

// DeleteTemplate removes a template's file for good, and its group's folder
// when that leaves it empty.
func (s Space) DeleteTemplate(p string) error {
	group, file, err := s.template(p)
	if err != nil {
		return err
	}
	rel := templatePath(group, file)
	if err := os.Remove(s.abs(rel)); err != nil {
		return fmt.Errorf("delete template: %w", err)
	}
	s.dropEmptyGroup(parent(rel))
	return nil
}

// template checks that p is a template file of this Space: directly in
// templates/ or in a group there. It gives its group and file name.
func (s Space) template(p string) (string, string, error) {
	notOne := refuse(ErrOutside, "%q is not a template", p)
	if filepath.IsAbs(p) || strings.HasPrefix(p, "/") || strings.HasPrefix(p, "\\") {
		return "", "", notOne
	}
	rel := path.Clean(filepath.ToSlash(p))
	inside := strings.TrimPrefix(rel, TemplatesDir+"/")
	parts := strings.Split(inside, "/")
	if inside == rel || len(parts) > 2 || !strings.EqualFold(path.Ext(rel), PageExt) {
		return "", "", notOne
	}
	for _, part := range parts {
		if part == "" || part == ".." || strings.HasPrefix(part, ".") {
			return "", "", notOne
		}
	}
	// Neither the folders it is in nor the file may be a link out of the Space.
	group := ""
	if len(parts) == 2 {
		group = parts[0]
	}
	if err := s.realFolders(group); err != nil {
		return "", "", err
	}
	info, err := os.Lstat(s.abs(rel))
	if err != nil || !info.Mode().IsRegular() {
		return "", "", notOne
	}
	if len(parts) == 1 {
		return "", parts[0], nil
	}
	return parts[0], parts[1], nil
}

func (s Space) relocateTemplate(from, to string) (string, error) {
	if from == to {
		return to, nil
	}
	// The group it lands in: "" when it lands directly in templates/.
	if err := s.realFolders(strings.TrimPrefix(strings.TrimPrefix(parent(to), TemplatesDir), "/")); err != nil {
		return "", err
	}
	if _, err := os.Lstat(s.abs(to)); err == nil && !strings.EqualFold(from, to) {
		return "", refuse(ErrExists, "%q already exists", path.Base(to))
	}
	if err := os.MkdirAll(filepath.Dir(s.abs(to)), 0o755); err != nil {
		return "", fmt.Errorf("move template: %w", err)
	}
	if err := os.Rename(s.abs(from), s.abs(to)); err != nil {
		return "", fmt.Errorf("move template: %w", err)
	}
	s.dropEmptyGroup(parent(from))
	return to, nil
}

// dropEmptyGroup removes a group's folder that holds nothing; templates/
// itself stays.
func (s Space) dropEmptyGroup(dir string) {
	if dir == TemplatesDir {
		return
	}
	if entries, err := os.ReadDir(s.abs(dir)); err == nil && len(entries) == 0 {
		_ = os.Remove(s.abs(dir))
	}
}

// realFolders refuses .bava, its templates folder or a group's folder that
// is there but not a plain folder (a link most of all), so nothing a template
// operation writes, moves or reads can leave the Space through one.
func (s Space) realFolders(group string) error {
	dirs := []string{Dir, TemplatesDir}
	if group != "" {
		dirs = append(dirs, TemplatesDir+"/"+group)
	}
	for _, dir := range dirs {
		info, err := os.Lstat(s.abs(dir))
		if errors.Is(err, os.ErrNotExist) {
			continue
		}
		if err != nil {
			return fmt.Errorf("templates: %w", err)
		}
		if info.Mode()&os.ModeSymlink != 0 || !info.IsDir() {
			return refuse(ErrThroughLink, "%s is not a folder of this Space", dir)
		}
	}
	return nil
}

// templateGroup checks a group's name; "" is no group.
func templateGroup(group string) (string, error) {
	if strings.TrimSpace(group) == "" {
		return "", nil
	}
	return validName(group)
}
