package e2e

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

// SandboxRun lays a walk out inside a sandbox's own home, which is all a
// sandboxed app may reach: the fixtures written under `smoke-repo` at their
// repository paths, and `smoke-scratch` and `smoke-out` made. It returns the
// three folders, for ${REPO}, ${SCRATCH} and the results.
func SandboxRun(home string, fixtures fs.FS) (repo, scratch, out string, err error) {
	repo = filepath.Join(home, "smoke-repo")
	scratch = filepath.Join(home, "smoke-scratch")
	out = filepath.Join(home, "smoke-out")
	for _, dir := range []string{repo, scratch, out} {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return "", "", "", fmt.Errorf("sandboxed run: %w", err)
		}
	}
	err = fs.WalkDir(fixtures, ".", func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		data, err := fs.ReadFile(fixtures, path)
		if err != nil {
			return err
		}
		to := filepath.Join(repo, filepath.FromSlash(path))
		if err := os.MkdirAll(filepath.Dir(to), 0o755); err != nil {
			return err
		}
		return os.WriteFile(to, data, 0o644)
	})
	if err != nil {
		return "", "", "", fmt.Errorf("sandboxed run: %w", err)
	}
	return repo, scratch, out, nil
}

// RunFile is the walk a packaged run is asked for, the first line of
// `.bava-e2e` in the home, which CI writes before starting the app: the
// system starts a package without the shell's environment. False when
// there is no such file.
func RunFile(home string) (string, bool) {
	data, err := os.ReadFile(filepath.Join(home, ".bava-e2e"))
	if err != nil {
		return "", false
	}
	name, _, _ := strings.Cut(strings.TrimSpace(string(data)), "\n")
	return strings.TrimSpace(name), name != ""
}

// SandboxHome is where a sandboxed run lays itself out: the home, or inside
// Flatpak the app's own folder under it, the only part of the home the
// sandbox lets it reach.
func SandboxHome(home string) string {
	if id := os.Getenv("FLATPAK_ID"); id != "" {
		return filepath.Join(home, ".var", "app", id)
	}
	return home
}
