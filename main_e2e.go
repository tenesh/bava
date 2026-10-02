//go:build e2e

package main

import (
	"fmt"
	"os"

	"github.com/wailsapp/wails/v3/pkg/application"

	"github.com/tenesh/bava/internal/e2e"
)

// smokeRun is the smoke test build's extra wiring: the driver's service, and
// folder pickers answered from the scenario. BAVA_E2E_SCENARIO names the
// scenario, BAVA_E2E_OUT where screenshots go, BAVA_E2E_SCRATCH the folder
// the scenario may make Spaces in, and the only folder a "file" step may read.
func smokeRun(_ func() *application.App) (application.Service, pickers) {
	// The run starts in the repository, whose test files a scenario may pick.
	repo, _ := os.Getwd()
	vars := map[string]string{"SCRATCH": os.Getenv("BAVA_E2E_SCRATCH"), "REPO": repo}
	scenario, err := e2e.Load(os.Getenv("BAVA_E2E_SCENARIO"), vars)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}
	folders := e2e.NewFolderQueue(scenario.Folders)
	files := e2e.NewFileQueue(scenario.Files)
	service := e2e.NewService(e2e.Options{
		Scenario: scenario,
		Out:      os.Getenv("BAVA_E2E_OUT"),
		Scratch:  os.Getenv("BAVA_E2E_SCRATCH"),
		Capture:  e2e.Capture,
		// Straight to exit with the run's code: asking the app to quit first
		// ends the process with 0 on some platforms, so a failed run would pass.
		Quit: func(code int) { os.Exit(code) },
	})
	return application.NewService(service), pickers{chooseFolder: folders.Next, chooseFiles: files.Next}
}
