//go:build !windows

package e2e

import "os/exec"

// hideWindow does nothing where a screenshot opens no window of its own.
func hideWindow(*exec.Cmd) {}
