//go:build e2e

package main

import (
	"embed"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v3/pkg/application"

	"github.com/tharabyte/bava/internal/e2e"
)

// The walks and the files they pick, built in for a sandboxed run, which
// cannot read the repository.
//
//go:embed tests/e2e/*.json
var smokeScenarios embed.FS

//go:embed testdata/fixtures/media
var smokeFixtures embed.FS

// smokeRun is the smoke test build's extra wiring: the driver's service, and
// folder pickers answered from the scenario. BAVA_E2E_SCENARIO names the
// scenario, BAVA_E2E_OUT where screenshots go, BAVA_E2E_SCRATCH the folder
// the scenario may make Spaces in, and the only folder a "file" step may read.
func smokeRun(_ func() *application.App, closeSession func()) (application.Service, pickers) {
	// The run starts in the repository, whose test files a scenario may pick.
	repo, _ := os.Getwd()
	out, scratch := os.Getenv("BAVA_E2E_OUT"), os.Getenv("BAVA_E2E_SCRATCH")
	read := func() ([]byte, error) { return os.ReadFile(os.Getenv("BAVA_E2E_SCENARIO")) }
	// Inside a store's sandbox the repository and the runner's folders are
	// out of reach: the run lays itself out in its own home, from the
	// scenarios and fixtures built into it, and BAVA_E2E_SCENARIO is a
	// scenario's name.
	capture := e2e.Capture
	name := os.Getenv("BAVA_E2E_SCENARIO")
	sandboxed := os.Getenv("BAVA_E2E_SANDBOX") == "1"
	// A package the system starts gets no environment: the walk is named in
	// a file in the home, and runs as it does in a sandbox.
	if name == "" {
		home, _ := os.UserHomeDir()
		from, ok := e2e.RunFile(home)
		if !ok {
			stop("no walk named", fmt.Errorf("no %s", filepath.Join(home, ".bava-e2e")))
		}
		name, sandboxed = from, true
	}
	if sandboxed {
		// The sandbox may refuse the screenshot tool: a picture is noted
		// missing, never a reason the walk fails.
		capture = func(path string) error {
			if err := e2e.Capture(path); err != nil {
				fmt.Fprintln(os.Stderr, "screenshot skipped in the sandbox:", err)
			}
			return nil
		}
		home, err := os.UserHomeDir()
		if err == nil {
			repo, scratch, out, err = e2e.SandboxRun(e2e.SandboxHome(home), smokeFixtures)
		}
		if err != nil {
			stop("sandboxed run", err)
		}
		read = func() ([]byte, error) {
			return smokeScenarios.ReadFile("tests/e2e/" + name + ".json")
		}
	}
	vars := map[string]string{"SCRATCH": scratch, "REPO": repo}
	data, err := read()
	if err != nil {
		stop("scenario", err)
	}
	scenario, err := e2e.Parse(data, vars)
	if err != nil {
		stop("scenario", err)
	}
	folders := e2e.NewFolderQueue(scenario.Folders)
	files := e2e.NewFileQueue(scenario.Files)
	saves := e2e.NewSaveQueue(scenario.Saves)
	service := e2e.NewService(e2e.Options{
		Scenario: scenario,
		Out:      out,
		Scratch:  scratch,
		Capture:  capture,
		// Straight to exit with the run's code, the session closed first:
		// asking the app to quit ends the process with 0 on some platforms, so
		// a failed run would pass.
		Quit: e2e.QuitAfter(closeSession, os.Exit),
		// A "pdf" step prints through the system's webview, on the main thread.
		RunOnMain: application.InvokeSync,
	})
	pdfFailed := func(err error) {
		fmt.Fprintln(os.Stderr, "PDF failed:", err)
		slog.Error("e2e: PDF failed", "err", err)
	}
	return application.NewService(service), pickers{chooseFolder: folders.Next, chooseFiles: files.Next, chooseSave: saves.Next, pdfFailed: pdfFailed}
}

// stop ends a run that could not begin. The reason goes to the log as well
// as stderr: a package the system starts has no stderr anyone reads.
func stop(stage string, err error) {
	fmt.Fprintf(os.Stderr, "%s: %v\n", stage, err)
	slog.Error("e2e: run could not begin", "stage", stage, "err", err)
	os.Exit(2)
}
