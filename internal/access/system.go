package access

import (
	"os"
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
