//go:build !e2e

package main

import "github.com/wailsapp/wails/v3/pkg/application"

// smokeRun is nothing in a normal build: no driver, native pickers.
func smokeRun(func() *application.App) (application.Service, func(string) (string, error)) {
	return application.Service{}, nil
}
