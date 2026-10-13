package icons

import (
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strconv"
	"strings"
)

// MaxIconBytes is the largest SVG added: an icon, not a poster.
const MaxIconBytes = 1 << 20

const (
	extension = ".svg"
	darkMark  = ".dark"
	trashName = ".trash"
)

// Icon is one custom icon as the page draws it: cleaned, with its dark copy
// when it has one.
type Icon struct {
	Name    string `json:"name"`
	SVG     string `json:"svg"`
	DarkSVG string `json:"darkSvg,omitempty"`
}

// Library is the folder of custom icons. An icon is `<name>.svg`, its dark
// copy `<name>.dark.svg`; a deleted pair moves to `.trash/`.
type Library struct {
	dir string
}

// Open is the library in dir, made when first written to.
func Open(dir string) *Library { return &Library{dir: dir} }

// Dir is the library's folder.
func (l *Library) Dir() string { return l.dir }

// List is every whole icon in the folder, by name, each cleaned as it is
// read: a file dropped there by hand is held to what an added one is. A file
// that is not a whole SVG, and a dark copy with no icon, are left out.
func (l *Library) List() ([]Icon, error) {
	entries, err := os.ReadDir(l.dir)
	if errors.Is(err, fs.ErrNotExist) {
		return []Icon{}, nil
	}
	if err != nil {
		return nil, err
	}
	present := map[string]bool{}
	for _, entry := range entries {
		if !entry.IsDir() {
			present[entry.Name()] = true
		}
	}
	icons := []Icon{}
	for _, entry := range entries {
		name, dark, ok := libraryName(entry.Name())
		if entry.IsDir() || !ok || dark {
			continue
		}
		svg, err := l.read(entry.Name())
		if err != nil {
			continue
		}
		icon := Icon{Name: name, SVG: svg}
		if present[name+darkMark+extension] {
			if darkSVG, err := l.read(name + darkMark + extension); err == nil {
				icon.DarkSVG = darkSVG
			}
		}
		icons = append(icons, icon)
	}
	slices.SortFunc(icons, func(a, b Icon) int { return strings.Compare(strings.ToLower(a.Name), strings.ToLower(b.Name)) })
	return icons, nil
}

func (l *Library) read(file string) (string, error) {
	data, err := readLimited(filepath.Join(l.dir, file))
	if err != nil {
		return "", err
	}
	return Sanitise(data)
}

// Add copies the SVG files given, and those directly inside any folder
// given, into the library, cleaned, each named by its file; a name taken
// gets a number. A dark copy goes with its icon, or to an icon already here
// without one. What cannot be added is said, one line each.
func (l *Library) Add(paths []string) (added []string, problems []string, err error) {
	added, problems = []string{}, []string{}
	files, problems := expand(paths)
	type pending struct {
		path, svg string
	}
	icons := map[string]pending{}
	darks := map[string]pending{}
	var order []string
	for _, path := range files {
		name, dark, ok := iconName(filepath.Base(path))
		if !ok {
			problems = append(problems, fmt.Sprintf("%s: not an SVG file", filepath.Base(path)))
			continue
		}
		data, err := readLimited(path)
		if err != nil {
			problems = append(problems, fmt.Sprintf("%s: %v", filepath.Base(path), err))
			continue
		}
		svg, err := Sanitise(data)
		if err != nil {
			problems = append(problems, fmt.Sprintf("%s: %v", filepath.Base(path), err))
			continue
		}
		name = safeName(name)
		if dark {
			darks[name] = pending{path, svg}
		} else {
			icons[name] = pending{path, svg}
			order = append(order, name)
		}
	}
	if err := os.MkdirAll(l.dir, 0o755); err != nil {
		return added, problems, err
	}
	for _, name := range order {
		free := l.freeName(name)
		if err := writeFile(filepath.Join(l.dir, free+extension), icons[name].svg); err != nil {
			return added, problems, err
		}
		if dark, ok := darks[name]; ok {
			if err := writeFile(filepath.Join(l.dir, free+darkMark+extension), dark.svg); err != nil {
				return added, problems, err
			}
			delete(darks, name)
		}
		added = append(added, free)
	}
	// A dark copy on its own joins an icon already in the library.
	for name, dark := range darks {
		switch {
		case !exists(filepath.Join(l.dir, name+extension)):
			problems = append(problems, fmt.Sprintf("%s: no icon named %s to be its dark copy", filepath.Base(dark.path), name))
		case exists(filepath.Join(l.dir, name+darkMark+extension)):
			problems = append(problems, fmt.Sprintf("%s: %s already has a dark copy", filepath.Base(dark.path), name))
		default:
			if err := writeFile(filepath.Join(l.dir, name+darkMark+extension), dark.svg); err != nil {
				return added, problems, err
			}
		}
	}
	return added, problems, nil
}

// expand is the files to add: those given, and the files directly inside a folder given.
func expand(paths []string) (files []string, problems []string) {
	for _, path := range paths {
		info, err := os.Stat(path)
		if err != nil {
			problems = append(problems, fmt.Sprintf("%s: %v", filepath.Base(path), err))
			continue
		}
		if !info.IsDir() {
			files = append(files, path)
			continue
		}
		entries, err := os.ReadDir(path)
		if err != nil {
			problems = append(problems, fmt.Sprintf("%s: %v", filepath.Base(path), err))
			continue
		}
		for _, entry := range entries {
			if _, _, ok := iconName(entry.Name()); ok && !entry.IsDir() {
				files = append(files, filepath.Join(path, entry.Name()))
			}
		}
	}
	return files, problems
}

// Rename gives an icon, and its dark copy, a new name: never one another
// icon or dark copy has, and never only half done.
func (l *Library) Rename(from, to string) error {
	to = strings.TrimSpace(to)
	if err := checkGiven(from); err != nil {
		return err
	}
	if err := validName(to); err != nil {
		return err
	}
	source := filepath.Join(l.dir, from+extension)
	if !exists(source) {
		return fmt.Errorf("no icon named %s: %w", from, os.ErrNotExist)
	}
	target := filepath.Join(l.dir, to+extension)
	sourceDark, targetDark := filepath.Join(l.dir, from+darkMark+extension), filepath.Join(l.dir, to+darkMark+extension)
	if exists(target) && !sameFile(source, target) {
		return fmt.Errorf("an icon named %s is already there", to)
	}
	if exists(targetDark) && !sameFile(sourceDark, targetDark) {
		return fmt.Errorf("a dark copy named %s is already there", to)
	}
	if err := os.Rename(source, target); err != nil {
		return err
	}
	if exists(sourceDark) {
		if err := os.Rename(sourceDark, targetDark); err != nil {
			// Back as it was: an icon apart from its dark copy is half a rename.
			_ = os.Rename(target, source)
			return err
		}
	}
	return nil
}

// Delete moves an icon, and its dark copy, into the library's trash, under a
// free name, where they can be taken back from.
func (l *Library) Delete(name string) error {
	if err := checkGiven(name); err != nil {
		return err
	}
	source := filepath.Join(l.dir, name+extension)
	if !exists(source) {
		return fmt.Errorf("no icon named %s: %w", name, os.ErrNotExist)
	}
	trash := filepath.Join(l.dir, trashName)
	if err := os.MkdirAll(trash, 0o755); err != nil {
		return err
	}
	free := name
	for n := 2; exists(filepath.Join(trash, free+extension)) || exists(filepath.Join(trash, free+darkMark+extension)); n++ {
		free = name + "-" + strconv.Itoa(n)
	}
	if err := os.Rename(source, filepath.Join(trash, free+extension)); err != nil {
		return err
	}
	dark := filepath.Join(l.dir, name+darkMark+extension)
	if exists(dark) {
		return os.Rename(dark, filepath.Join(trash, free+darkMark+extension))
	}
	return nil
}

// freeName is name, or name-2, name-3 and on, whichever no icon has.
func (l *Library) freeName(name string) string {
	free := name
	for n := 2; exists(filepath.Join(l.dir, free+extension)); n++ {
		free = name + "-" + strconv.Itoa(n)
	}
	return free
}

// iconName is a chosen file's icon name and whether it is a dark copy;
// false for anything that is not a visible SVG file, `.svg` in any case.
func iconName(file string) (name string, dark bool, ok bool) {
	if strings.HasPrefix(file, ".") || len(file) <= len(extension) || !strings.EqualFold(file[len(file)-len(extension):], extension) {
		return "", false, false
	}
	return splitDark(file[:len(file)-len(extension)])
}

// libraryName is the same for a file in the library, whose own files end in
// `.svg` as written: the name it is listed by is the name it is found by.
func libraryName(file string) (name string, dark bool, ok bool) {
	if strings.HasPrefix(file, ".") || !strings.HasSuffix(file, extension) || len(file) == len(extension) {
		return "", false, false
	}
	return splitDark(strings.TrimSuffix(file, extension))
}

func splitDark(name string) (string, bool, bool) {
	if strings.HasSuffix(name, darkMark) {
		return strings.TrimSuffix(name, darkMark), true, name != darkMark
	}
	return name, false, true
}

// Names Windows keeps for devices, with any extension.
var reservedNames = regexp.MustCompile(`(?i)^(con|prn|aux|nul|com[1-9]|lpt[1-9])$`)

// Characters no file name can hold on every platform.
const unsafeCharacters = `/\:*?"<>|`

// safeName is a chosen file's name made one every platform can hold:
// what cannot be in a name becomes a dash, and a device name gets a word.
func safeName(name string) string {
	name = strings.Map(func(r rune) rune {
		if r < ' ' || strings.ContainsRune(unsafeCharacters, r) {
			return '-'
		}
		return r
	}, name)
	name = strings.TrimRight(name, ". ")
	name = strings.TrimLeft(name, ".")
	if name == "" {
		return "icon"
	}
	if reservedNames.MatchString(name) {
		return name + "-icon"
	}
	return name
}

// checkGiven refuses a name from the page that is not plainly a name in the library.
func checkGiven(name string) error {
	if name == "" || filepath.Base(name) != name || name == "." || name == ".." || strings.ContainsAny(name, `/\`) {
		return fmt.Errorf("no icon named %q: %w", name, os.ErrNotExist)
	}
	return nil
}

func sameFile(a, b string) bool {
	left, err := os.Stat(a)
	if err != nil {
		return false
	}
	right, err := os.Stat(b)
	return err == nil && os.SameFile(left, right)
}

// validName is whether a name can be an icon's file name everywhere.
func validName(name string) error {
	switch {
	case name == "":
		return errors.New("an icon needs a name")
	case strings.HasPrefix(name, "."):
		return errors.New("an icon's name cannot start with a dot")
	case strings.HasSuffix(name, darkMark):
		return errors.New("an icon's name cannot end in .dark: that names a dark copy")
	case strings.ContainsAny(name, unsafeCharacters) || strings.ContainsFunc(name, func(r rune) bool { return r < ' ' }):
		return errors.New(`an icon's name cannot hold / \ : * ? " < > |`)
	case strings.HasSuffix(name, ".") || strings.HasSuffix(name, " "):
		return errors.New("an icon's name cannot end in a dot or a space")
	case reservedNames.MatchString(name):
		return fmt.Errorf("%s is a name Windows keeps for itself", name)
	case len(name) > 120:
		return errors.New("an icon's name is too long")
	}
	return nil
}

func readLimited(path string) ([]byte, error) {
	info, err := os.Stat(path)
	if err != nil {
		return nil, err
	}
	if info.Size() > MaxIconBytes {
		return nil, fmt.Errorf("larger than %d MB", MaxIconBytes>>20)
	}
	return os.ReadFile(path)
}

// writeFile writes whole or not at all: a half-written icon is never listed.
func writeFile(path, contents string) error {
	temp, err := os.CreateTemp(filepath.Dir(path), ".adding-*")
	if err != nil {
		return err
	}
	if _, err := temp.WriteString(contents); err != nil {
		temp.Close()
		os.Remove(temp.Name())
		return err
	}
	if err := temp.Close(); err != nil {
		os.Remove(temp.Name())
		return err
	}
	return os.Rename(temp.Name(), path)
}

func exists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}
