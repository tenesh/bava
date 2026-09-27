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
// the scenario may make Spaces in.
func smokeRun(_ func() *application.App) (application.Service, func(string) (string, error)) {
	vars := map[string]string{"SCRATCH": os.Getenv("BAVA_E2E_SCRATCH")}
	scenario, err := e2e.Load(os.Getenv("BAVA_E2E_SCENARIO"), vars)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}
	folders := e2e.NewFolderQueue(scenario.Folders)
	service := e2e.NewService(e2e.Options{
		Scenario: scenario,
		Out:      os.Getenv("BAVA_E2E_OUT"),
		Capture:  e2e.Capture,
		// Straight to exit with the run's code: asking the app to quit first
		// ends the process with 0 on some platforms, so a failed run would pass.
		Quit: func(code int) { os.Exit(code) },
	})
	return application.NewService(service), folders.Next
}
