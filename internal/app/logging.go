package app

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"

	"github.com/tenesh/bava/internal/config"
	"github.com/tenesh/bava/internal/logs"
)

// StartLogging opens this run's log session in the platform log folder,
// honouring the verbose-logging preference.
//
// A log folder that cannot be used must not stop the app starting. It falls
// back to a per-user cache folder, and failing that to a session that records
// nothing: the app runs, its log is empty, and stderr says why.
func StartLogging() *logs.Session {
	env := logs.EnvFromOS()
	settings, _ := config.Load()
	options := logs.Options{Home: env.Home, Verbose: settings.VerboseLogging}

	if dir, err := logs.Dir(runtime.GOOS, env); err == nil {
		options.Dir = dir
		if session, err := logs.Start(options); err == nil {
			return session
		}
	}
	// Per user, never a shared temp path another account could own first.
	if cache, err := os.UserCacheDir(); err == nil {
		options.Dir = filepath.Join(cache, "Bava", "logs")
		if session, err := logs.Start(options); err == nil {
			return session
		}
	}
	fmt.Fprintln(os.Stderr, "bava: no usable log folder; this session will not be logged")
	return logs.Discard()
}

// SaveVerbosePreference persists the verbose-logging setting, keeping every
// other preference as it is.
func SaveVerbosePreference(on bool) error {
	path, err := config.Path()
	if err != nil {
		return err
	}
	settings, err := config.LoadFrom(path)
	if err != nil {
		return err
	}
	settings.VerboseLogging = on
	return config.SaveTo(path, settings)
}
