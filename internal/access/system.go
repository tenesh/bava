package access

import (
	"os"
	"path/filepath"
	"runtime"
)

// ForSystem is this system's keeper: bookmarks inside the Mac App Store's
// sandbox, the portal's paths inside Flatpak, nothing anywhere else.
func ForSystem() Keeper {
	switch runtime.GOOS {
	case "darwin":
		// The sandbox sets this for every process it contains.
		if os.Getenv("APP_SANDBOX_CONTAINER_ID") != "" {
			return bookmarks{}
		}
	case "linux":
		if _, err := os.Stat("/.flatpak-info"); err == nil {
			return portal{}
		}
	}
	return None{}
}

// portal keeps Flatpak's grants: the portal keeps access to what the user
// chose, under a path of its own that stays valid, so the path is the token.
type portal struct{}

func (portal) Sandboxed() bool { return true }

func (portal) Keep(path string) ([]byte, error) { return []byte(path), nil }

func (portal) Restore(token []byte) (string, bool, error) { return string(token), false, nil }

// UseContainerTemp points temporary files at the Mac sandbox's own folder,
// `$HOME/tmp` inside the container, whatever TMPDIR the launcher passed
// down: the sandbox refuses any other. Outside a sandbox it does nothing.
// Call it before anything makes a temporary file.
func UseContainerTemp() error {
	if os.Getenv("APP_SANDBOX_CONTAINER_ID") == "" {
		return nil
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	dir := filepath.Join(home, "tmp")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return err
	}
	return os.Setenv("TMPDIR", dir)
}
