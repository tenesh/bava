package space

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// FreeName is name itself when taken says nothing has it, else the first of
// "base 2.ext", "base 3.ext"… that is free: how every clash is kept apart, a
// page, a file or a template alike. taken may count names already given out
// as well as what is on disk.
func FreeName(name string, taken func(string) bool) string {
	ext := filepath.Ext(name)
	return free(strings.TrimSuffix(name, ext), ext, taken)
}

// FreeFolderName is FreeName for a folder, numbered as a whole: a folder has
// no extension, whatever dots its name holds ("v1.2 2").
func FreeFolderName(name string, taken func(string) bool) string {
	return free(name, "", taken)
}

func free(base, ext string, taken func(string) bool) string {
	if name := base + ext; !taken(name) {
		return name
	}
	for n := 2; ; n++ {
		if name := fmt.Sprintf("%s %d%s", base, n, ext); !taken(name) {
			return name
		}
	}
}

// onDisk is taken for the names in dir, an absolute folder: only what is
// there, so a folder that cannot be read leaves the write to say why.
func onDisk(dir string) func(string) bool {
	return func(name string) bool {
		_, err := os.Lstat(filepath.Join(dir, name))
		return err == nil
	}
}
