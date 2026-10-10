package e2e

import (
	"archive/zip"
	"fmt"
	"os"
	"strings"
)

// CheckZip reads a zip in the scratch folder against a "zip" step's text:
// holds= the files it must hold and lacks= the prefixes no file may start
// with, each a comma-separated list, the two parts apart by ";" (names may
// hold spaces). Returns an error message, or "".
func (s *Service) CheckZip(path, text string) string {
	if s.options.Scratch == "" {
		return "zip " + path + ": no scratch folder"
	}
	root, err := os.OpenRoot(s.options.Scratch)
	if err != nil {
		return fmt.Sprintf("zip %s: %v", path, err)
	}
	defer root.Close()
	f, err := root.Open(path)
	if err != nil {
		return fmt.Sprintf("zip %s: %v", path, err)
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil {
		return fmt.Sprintf("zip %s: %v", path, err)
	}
	r, err := zip.NewReader(f, info.Size())
	if err != nil {
		return fmt.Sprintf("zip %s: %v", path, err)
	}
	held := map[string]bool{}
	for _, file := range r.File {
		held[file.Name] = true
	}
	for _, field := range strings.Split(text, ";") {
		key, list, _ := strings.Cut(strings.TrimSpace(field), "=")
		for _, name := range strings.Split(list, ",") {
			switch key {
			case "holds":
				if !held[name] {
					return fmt.Sprintf("zip %s does not hold %s", path, name)
				}
			case "lacks":
				for file := range held {
					if strings.HasPrefix(file, name) {
						return fmt.Sprintf("zip %s holds %s", path, file)
					}
				}
			default:
				return fmt.Sprintf("zip %s: unknown %q", path, key)
			}
		}
	}
	return ""
}
