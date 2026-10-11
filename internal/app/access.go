package app

import (
	"log/slog"
	"os"

	"github.com/tharabyte/bava/internal/access"
)

// allow keeps paths the user just picked or dropped. A grant that cannot be
// kept costs only being asked again next launch, so it is logged, never in
// the way of what the user was doing.
func allow(grants *access.Store, paths ...string) {
	if grants == nil {
		return
	}
	for _, p := range paths {
		if p == "" {
			continue
		}
		// Never the error's text: it names the file, and a name can be content.
		if err := grants.Allow(p); err != nil {
			slog.Warn("keep access failed")
		}
	}
}

// AllowDropped keeps files dropped onto the window, which a sandbox lets
// Bava reach for this launch only otherwise.
func AllowDropped(grants *access.Store, paths []string) { allow(grants, paths...) }

// reachable is whether Bava may reach path now; without a store, whether it
// exists.
func reachable(grants *access.Store, path string) bool {
	if grants == nil {
		_, err := os.Stat(path)
		return err == nil
	}
	return grants.Reachable(path)
}
