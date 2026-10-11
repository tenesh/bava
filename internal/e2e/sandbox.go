package e2e

import (
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
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
