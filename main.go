package main

import (
	"embed"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"runtime"
	"sync/atomic"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/events"

	"github.com/tenesh/bava/internal/app"
	"github.com/tenesh/bava/internal/logs"
)

// Wails uses Go's `embed` package to embed the frontend files into the binary.
// Any files in the frontend/dist folder will be embedded into the binary and
// made available to the frontend.
// See https://pkg.go.dev/embed for more information.

//go:embed all:frontend/dist
var assets embed.FS

// main creates the application, registers its services, and opens the window.
// The native surface stays thin on purpose: the render pipeline, file I/O and
// logging live in internal/, everything else in the frontend.
func main() {
	// Logging starts first, so everything after it — including Wails' own
	// errors, which a release build would otherwise discard — is kept.
	// It never fails: without a usable folder the session simply records nothing.
	session := app.StartLogging()
	// Bava's own packages log through slog's default logger, so it must be
	// the session's too.
	slog.SetDefault(session.Logger)

	// Set once the application exists. Wails may call these closures from its
	// own goroutines during New, so the pointer is atomic and checked.
	var current atomic.Pointer[application.App]
	emit := func(e app.AppError) {
		if a := current.Load(); a != nil {
			a.Event.Emit(app.AppErrorEvent, e)
		}
	}

	logService := app.NewLogService(app.LogServiceOptions{
		Session:   session,
		OSVersion: func() string { return osVersion(current.Load()) },
		OpenFolder: func(path string) error {
			a := current.Load()
			if a == nil {
				return errors.New("the application is not running yet")
			}
			return a.Env.OpenFileManager(path, false)
		},
		SaveVerbose: app.SaveVerbosePreference,
	})

	menus := app.NewMenuService()
	wailsApp := application.New(application.Options{
		// Wails builds the native role labels from this — "Hide Bava", "Quit Bava".
		Name:        "Bava",
		Description: "Local-only diagrams and docs",
		// Not the session logger itself: Wails logs every bound call's
		// arguments at debug level, which is document content. This one stays
		// at warn and keeps attribute names without values.
		Logger: session.WailsLogger(),
		// Wails' default exits the process on a panic; Bava logs and carries on
		// wherever that is safe (see PanicHandlerWithExit).
		PanicHandler: app.PanicHandler(session.Logger, emit),
		Services: []application.Service{
			application.NewService(app.NewRenderService()),
			application.NewService(app.NewFileService()),
			application.NewService(menus),
			application.NewService(logService),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})
	current.Store(wailsApp)

	// After application.New: native role items need the application.
	if err := app.InstallMenu(wailsApp, menus, runtime.GOOS); err != nil {
		fail(session, "install menu", err)
	}

	window := wailsApp.Window.NewWithOptions(app.MainWindowOptions())
	// macOS only: Wails beta.20 does not surface the equivalent on Windows or
	// Linux. See ContentProcessDied.
	window.OnWindowEvent(events.Mac.WebViewWebContentProcessDidTerminate, func(*application.WindowEvent) {
		app.ContentProcessDied(logService, window.Reload)
	})

	// Blocks until the application exits.
	if err := wailsApp.Run(); err != nil {
		fail(session, "run", err)
	}
	// Closed after Run returns rather than in OnShutdown, which runs before
	// services shut down: their last log lines would go to a closed file.
	session.Close()
}

// fail records a fatal startup error where the user can find it, then exits.
// The session is deliberately not closed: the next launch should report that
// this one ended unexpectedly.
func fail(session *logs.Session, stage string, err error) {
	session.Logger.Error("fatal", "stage", stage, "err", err)
	fmt.Fprintf(os.Stderr, "bava: %s: %v\n", stage, err)
	os.Exit(1)
}

func osVersion(wailsApp *application.App) string {
	if wailsApp == nil {
		return "unknown"
	}
	if info := wailsApp.Env.Info().OSInfo; info != nil {
		return info.Name + " " + info.Version
	}
	return "unknown"
}
